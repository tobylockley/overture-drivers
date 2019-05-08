// A minimal telnet template using the in-built node 'net' module
// Send messages out to socket, and handle responses in onFrame()

'use strict';

const TICK_PERIOD = 5000;
const POLL_PERIOD = 10000;
const TELNET_TIMEOUT = 30000;  // Socket will timeout after specified milliseconds of inactivity
const CMD_DEFER = 1000;

let host;
exports.init = _host => {
  host = _host;
}

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;

  let net = require('net');
  let telnetClient;  // A net.Socket will be attached to this

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\r\n');
  frameParser.on('data', data => onFrame(data));

  const isConnected = () => { return base.getVar('Status').string === 'Connected'; }

  const setup = _config => {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    base.setPoll({
      action: 'getSource',
      period: POLL_PERIOD,
      enablePollFn: isConnected,
      startImmediately: true
    });

  }

  const start = () => {
    initTelnetClient();
  }

  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
    if (telnetClient) {
      telnetClient.destroy();
      telnetClient = null;
    }
  }

  const tick = () => {
    !telnetClient && initTelnetClient();
  }

  const initTelnetClient = () => {
    if (!telnetClient) {
      logger.debug(`Initialising telnet connection to: ${config.host}:${config.port}`);
      telnetClient = net.createConnection({
        host: config.host,
        port: config.port
      });
      telnetClient.setTimeout(TELNET_TIMEOUT);

      telnetClient.on('connect', () => {
        logger.debug('Telnet connected!');
        base.getVar('Status').string = 'Connected';
        base.startPolling();
      });

      telnetClient.on('data', chunk => {
        frameParser.push(chunk.toString());
      });

      telnetClient.on('close', function () {
        logger.debug('Telnet closed');
        stop();
      });

      telnetClient.on('error', err => {
        base.commandError();
        logger.error(`telnetClient: ${err}`);
        stop();
      });
    }
  }

  const send = data => {
    logger.silly(`Telnet send: ${data}`);
    telnetClient.write(`${data}\r\n`);
  }

  const sendDefer = data => {
    logger.silly(`Telnet sendDefer: ${data}`);
    base.commandDefer(CMD_DEFER);
    telnetClient.write(`${data}\r\n`);
  }

  const onFrame = data => {
    let match;  // Used for regex matching
    logger.silly(`onFrame: ${data}`);

    match = data.match(/HDMI(\d+?)/)
    if (match) {
      base.commandDone();
      base.getVar('Source').value = match[1];
    }
  }

  const getSource = params => {
    sendDefer(`HDMI?`);
  }

  return {
    setup, start, stop, tick,
    getInfo
  }
}