const CMD_DEFER_TIME = 5000
const TICK_PERIOD = 5000
const POLL_PERIOD = 30000
const TELNET_TIMEOUT = 60000


let host
exports.init = _host => {
  host = _host;
}


exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config
  let telnetClient
  let zyperLastChangeId = 0;
  let Telnet = require('telnet-client');

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\\r\\n');  // Separator for zyper rs232 data
  frameParser.on('data', data => onFrame(data));


  const setup = _config => {
    config = _config
    base.setPoll({
      action: 'keepAlive',
      period: POLL_PERIOD,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected' }
    });
    base.setTickPeriod(TICK_PERIOD);
  }


  const start = () => {
    initTelnet();
  }


  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
    if (telnetClient) {
      telnetClient.end();
      telnetClient = null;
    }
  }


  const tick = () => {
    !telnetClient && initTelnet();
  }


  const initTelnet = () => {
    if (!telnetClient) {
      telnetClient = new Telnet();
      telnetClient.connect({ host: config.host, port: config.port, timeout: TELNET_TIMEOUT, initialLFCR: true });

      telnetClient.on('connect', () => {
        logger.silly(`telnetClient connected`);
        base.getVar('Status').string = 'Connected';
        base.startPolling();
        // update the lastChangeId from system
        sendDefer(`show responses ${config.zyper_device} rs232 last-change-id\r\n`, response => {
          match = response.match(/lastChangeId\((\d+)\);/)
          match && (zyperLastChangeId = match[1])  // Update last changeId to keep track of responses
        });
      });

      telnetClient.on('data', data => {
        //frameParser.push(data.toString());  // Being handled in sendDefer callback
      });

      telnetClient.on('close', () => {
        logger.silly(`telnetClient closed`);
        base.getVar('Status').string = 'Disconnected';
      })

      telnetClient.on('error', err => {
        logger.error(`telnetClient: ${err}`);
        stop();
      })
    }
  }


  const send = (data) => {
    logger.silly(`telnetClient send: ${data}`);
    return telnetClient && telnetClient.send(data);
  }


  const sendDefer = (data, callback) => {
    logger.silly(`telnetClient sendDefer: ${data}`);
    base.commandDefer(CMD_DEFER_TIME);
    telnetClient.send(data).then(result => {
      logger.silly(`sendDefer response: ${result}`)
      if (result.includes('Success')) {
        base.commandDone();
        callback(result);
      }
      else base.commandError(`Telnet response error`);
    }, err => {
      base.commandError(`Telnet send error: ${err}`);
    })
  }


  const onFrame = data => {
    logger.silly(`onFrame: ${data}`);
    // Not currently in use - not able to poll switchers for current output
    let match = data.match(/switch to (HDMI\d)/);
    if (match) {
      base.getVar('Sources').string = match[1];
      // base.commandDone();  // Handled in sendDefer
    }
  }


  const keepAlive = () => {
    send('show server config\r\n');  // Send rubbish to keep the tcp connection alive
  }


  const selectSource = params => {
    sendDefer(`send ${config.zyper_device} rs232 ${params.Name}%\r\n`, response => {
      let match = response.match(/(HDMI\d)/);
      if (match) {
        base.getVar('Sources').string = match[1];
        // base.commandDone();  // Handled in sendDefer
      }
    });
  }


  return {
    setup, start, stop,
    keepAlive, selectSource
  }
}