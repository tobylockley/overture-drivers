'use strict';

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 10000;           // Continuous polling function interval
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
  function isOn() { return base.getVar('Power').string === 'On'; }
  function isDTVMode() { return base.getVar('Sources').string === 'DTV'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    // arguments = (action, interval, params, enablePollFn, startImmediately)
    base.setPoll('getPower', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getSource', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getAudioLevel', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getAudioMute', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getChannel', POLL_PERIOD, {}, isConnected, true);

    // Replace source names with nicknames (if configured)
    let sources = base.getVar('Sources').enums;
    sources.forEach( (source_name, i) => {
      const nickname = config[`nickname_${source_name.toLowerCase()}`];
      if (nickname) sources[i] = nickname;
    });
    base.getVar('Sources').enums = sources;
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

    let test = base.getVar('AudioLevel');
    logger.info(test);

    logger.info(`onFrame: ${data}`);
    pendingCommand && logger.info(`pendingCommand: ${pendingCommand.action}`);

    // Parse response after issueing a GET function
    const getFns = [ 'getPower', 'getSource', 'getAudioLevel', 'getAudioMute', 'getChannel' ];
    if ( pendingCommand && getFns.includes(pendingCommand.action) ) {
      match = data.match(/POWR(\d+)/);
      if (match) {
        base.getVar('Power').value = parseInt(match[1]);  // 0 = off, 1 = on
        base.commandDone();
      }

      match = data.match(/INPT0{16}/);
      if (match) {
        base.getVar('Sources').string = 'DTV';
        base.commandDone();
      }

      match = data.match(/INPT0{7}1(\d+)/);
      if (match) {
        base.getVar('Sources').string = `HDMI${parseInt(match[1])}`;
        base.commandDone();
      }

      match = data.match(/VOLU(\d+)/);
      if (match) {
        base.getVar('AudioLevel').value = parseInt(match[1]);
        base.commandDone();
      }

      match = data.match(/AMUT(\d+)/);
      if (match) {
        base.getVar('AudioMute').value = parseInt(match[1]);  // 0 = unmute, 1 = mute
        base.commandDone();
      }

      match = data.match(/CHNN(\d+)\./);  // Ignores values after decimal point
      if (match) {
        base.getVar('Channel').value = parseInt(match[1]);
        base.commandDone();
      }
    }


    // Parse response after issueing a SET function
    const setFns = [ 'setPower', 'selectSource', 'setAudioLevel', 'setAudioMute', 'setChannel', 'shiftChannel' ];
    if ( pendingCommand && setFns.includes(pendingCommand.action) ) {
      match = data.match(/POWR0{16}/);
      if (match) {
        base.getVar('Power').string = pendingCommand.params.Status;
        base.commandDone();
      }

      match = data.match(/INPT0{16}/);
      if (match) {
        base.getVar('Sources').string = pendingCommand.params.Name;
        base.commandDone();
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
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getPower() {
    sendDefer('*SEPOWR################\n');
  }

  function getSource() {
    isOn() && sendDefer('*SEINPT################\n');
  }

  function getAudioLevel() {
    isOn() && sendDefer('*SEVOLU################\n');
  }

  function getAudioMute() {
    isOn() && sendDefer('*SEAMUT################\n');
  }

  function getChannel() {
    isOn() && isDTVMode() && sendDefer('*SECHNN################\n');
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
    if (config.simulation) {
      if (isDTVMode()) base.getVar('Channel').value = params.Name;
      else logger.error('Cannot change channel unless set to DTV mode');
      return;
    }

    if (isDTVMode()) {
      let channel = params.Name.toString().padStart(8, '0');
      sendDefer(`*SCCHNN${channel}.0000000\n`);
    }
    else {
      logger.error('Cannot change channel unless set to DTV mode');
    }
  }

  function shiftChannel(params) {
    if (config.simulation) {
      let delta = params.Name === 'Up' ? 1 : params.Name === 'Down' ? -1 : 0;
      if (isDTVMode()) base.getVar('Channel').value += delta;
      else logger.error('Cannot change channel unless set to DTV mode');
      return;
    }

    if (isDTVMode()) {
      if (params.Name == 'Up') sendDefer('*SCIRCC0000000000000033\n');
      else if (params.Name == 'Down') sendDefer('*SCIRCC0000000000000034\n');
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