

const CMD_DEFER_TIME = 5000
const POLL_PERIOD = 30000
const TICK_PERIOD = 5000
const TELNET_TIMEOUT = 60000


let host
exports.init = _host => {
  host = _host
}


exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let telnetClient
  let zyperLastChangeId = 0;
  let Telnet = require('telnet-client');

  let frameParser = host.createFrameParser();
  frameParser.on('data', data => onFrame(data));
  frameParser.setSeparator('\\r\\n');


  const setup = _config => {
    config = _config
    base.createVariable({
      name: 'UsbHost',
      type: 'integer',
      min: 0,
      max: config.usb_hosts,
      perform: {
        action: 'Select Usb Host',
        params: { Host: '$value' }
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
    !telnetClient && initTelnet();
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
          getUsbHost();  // Update on first connection
        });
      })

      telnetClient.on('data', data => {
        //frameParser.push(data.toString());  // See getUsbHost below
      })

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
    logger.debug(`onFrame: ${data}`)

    if (data.match(/E\d+/)) {
      base.commandError()
    }
    else {
      // The following syntax is the same for both selectUsbHost and getUsbHost response (see doc)
      let match = data.match(/Chn(\d+)/)
      if (match) {
        base.getVar('UsbHost').value = parseInt(match[1]);
      }
    }
  }


  const onFrame_rs232 = data => {
    logger.info(`onFrame_rs232: ${data}`)
  }


  const getUsbHost = () => {
    sendDefer(`send ${config.zyper_device} rs232 I\r\n`, response => {
      sendDefer(`show responses ${config.zyper_device} rs232 since ${zyperLastChangeId}\r\n`, response_rs232 => {
        let match, regex = /device\.rs232Response\.\d+; string="(.*?)"/g;
        while (match = regex.exec(response_rs232)) {
          frameParser.push(match[1]);
        }
        match = response_rs232.match(/lastChangeId\((\d+)\);/)
        match && (zyperLastChangeId = match[1])  // Update last changeId to keep track of responses
      });
    });
  }


  const selectUsbHost = params => {
    sendDefer(`send ${config.zyper_device} rs232 ${params.Host}!\r\n`, response => {
      let match = response.match(/(\d)!/)
      if (match && response.includes('Success')) {
        base.getVar('UsbHost').value = parseInt(match[1]);  // A bit of cheating, the poll will catch errors
      }
    })
  }


  return {
    setup, start, stop, tick,
    getUsbHost, selectUsbHost
  }
}