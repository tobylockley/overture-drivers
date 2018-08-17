'use strict';

const TICK_PERIOD = 5000;
const POLL_PERIOD = 5000;
const TELNET_TIMEOUT = 30000;  // Socket will timeout after specified milliseconds of inactivity
const SEND_TIMEOUT = 1000;  // Timeout when using telnet send function
const CMD_DEFER = 1000;

let host;
exports.init = _host => {
  host = _host;
}

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let controls = {};  // Lookup table of control number -> variable name

  let Telnet = require('telnet-client');
  let telnetClient;

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('Zyper$');
  frameParser.on('data', data => onFrame(data));

  const isConnected = () => { return base.getVar('Status').string === 'Connected'; }

  const setup = _config => {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    config.levels.forEach(level => {
      base.createVariable({
        name: level.name,
        type: 'integer',
        min: 0,
        max: 100,
        perform: {
          action: 'setLevel',
          params: { Level: '$value', ControlNumber: level.number }
        }
      });

      base.setPoll({
        action: 'getLevel',
        period: POLL_PERIOD,
        enablePollFn: isConnected,
        startImmediately: true,
        params: { ControlNumber: level.number }
      });

      controls[level.number] = level.name;
    });

    config.selectors.forEach(selector => {
      base.createVariable({
        name: selector.name,
        type: 'enum',
        enums: selector.options,
        perform: {
          action: 'setSelector',
          params: { Name: '$string', Index: '$value', ControlNumber: selector.number }
        }
      });

      base.setPoll({
        action: 'getSelector',
        period: POLL_PERIOD,
        enablePollFn: isConnected,
        startImmediately: true,
        params: { ControlNumber: selector.number }
      });

      controls[selector.number] = selector.name;
    });

    config.toggles.forEach(toggle => {
      base.createVariable({
        name: toggle.name,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'setToggle',
          params: { Status: '$value', ControlNumber: toggle.number }
        }
      });

      base.setPoll({
        action: 'getToggle',
        period: POLL_PERIOD,
        enablePollFn: isConnected,
        startImmediately: true,
        params: { ControlNumber: toggle.number }
      });

      controls[toggle.number] = toggle.name;
    });
  }

  const start = () => {
    initTelnetClient();
  }

  const stop = () => {
    disconnect();
    if (telnetClient) {
      telnetClient && telnetClient.end();
      telnetClient = null;
    }
  }

  const tick = () => {
    !telnetClient && initTelnetClient();
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected';
  }

  const initTelnetClient = () => {
    if (!telnetClient) {
      telnetClient = new Telnet();
      logger.silly(`Initialising telnet connection to: ${config.host}:${config.port}`);
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
        logger.silly('Telnet closed');
        stop();
      });

      telnetClient.on('error', err => {
        logger.error(`telnetClient: ${err}`);
        stop();
      });
    }
  }

  const send = data => {
    logger.silly(`Telnet send: ${data}`);
    telnetClient.send(`${data}\r\n`);
  }

  const sendDefer = data => {
    logger.silly(`Telnet sendDefer: ${data}`);
    base.commandDefer(CMD_DEFER);
    telnetClient.send(`${data}\r\n`).then(result => {
      // Handled in onFrame
    }, err => {
      base.commandError(`Telnet send error: ${err}`);
    });
  }

  const setLevel = params => {
    sendDefer(`<L&${params.ControlNumber}&${params.Level}>`);
  }

  const setSelector = params => {
    sendDefer(`<L&${params.ControlNumber}&${params.Index}>`);
  }

  const setToggle = params => {
    sendDefer(`<L&${params.ControlNumber}&${params.Status}>`);
  }

  const getLevel = params => {
    sendDefer(`<L&${params.ControlNumber}>`);
  }

  const getSelector = params => {
    sendDefer(`<S&${params.ControlNumber}>`);
  }

  const getToggle = params => {
    sendDefer(`<T&${params.ControlNumber}>`);
  }

  const onFrame = data => {
    let match  // Used for regex matching
    logger.silly(`onFrame: ${data.replace('\r', '\\r').replace('\n', '\\n')}`)

    match = data.match(/L&(\d+?)&(\d+?)/)
    if (match) {
      base.commandDone();
      base.getVar( controls[match[1]] ).value = Math.floor( parseInt(match[2]) / 10 );
    }

    match = data.match(/S&(\d+?)&(\d+?)/)
    if (match) {
      base.commandDone();
      base.getVar( controls[match[1]] ).value = match[2];
    }

    match = data.match(/T&(\d+?)&(\d+?)/)
    if (match) {
      base.commandDone();
      base.getVar( controls[match[1]] ).value = match[2];
    }
  }

  return {
    setup, start, stop, tick,
    setLevel, setSelector, setToggle,
    getLevel, getSelector, getToggle
  }
}