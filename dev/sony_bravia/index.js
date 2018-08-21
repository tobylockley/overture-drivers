'use strict';

const CMD_DEFER_TIME = 1000;
const TICK_PERIOD = 5000;
const POLL_PERIOD = 5000;
const TCP_TIMEOUT = 30000;
const TCP_RECONNECT_DELAY = 3000;

let host;
exports.init = _host => {
  host = _host;
}

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let tcpClient;
  let getFlag = false;

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\n');
  frameParser.on('data', data => onFrame(data));


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' };

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    base.setPoll('getPower', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getSource', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getAudioLevel', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getAudioMute', POLL_PERIOD, {}, isConnected, true);
    base.setPoll('getChannel', POLL_PERIOD, {}, isConnected, true);
  }

  function start() {
    initTcpClient();
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected';
    tcpClient && tcpClient.end();
    tcpClient = null;
  }

  function tick() {
    !tcpClient && initTcpClient();
  }

  function initTcpClient() {
    if (tcpClient) return;  // Ignore if tcpClient already exists

    tcpClient = host.createTCPClient();
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
    });
    tcpClient.connect(config.port, config.host);

    tcpClient.on('connect', () => {
      logger.silly(`TCPClient connected`);
      base.getVar('Status').string = 'Connected';
      base.startPolling();
    });

    tcpClient.on('data', data => {
      frameParser.push( data.toString() );
    });

    tcpClient.on('close', () => {
      logger.silly(`TCPClient closed`);
      base.getVar('Status').string = 'Disconnected';
    });

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`);
      stop();  // Throw out the tcpClient
    });
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`TCPClient send: ${data}`);
    return tcpClient && tcpClient.write(data);
  }

  function sendDefer(data) {
    if (send(data)) base.commandDefer(CMD_DEFER_TIME);
    else base.commandError(`Data not sent`);
  }

  function onFrame(data) {
    base.commandDone();
    let match;
    if (getFlag || data[2] == 'N') {  // 'N' means the device is notifying after a change
      match = data.match(/POWR(\d+)/);
      match && (base.getVar('Power').value = parseInt(match[1]));

      match = data.match(/INPT0{16}/);
      match && (base.getVar('Sources').string = 'DTV');

      match = data.match(/INPT0{7}1(\d+)/);
      match && (base.getVar('Sources').string = `HDMI${parseInt(match[1])}`);

      match = data.match(/VOLU(\d+)/);
      match && (base.getVar('AudioLevel').value = parseInt(match[1]));

      match = data.match(/AMUT(\d+)/);
      match && (base.getVar('AudioMute').string = (parseInt(match[1]) == 1) ? 'On' : 'Off');

      match = data.match(/CHNN(\d+)\./);
      match && (base.getVar('Channel').value = parseInt(match[1]));

      getFlag = false;
    }

    const pendingCommand = base.getPendingCommand();
    logger.info(`Pending: ${pendingCommand.action}`)
    if (pendingCommand) {
      switch (pendingCommand.action) {
        case 'Get Brightness': base.getVar('Brightness').value = value; break;
        case 'Get Temperature': base.getVar('Temperature').value = value; break;
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
    base.getVar('Sources').string === 'DTV' && sendDefer('*SECHNN################\n');
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function setPower(params) {
    if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n');
  }

  function shiftChannel(params) {
    if (params.Name == 'DTV') sendDefer('*SCINPT0000000000000000\n');
    else {
      let match = params.Name.match(/HDMI(\d)/);
      match && sendDefer(`*SCINPT000000010000000${match[1]}\n`);
    }
  }

  function shiftChannel(params) {
    let vol = params.Level.toString().padStart(3, '0');
    sendDefer(Buffer.from(`*SCVOLU0000000000000${vol}\n`));
  }

  function shiftChannel(params) {
    if (params.Status == 'Off') sendDefer('*SCAMUT0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCAMUT0000000000000001\n');
  }

  function shiftChannel(params) {
    if (base.getVar('Sources').string == 'DTV') {
      let channel = params.Name.toString().padStart(8, '0');
      sendDefer(`*SCCHNN${channel}.0000000\n`);
    }
  }

  function shiftChannel(params) {
    if (base.getVar('Sources').string == 'DTV') {
      if (params.Name == 'Up') sendDefer(`*SCIRCC0000000000000033\n`);
      else if (params.Name == 'Down') sendDefer(`*SCIRCC0000000000000034\n`);
    }
  }

  return {
    setup, start, stop, tick,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel, shiftChannel,
    getPower, getSource, getAudioLevel, getAudioMute, getChannel
  }
}