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
  }

  function start() {
    initTcpClient();
  }

  function tick() {
    !tcpClient && initTcpClient();
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
    let parsed = false;  // Set to true when a matching result is found
    const pendingCommand = base.getPendingCommand();

    logger.info(`onFrame: ${data}`)
    pendingCommand && logger.info(`pendingCommand: ${pendingCommand.action}`)

    // Parse response after issueing a GET function
    if ( pendingCommand && pendingCommand.action.match(/GET/i) ) {
      match = data.match(/POWR(\d+)/);
      if (match) {
        base.getVar('Power').value = parseInt(match[1]);  // 0 = off, 1 = on
        parsed = true;
      }

      match = data.match(/INPT0{16}/);
      if (match) {
        base.getVar('Sources').string = 'DTV';
        parsed = true;
      }

      match = data.match(/INPT0{7}1(\d+)/);
      if (match) {
        base.getVar('Sources').string = `HDMI${parseInt(match[1])}`;
        parsed = true;
      }

      match = data.match(/VOLU(\d+)/);
      if (match) {
        base.getVar('AudioLevel').value = parseInt(match[1]);
        parsed = true;
      }

      match = data.match(/AMUT(\d+)/);
      if (match) {
        base.getVar('AudioMute').value = parseInt(match[1]);  // 0 = unmute, 1 = mute
        parsed = true;
      }

      match = data.match(/CHNN(\d+)\./);  // Ignores values after decimal point
      if (match) {
        base.getVar('Channel').value = parseInt(match[1]);
        parsed = true;
      }
    }

    // Parse response after issueing a SET function
    if ( pendingCommand && pendingCommand.action.match(/SET/i) ) {
      if ( data.match(/SA\w{4}0{16}/) ) {
        parsed = true;  // This is a "success" response after a SET command
      }
    }

    // Handle commandDefer
    if (parsed) {
      base.commandDone();
    }
    else {
      base.commandError('Unexpected TCP response');
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
    if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n');
  }

  function selectSource(params) {
    if (params.Name == 'DTV') sendDefer('*SCINPT0000000000000000\n');
    else {
      let match = params.Name.match(/HDMI(\d)/);
      match && sendDefer(`*SCINPT000000010000000${match[1]}\n`);
    }
  }

  function setAudioLevel(params) {
    let vol = params.Level.toString().padStart(3, '0');  // Formats the integer with leading zeroes, e.g. 53 = '053'
    sendDefer(Buffer.from(`*SCVOLU0000000000000${vol}\n`));
  }

  function setAudioMute(params) {
    if (params.Status == 'Off') sendDefer('*SCAMUT0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCAMUT0000000000000001\n');
  }

  function setChannel(params) {
    if (base.getVar('Sources').string == 'DTV') {
      let channel = params.Name.toString().padStart(8, '0');
      sendDefer(`*SCCHNN${channel}.0000000\n`);
    }
    else {
      logger.error('Cannot set channel unless set to DTV mode');
    }
  }

  function shiftChannel(params) {
    if (base.getVar('Sources').string == 'DTV') {
      if (params.Name == 'Up') sendDefer('*SCIRCC0000000000000033\n');
      else if (params.Name == 'Down') sendDefer('*SCIRCC0000000000000034\n');
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getPower, getSource, getAudioLevel, getAudioMute, getChannel,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel, shiftChannel
  };
};