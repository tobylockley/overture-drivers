'use strict';

const CMD_DEFER_TIME = 3000; // Timeout when using commandDefer
const TICK_PERIOD = 5000; // In-built tick interval
const POLL_PERIOD = 20000; // Continuous polling interval used for keepAlive
const TCP_TIMEOUT = 30000; // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000; // How long to wait before attempting to reconnect

let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let tcpClient;
  const ir_codes = require('./ir_codes.json');

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() {
    return base.getVar('Status').string === 'Connected';
  }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    base.setPoll({
      action: 'keepAlive',
      period: POLL_PERIOD,
      enablePollFn: isConnected,
      startImmediately: true
    });

    base.getVar('IR_Commands').enums = ['Idle'].concat(Object.keys(ir_codes));
  }

  function start() {
    initTcpClient();
  }

  function stop() {
    base.clearPendingCommands();
    base.getVar('Status').string = 'Disconnected';
    tcpClient && tcpClient.end();
    tcpClient = null;
  }

  function tick() {
    if (!tcpClient) initTcpClient();
  }

  function initTcpClient() {
    if (tcpClient) return; // Return if tcpClient already exists

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
      onFrame(data.toString());
    });

    tcpClient.on('close', () => {
      logger.silly('TCPClient closed');
      base.getVar('Status').string = 'Disconnected'; // Triggered on timeout, this allows auto reconnect
    });

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`);
      stop(); // Throw out the tcpClient and get a fresh connection
    });
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
    const pendingCommand = base.getPendingCommand();
    if (pendingCommand && pendingCommand.action === 'sendCommand') {
      const cmdName = base.getVar('IR_Commands').enums[
        pendingCommand.params.Index
      ];
      logger.silly(`pendingCommand: ${cmdName}  -  received: ${data}`);
      base.getVar('IR_Commands').value = 0; // Set back to idle
      base.commandDone();
    }
    if (pendingCommand && pendingCommand.action === 'keepAlive') {
      base.commandDone();
    }
  }

  // ------------------------------ DEVICE FUNCTIONS ------------------------------

  function sendCommand(params) {
    let name = base.getVar('IR_Commands').enums[params.Index];
    let code = ir_codes[name];
    if (code) {
      base.getVar('IR_Commands').value = params.Index;
      sendDefer(`sendir,${config.module}:${config.ir_port},${code}\r`);
      setTimeout(function() {
        let v = base.getVar('IR_Commands');
        if (v.value !== 0) v.value = 0; // Set back to idle
      }, 1);
    } else {
      logger.error(
        `Invalid command index sent to function sendCommand: ${params.Index}`
      );
    }
  }

  function keepAlive() {
    sendDefer('getversion\r');
  }

  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup,
    start,
    stop,
    tick,
    sendCommand,
    keepAlive
  };
};
