

const CMD_DEFER_TIME = 1000
const TICK_PERIOD = 5000
const POLL_PERIOD = 30000


let host
exports.init = _host => {
  host = _host;
}


exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config
  let comms
  let frameParser = host.createFrameParser();
  frameParser.on('data', data => onFrame(data));


  const setup = _config => {
    config = _config
    comms = require(`./${config.interface}`);
    frameParser.setSeparator(comms.FRAME_SEPARATOR);
    base.setPoll({
      action: 'keepAlive',
      period: POLL_PERIOD,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected' }
    });
    base.setTickPeriod(TICK_PERIOD);
  }


  const start = () => {
    comms.init(host, base, config, logger);
  }


  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
    if (commsClient) {
      commsClient.end();
      commsClient = null;
    }
  }


  const tick = () => {
    initComms();
  }


  const initComms = () => {
    commsClient.initComms(host, config);
    if (!commsClient) {
      if (config.interface === 'GlobalCache') {
        commsClient = host.createTCPClient();
        commsClient.setOptions({
          autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY,
          receiveTimeout: TCP_TIMEOUT
        });
        commsClient.connect({host: config.host, port: config.port});
      }
      else if (config.interface === 'Zyper') {
        commsClient = new Telnet();
        commsClient.connect({ host: config.host, port: config.port, timeout: TELNET_TIMEOUT, initialLFCR: true });
      }

      commsClient.on('connect', () => {
        logger.silly(`commsClient connected`);
        base.getVar('Status').string = 'Connected';
        base.startPolling();
      })

      commsClient.on('data', data => {
        data = data.toString();
        frameParser.push(data);
      })

      commsClient.on('close', () => {
        logger.silly(`commsClient closed`);
        base.getVar('Status').string = 'Disconnected';
      })

      commsClient.on('error', err => {
        logger.error(`commsClient: ${err}`);
        stop();
      })
    }
  }


  const send = (data) => {
    logger.silly(`send: ${data}`);
    return commsClient.send(data);
    // else if (config.interface === 'Zyper') {
    //   return commsClient && commsClient.send(`send ${config.zyper_device} rs232 ${data}\r\n`);
    // }
  }


  const sendDefer = data => {
    logger.silly(`sendDefer: ${data}`);
    base.commandDefer(CMD_DEFER_TIME);
    if (!comms.send(data)) base.commandError(`TCP write error!`);
    else if (config.interface === 'Zyper') {
      commsClient.send(`send ${config.zyper_device} rs232 ${data}\r\n`).then(result => {
        // RS232 Response data currently not functioning for zyper device, this is a workaround     !!!!!!!!!!!!!!!!!!!
        let match = data.match(/switch to (HDMI\d)/);
        if (match) {
          base.commandDone();
          base.getVar('Sources').string = match[1];
        }
      }, err => {
        base.commandError(`Telnet send error: ${err}`);
      })
    }
  }


  const onFrame = data => {
    logger.silly(`onFrame: ${data}`);
    // Feedback Example - [CMD]: switch to HDMI1.
    let match = data.match(/switch to (HDMI\d)/);
    if (match) {
      base.getVar('Sources').string = match[1];
      base.commandDone();
    }
  }


  const keepAlive = () => {
    sendDefer('A');  // Send rubbish to keep the tcp connection alive
  }


  const selectSource = params => {
    sendDefer(`${params.Name}%`);
    // TODO: Return information? None for zyper
  }


  return {
    setup, start, stop,
    keepAlive, selectSource
  }
}