const TICK_PERIOD = 10000
const POLL_PERIOD = 5000
const CMD_DEFER_TIME = 1000
const TCP_TIMEOUT = 60000
const TCP_RECONNECT_DELAY = 5000


var host
exports.init = _host => {
  host = _host
}


exports.createDevice = base => {
  const logger = base.logger || host.logger
  var config
  var tcpClient

  var frameParser = host.createFrameParser()
  frameParser.setSeparator('\n')
  frameParser.on('data', data => onFrame(data))


  const setup = _config => {
    config = _config
    base.setTickPeriod(TICK_PERIOD);

    base.setPoll({
      action: 'getPower',
      period: POLL_PERIOD,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected'; }
    });
  }


  const start = () => {
    initTcpClient();
  }


  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
    if (tcpClient) {
      tcpClient.end();
      tcpClient = null;
    }
  }


  const tick = () => {
    !tcpClient && initTcpClient();
  }


  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient();
      tcpClient.setOptions({
        autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY,
        receiveTimeout: TCP_TIMEOUT
      })
      tcpClient.connect(config.port, config.host);

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`);
        base.getVar('Status').string = 'Connected';
        base.startPolling();
      })

      tcpClient.on('data', data => {
        frameParser.push(data.toString());
        // logger.silly(`TCPClient data: ${data}`)
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`);
        base.getVar('Status').string = 'Disconnected';
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`);
        stop();
      })
    }
  }


  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }


  const sendDefer = data => {
    base.commandDefer(CMD_DEFER_TIME);
    if (!send(data)) base.commandError(`Data not sent`);
  }


  const onFrame = data => {
    let match = data.match(/POWR(\d+)/)
    if (match) {
      base.commandDone()  // Call this when a command response is recognised
      base.getVar('Power').string = (parseInt(match[1]) == 1) ? 'On' : 'Off'
    }
    else {
      base.commandError()  // Call this when something goes wrong
    }
  }


  const getPower = () => {
    sendDefer(Buffer.from("*SEPOWR################\n"));
  }


  const setPower = params => {
    if (params.Status == 'Off') sendDefer(Buffer.from(`*SCPOWR0000000000000000\n`))
    else if (params.Status == 'On') sendDefer(Buffer.from(`*SCPOWR0000000000000001\n`))
  }


  return {
    setup, start, stop, tick,
    getPower,
    setPower
  }
}