

const CMD_DEFER_TIME = 1000
const POLL_PERIOD = 10000
const TICK_PERIOD = 5000
const TELNET_TIMEOUT = 60000
const TCP_TIMEOUT = 60000
const TCP_RECONNECT_DELAY = 5000


let host
exports.init = _host => {
  host = _host
}


exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let commsClient
  let zyperLastChangeId = 0;
  let Telnet = require('telnet-client');

  let frameParser = host.createFrameParser();
  frameParser.on('data', data => onFrame(data));

  let frameParser_rs232 = host.createFrameParser();  // Used to process data from zyper rs232 responses
  frameParser_rs232.on('data', data => onFrame_rs232(data));
  frameParser_rs232.setSeparator('\r\n');


  const setup = _config => {
    config = _config
    if (config.interface === 'GlobalCache') frameParser.setSeparator('\r\n');
    else if (config.interface === 'Zyper') frameParser.setSeparator('Zyper$');
    base.createVariable({
      name: 'UsbHost',
      type: 'integer',
      min: 0,
      max: config.usb_hosts,
      perform: {
        action: 'Select Usb Host',
        params: {
          Host: '$value'
        }
      }
    })
    base.setPoll({
      action: 'getUsbHost',
      period: POLL_PERIOD,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected' }
    })
    base.setTickPeriod(TICK_PERIOD);
  }


  const tick = () => {
    !commsClient && initComms();
  }


  const start = () => {
    initComms();
  }


  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
    if (commsClient) {
      commsClient.end();
      commsClient = null;
    }
  }


  const initComms = () => {
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
        frameParser.push(data.toString());
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
    logger.silly(`commsClient send: ${data}`);
    if (config.interface === 'GlobalCache') {
      return commsClient && commsClient.write(data);
    }
    else if (config.interface === 'Zyper') {
      return commsClient && commsClient.send(`send ${config.zyper_device} rs232 ${data}\r\n`);
    }
  }


  const sendDefer = data => {
    logger.silly(`commsClient sendDefer: ${data}`);
    base.commandDefer(CMD_DEFER_TIME);
    if (config.interface === 'GlobalCache') {
      if (!commsClient.write(data)) base.commandError(`TCP write error!`);
    }
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
    logger.silly(`onFrame: ${data}`)

    if (data.match(/E\d+/)) {
      base.commandError()
    }
    else {
      // Process zyper rz232 responses
      if (data.includes('rs232Response')) {
        base.commandDone();
        let match, regex = /device\.rs232Response\.\d+; string="(.*?)"/g;
        while (match = regex.exec(data)) {
          frameParser_rs232.push(match[1]);
        }
      }
      else {
        // The following syntax is the same for both selectUsbHost and getUsbHost response (see doc)
        let match = data.match(/Chn(\d+)/)
        if (match) {
          base.commandDone();
          base.getVar('UsbHost').value = parseInt(match[1]);
        }
      }
    }
  }


  const onFrame_rs232 = data => {
    logger.info(`onFrame_rs232: ${data}`)
  }


  const getUsbHost = () => {
    sendDefer('I');  // Handled in onFrame
    if (config.interface === 'Zyper') {
      // Get response data from zyper
      commsClient.send(`show responses ${config.zyper_device} rs232 since ${zyperLastChangeId}\r\n`).then(result => {
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


  const selectUsbHost = params => {
    sendDefer(`${params.Host}!`)
  }


  return {
    setup, start, stop, tick,
    getUsbHost, selectUsbHost
  }
}