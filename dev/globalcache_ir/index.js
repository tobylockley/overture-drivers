'use strict';

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 30000;           // Continuous polling function interval
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


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);
    base.setPoll({ action: 'keepAlive', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });

    // Construct commands enum
    let cmd_enums = base.getVar('Commands').enums;
    for (let cmd of config.commands) {
      cmd_enums.push(cmd.name);
    }
    base.getVar('Commands').enums = cmd_enums;
  }

  function start() {
    initTcpClient();
  }

  function stop() {
    //Clear pending commands?
    // base.clearPendingCommands();
    base.getVar('Status').string = 'Disconnected';
    tcpClient && tcpClient.end();
    tcpClient = null;
  }

  function tick() {
    if (!tcpClient) initTcpClient();
  }

  function initTcpClient() {
    if (tcpClient) return;  // Return if tcpClient already exists

    tcpClient = host.createTCPClient();
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
    });

    tcpClient.on('connect', () => {
      logger.silly('TCPClient connected');
      base.getVar('Status').string = 'Connected';
      base.startPolling();
    });

    tcpClient.on('data', data => {
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

    // Finally, initiate connection
    tcpClient.connect(config.port, config.host);
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`TCPClient send: ${data}`);
    return tcpClient && tcpClient.write(data);
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME);
    if (!send(data)) base.commandError('Data not sent');
  }

  function onFrame(data) {
    logger.silly(`Frame received: ${data}`);
    base.commandDone();
  }

  function sendCommand(params) {
    let search = config.commands.filter(cmd => cmd.name === params.Name);
    if (search.length === 1) {
      sendDefer(`sendir,${config.module}:${config.ir_port},${search[0].ir_code}\r`);
    }
    else if (search.length > 1) {
      logger.error(`Function sendCommand(): Multiple commands configured for '${params.Name}', please check device configuration.`);
    }
    else {
      logger.error(`Function sendCommand() could not find '${params.Name}' in configured commands.`);
    }
  }

  function keepAlive() {
    sendDefer('getversion\r');
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------

  return {
    setup, start, stop, tick,
    keepAlive, sendCommand
  };
};