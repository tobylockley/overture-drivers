'use strict';

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 5000;           // Continuous polling function interval
const TELNET_TIMEOUT = 10000;       // Socket will timeout after specified milliseconds of inactivity
const SEND_TIMEOUT = 1000;          // Timeout when using telnet send function


let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;

  let Telnet = require('telnet-client');
  let telnetClient;

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\n');
  frameParser.on('data', data => onFrame(data));

  const isConnected = () => { return base.getVar('Status').string === 'Connected'; };

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);
    base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
  }

  function start() {
    initTelnetClient();
  }

  function stop() {
    disconnect();
    if (telnetClient) {
      telnetClient.end();
      telnetClient = null;
    }
  }

  function tick() {
    !telnetClient && initTelnetClient();
  }

  function disconnect() {
    base.getVar('Status').string = 'Disconnected';
  }

  function initTelnetClient() {
    if (!telnetClient) {
      telnetClient = new Telnet();
      logger.silly(`Attempting telnet connection to: ${config.host}:${config.port}`);

      telnetClient.connect({
        host: config.host,
        port: config.port,
        timeout: TELNET_TIMEOUT,
        initialLFCR: true,
        sendTimeout: SEND_TIMEOUT
      });

      telnetClient.on('connect', function () {
        logger.silly('Telnet connected!');
        base.getVar('Status').string = 'Connected';
        base.startPolling();
      });

      telnetClient.on('data', (chunk) => {
        frameParser.push(chunk);
      });

      telnetClient.on('close', function () {
        logger.silly('telnet closed');
        stop();
      });

      telnetClient.on('error', err => {
        logger.error(`telnetClient: ${err}`);
        stop();
      });
    }
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME);
    telnetClient.send(data).then(recvd => {
      // Handled in onFrame
      logger.silly(`Telnet send OK (${data}): ${recvd}`);
    }, err => {
      base.commandError(`Telnet send error: ${err}`);
    });
  }

  function onFrame(data) {
    let match;  // Used for regex matching below
    const pendingCommand = base.getPendingCommand();

    logger.silly(`onFrame: ${data}`);
    pendingCommand && logger.debug(`pendingCommand: ${pendingCommand.action}`);

    // Response from polling command
    match = data.match(/something here/);
    if (match) {
      base.commandDone();
    }

    if (pendingCommand && pendingCommand.action == 'getPower') {
      // Parse response after issueing a SET function

      match = data.match(/POWR0{16}(\d+)/);
      if (match) {
        base.getVar('Power').value = match[1];
        base.commandDone();
      }
    }
  }

  function getPower() {
    sendDefer('get power\r\n');
  }

  return {
    setup, start, stop, tick,
    getPower
  };
};