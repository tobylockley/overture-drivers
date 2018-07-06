let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let commsClient
  let commsType
  let Telnet = require('telnet-client')

  let frameParser = host.createFrameParser()
  frameParser.on('data', data => onFrame(data))

  base.setTickPeriod(5000)

  const setup = _config => {
    config = _config
    if (config.interface === 'GlobalCache') {
      commsType = 'tcp'
      frameParser.setSeparator('\r\n')
    }
    else if (config.interface === 'Zyper') {
      commsType = 'telnet'
      frameParser.setSeparator('Zyper$')
    }

    base.setPoll({
      action: 'keepAlive',
      period: 30000,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected' }
    })
  }

  const start = () => {
    initComms();
    if (commsType === 'tcp') commsClient.connect({host: config.host, port: config.port})
    else if (commsType === 'telnet') commsClient.connect({ host: config.host, port: config.port, timeout: 60000, initialLFCR: true })
  }

  const stop = () => {
    disconnect();
    commsClient && commsClient.end()
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  const tick = () => {
    if (base.getVar('Status').string == 'Disconnected') initComms();
  }

  const initComms = () => {
    if (!commsClient) {
      if (commsType === 'tcp') {
        commsClient = host.createTCPClient()
        commsClient.setOptions({
          autoReconnectionAttemptDelay: 5000,
          receiveTimeout: 60000
        })
      }
      else if (commsType === 'telnet') commsClient = new Telnet()

      commsClient.on('connect', () => {
        logger.silly(`commsClient (${commsType}) connected`)
        base.getVar('Status').string = 'Connected'
        base.startPolling()
      })

      commsClient.on('data', data => {
        data = data.toString()
        frameParser.push(data)
      })

      commsClient.on('close', () => {
        logger.silly(`commsClient (${commsType}) closed`)
        disconnect()
      })

      commsClient.on('error', err => {
        logger.error(`commsClient: (${commsType}) ${err}`)
        disconnect()
        commsClient && commsClient.end()
      })
    }
  }

  const send = (data) => {
    logger.silly(`commsClient (${commsType}) send: ${data}`)
    if (commsType === 'tcp') {
      return commsClient && commsClient.write(data)
    }
    else if (commsType === 'telnet') {
      return commsClient && commsClient.send(`send ${config.zyper_device} rs232 ${data}`)
    }
  }

  const sendDefer = data => {
    logger.silly(`commsClient (${commsType}) sendDefer: ${data}`)
    if (config.interface === 'GlobalCache') {
      if (send(data)) {
        base.commandDefer(3000)
      } else {
        base.commandError(`sendDefer ... Data not sent: ${data}`)
      }
    }
    else if (config.interface === 'Zyper') {
      base.commandDefer(3000)
      commsClient.send(`send ${config.zyper_device} rs232 ${data}\r\n`).then(result => {
        // Handled in onFrame
        // logger.silly(`Telnet send OK: ${data}`)

        // RS232 Response data currently not functioning for zyper device, this is a workaround
        let match = data.match(/switch to (HDMI\d)/)
        if (match) {
          base.commandDone()
          base.getVar('Sources').string = match[1]
        }
      }, err => {
        base.commandError(`Telnet send error: ${err}`)
      })
    }


  }

  const onFrame = data => {
    logger.silly(`onFrame: ${data}`)
    // Feedback Example - [CMD]: switch to HDMI1.
    let match = data.match(/switch to (HDMI\d)/)
    if (match) {
      base.getVar('Sources').string = match[1]
      base.commandDone()
    }
  }

  const keepAlive = () => {
    sendDefer(`A`);  // Send rubbish to keep the connection alive
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