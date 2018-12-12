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

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    base.setPoll({ action: 'getLamp', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
    base.setPoll({ action: 'getFreeze', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
  }

  function start() {
    initTcpClient();
  }

  function tick() {
    if (!tcpClient) initTcpClient();
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
      // frameParser.push( data.toString() );
      onFrame(data);
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

  function sendHex(data) {
    sendDefer(Buffer.concat( [Buffer.from([0xA0]), Buffer.from(data), Buffer.from([0xAF])], data.length + 2 ));  // Add start and end bytes
  }

  function onFrame(data) {
    data = Buffer.from(data);
    if (data.length != 6) logger.error(`Unexpected data packet length, should be 6, received ${data.length}`);

    const pendingCommand = base.getPendingCommand();

    logger.silly(`onFrame: ${data}`);
    pendingCommand && logger.debug(`pendingCommand: ${pendingCommand.action}`);

    if ( data[1] == 0x50 ) {
      // getLamp
      logger.silly(`getLamp response: ${data[2]}`);
      if ( data[2] == 0 ) base.getVar('Lamp').string = 'Off';
      else if ( data[2] == 1 ) base.getVar('Lamp').string = 'Both';
      else if ( data[2] == 2 ) base.getVar('Lamp').string = 'Arm';
      else if ( data[2] == 3 ) base.getVar('Lamp').string = 'Head';
    }
    else if ( data[1] == 0x78 ) {
      // getFreeze
      logger.silly(`getFreeze response: ${data[2]}`);
      if ( data[2] == 0 ) base.getVar('Freeze').string = 'Off';
      else if ( data[2] == 1 ) base.getVar('Freeze').string = 'On';
    }
    else if ( data[1] == 0xC1 ) {
      // setLamp
      logger.silly(`setLamp response: ${data[2]}`);
      if ( data[2] == 0 ) base.getVar('Lamp').string = 'Off';
      else if ( data[2] == 1 ) base.getVar('Lamp').string = 'Both';
      else if ( data[2] == 2 ) base.getVar('Lamp').string = 'Arm';
      else if ( data[2] == 3 ) base.getVar('Lamp').string = 'Head';
    }
    else if ( data[1] == 0x2C ) {
      // setFreeze
      logger.silly(`setFreeze response: ${data[2]}`);
      if ( data[2] == 0 ) base.getVar('Freeze').string = 'Off';
      else if ( data[2] == 1 ) base.getVar('Freeze').string = 'On';
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getLamp() {
    sendHex([0x50, 0x00, 0x00, 0x00]);
  }

  function getFreeze() {
    sendHex([0x78, 0x00, 0x00, 0x00]);
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setLamp(params) {
    if (params.Status == 'Off') sendHex([0xC1, 0x00, 0x00, 0x00]);
    else if (params.Status == 'Arm') sendHex([0xC1, 0x02, 0x00, 0x00]);
    else if (params.Status == 'Head') sendHex([0xC1, 0x03, 0x00, 0x00]);
    else if (params.Status == 'Both') sendHex([0xC1, 0x01, 0x00, 0x00]);
  }

  function setFreeze(params) {
    if (params.Status == 'Off') sendHex([0x2C, 0x00, 0x00, 0x00]);
    else if (params.Status == 'On') sendHex([0x2C, 0x01, 0x00, 0x00]);
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getLamp, getFreeze,
    setLamp, setFreeze
  };
};