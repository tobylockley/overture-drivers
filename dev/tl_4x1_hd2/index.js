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
  }

  const start = () => { initComms(); }

  const stop = () => { disconnect(); }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    commsClient && commsClient.end()
  }

  const tick = () => { if (base.getVar('Status').string == 'Disconnected') initComms(); }

  const initComms = () => {
    if (!commsClient) {
      if (commsType === 'tcp') commsClient = host.createTCPClient()
      else if (commsType === 'telnet') commsClient = new Telnet()

      commsClient.on('connect', () => {
        logger.silly(`commsClient (${commsType}) connected`)
        base.getVar('Status').string = 'Connected'
        base.startPolling()
      })

      commsClient.on('data', data => {
        data = data.toString()
        logger.silly(`commsClient (${commsType}) data: ${data}`)
        frameParser.push(data)
      })

      commsClient.on('close', () => {
        logger.silly(`commsClient (${commsType}) closed`)
        disconnect()
      })

      commsClient.on('error', err => {
        logger.error(`commsClient: (${commsType}) ${err}`)
        disconnect()
      })
    }

    if (commsType === 'tcp') commsClient.connect({host: config.host, port: config.port})
    else if (commsType === 'telnet') commsClient.connect({ host: config.host, port: config.port, timeout: 30000, initialLFCR: true })
  }

  const send = data => {
    logger.silly(`commsClient (${commsType}) send: ${data}`)
    if (config.interface === 'GlobalCache') return commsClient && commsClient.write(data)
    else if (config.interface === 'Zyper') return commsClient && commsClient.send(`send ${config.zyperDevice} rs232 ${data}`)
  }

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer(2500)
    } else {
      base.commandError(`sendDefer ... Data not sent: ${data}`)
    }
  }

  const onFrame = data => {
    logger.silly(`onFrame: ${data}`)
    base.commandDone()
    // Feedback Example - [CMD]: switch to HDMI1.
    let match = data.match(/switch to (HDMI\d)/)
    match && (base.getVar('Sources').string = match[1])
  }

  const selectSource = params => {
    sendDefer(`${params.Name}%`);
    // TODO: Return information? None for zyper
  }

  return {
    setup, start, stop, tick,
    selectSource
  }
}