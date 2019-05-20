'use strict';

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 5000;           // Continuous polling function interval
const TCP_TIMEOUT = 30000;          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000;   // How long to wait before attempting to reconnect

let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let tcpClient;

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\n');
  frameParser.on('data', data => onFrame(data));


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }
  function isPoweredOn() { return isConnected() && base.getVar('Power').string === 'On'; }
  function isDTVMode() { return isConnected() && isPoweredOn() && base.getVar('Sources').string === 'DTV'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
    base.setPoll({ action: 'getSource', period: POLL_PERIOD, enablePollFn: isPoweredOn, startImmediately: true });
    base.setPoll({ action: 'getAudioLevel', period: POLL_PERIOD, enablePollFn: isPoweredOn, startImmediately: true });
    base.setPoll({ action: 'getAudioMute', period: POLL_PERIOD, enablePollFn: isPoweredOn, startImmediately: true });
    base.setPoll({ action: 'getChannel', period: POLL_PERIOD, enablePollFn: isDTVMode, startImmediately: true });
  }

  function start() {
    if (config.simulation) base.getVar('Status').string = 'Connected';
    else initTcpClient();
  }

  function tick() {
    if (!config.simulation && !tcpClient) initTcpClient();
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected';
    tcpClient && tcpClient.end();
    tcpClient = null;
  }

  function initTcpClient() {
    if (tcpClient) return;  // Return if tcpClient already exists

    tcpClient = host.createTCPClient();
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
    });
    tcpClient.connect(config.port, config.host);

    tcpClient.on('connect', () => {
      logger.silly('TCPClient connected');
      base.getVar('Status').string = 'Connected';
      base.startPolling();
    });

    tcpClient.on('data', data => {
      frameParser.push( data.toString() );
    });

    tcpClient.on('close', () => {
      logger.silly('TCPClient closed');
      base.getVar('Status').string = 'Disconnected';  // Triggered on timeout, this allows auto reconnect
    });

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`);
      stop();  // Throw out the tcpClient and get a fresh connection
    });
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`TCPClient send: ${data}`);
    return tcpClient && tcpClient.write(data);
  }

  function sendDefer(data) {
    if (send(data)) base.commandDefer(CMD_DEFER_TIME);
    else base.commandError('Data not sent');
  }

  function onFrame(data) {
    let match;  // Used for regex matching below
    const pendingCommand = base.getPendingCommand();

    logger.silly(`onFrame: ${data}`);
    pendingCommand && logger.debug(`pendingCommand: ${pendingCommand.action}`);

    // Use arrays to match pending command action to expected response
    const setFns = [ 'setPower', 'selectSource', 'setAudioLevel', 'setAudioMute', 'setChannel', 'shiftChannel' ];

    if ( pendingCommand && setFns.includes(pendingCommand.action) ) {
      // Parse response after issueing a SET function

      match = data.match(/POWR0{16}/);
      if (match) {
        base.getVar('Power').string = pendingCommand.params.Status;
        base.commandDone();
      }

      match = data.match(/INPT0{16}/);
      if (match) {
        base.getVar('Sources').string = pendingCommand.params.Name;
        base.commandDone();
        if (pendingCommand.params.Name === 'DTV') getChannel();  // Get channel when set to DTV mode
      }

      match = data.match(/VOLU0{16}/);
      if (match) {
        base.getVar('AudioLevel').value = parseInt(pendingCommand.params.Level);
        base.commandDone();
      }

      match = data.match(/AMUT0{16}/);
      if (match) {
        base.getVar('AudioMute').string = pendingCommand.params.Status;
        base.commandDone();
      }

      match = data.match(/CHNN0{16}/);
      if (match) {
        base.getVar('Channel').value = parseInt(pendingCommand.params.Name);
        base.commandDone();
      }

      match = data.match(/IRCC0{16}/);
      if (match) {
        base.getVar('ChannelShift').value = 0;  // Reset to 'idle'
        base.commandDone();
      }

    }
    else {
      // Parse response after issueing a GET function, OR after a "notify" frame
      // Notify frames are received after changing something, either from the CS or an IR remote

      match = data.match(/POWR(\d+)/);
      if (match) {
        base.getVar('Power').value = parseInt(match[1]);  // 0 = off, 1 = on
        pendingCommand && base.commandDone();
      }

      match = data.match(/INPT0{16}/);
      if (match) {
        base.getVar('Sources').string = 'DTV';
        pendingCommand && base.commandDone();
      }

      match = data.match(/INPT0{7}1(\d+)/);
      if (match) {
        base.getVar('Sources').string = `HDMI${parseInt(match[1])}`;
        pendingCommand && base.commandDone();
      }

      match = data.match(/VOLU(\d+)/);
      if (match) {
        base.getVar('AudioLevel').value = parseInt(match[1]);
        pendingCommand && base.commandDone();
      }

      match = data.match(/AMUT(\d+)/);
      if (match) {
        base.getVar('AudioMute').value = parseInt(match[1]);  // 0 = unmute, 1 = mute
        pendingCommand && base.commandDone();
      }

      match = data.match(/CHNN(\d+)\./);  // Ignores values after decimal point
      if (match) {
        base.getVar('Channel').value = parseInt(match[1]);
        pendingCommand && base.commandDone();
      }

    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getPower() {
    sendDefer('*SEPOWR################\n');
  }

  function getSource() {
    sendDefer('*SEINPT################\n');
  }

  function getAudioLevel() {
    sendDefer('*SEVOLU################\n');
  }

  function getAudioMute() {
    sendDefer('*SEAMUT################\n');
  }

  function getChannel() {
    sendDefer('*SECHNN################\n');
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setPower(params) {
    if (config.simulation) {
      base.getVar('Power').string = params.Status;
      return;
    }

    if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n');
  }

  function selectSource(params) {
    if (config.simulation) {
      base.getVar('Sources').string = params.Name;
      return;
    }

    if (params.Name == 'DTV') sendDefer('*SCINPT0000000000000000\n');
    else {
      let match = params.Name.match(/HDMI(\d)/);
      match && sendDefer(`*SCINPT000000010000000${match[1]}\n`);
    }
  }

  function setAudioLevel(params) {
    if (config.simulation) {
      base.getVar('AudioLevel').value = params.Level;
      return;
    }

    let vol = params.Level.toString().padStart(3, '0');  // Formats the integer with leading zeroes, e.g. 53 = '053'
    sendDefer(`*SCVOLU0000000000000${vol}\n`);
  }

  function setAudioMute(params) {
    if (config.simulation) {
      base.getVar('AudioMute').string = params.Status;
      return;
    }

    if (params.Status == 'Off') sendDefer('*SCAMUT0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCAMUT0000000000000001\n');
  }

  function setChannel(params) {
    if (isDTVMode()) {
      if (config.simulation) {
        base.getVar('Channel').value = params.Name;
        return;
      }
      let channel = params.Name.toString().padStart(8, '0');
      sendDefer(`*SCCHNN${channel}.0000000\n`);
    }
    else {
      logger.error('Cannot change channel unless set to DTV mode');
    }
  }

  function shiftChannel(params) {
    if (isDTVMode()) {
      if (config.simulation) {
        let delta = { 'Up': 1, 'Down': -1 };
        base.getVar('Channel').value += delta[params.Name];
        return;
      }
      if (params.Name == 'Up') sendDefer('*SCIRCC0000000000000033\n');
      else if (params.Name == 'Down') sendDefer('*SCIRCC0000000000000034\n');
      base.getVar('ChannelShift').string = params.Name;
    }
    else {
      logger.error('Cannot change channel unless set to DTV mode');
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getPower, getSource, getAudioLevel, getAudioMute, getChannel,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel, shiftChannel
  };
};