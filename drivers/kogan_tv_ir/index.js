let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  const setup = _config => {
    config = _config
    base.setPoll('Keep Alive', 6000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  let ir_commands = require('./ir_codes.js')

  const sendCommand = params => {
    let ircode = ir_commands[params.Name.toUpperCase().replace(/ /g, '_')]
    if (ircode) {
      //base.getVar("Commands").string = params.Name;
      sendDefer(`sendir,${config.module}:${config.ir_port},${ircode}\r`)
    }
    else {
      logger.debug('Wrong command variable sent to function Send Command()')
    }
  }

  const keepAlive = () => sendDefer('A\r')

  const onFrame = data => {
    logger.silly(`onFrame ${data}`)
    base.commandDone()
  }

  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly('TCPClient connected')
        base.getVar('Status').string = 'Connected'
      })

      tcpClient.on('data', data => {
        data = data.toString()
        logger.silly(`TCPClient data: ${data}`)
        onFrame(data)
      })

      tcpClient.on('close', () => {
        logger.silly('TCPClient closed')
        disconnect()
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`)
        disconnect()
      })
    }
  }

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer(1000)
    }
    else {
      base.commandError('Data not sent')
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const disconnect = () => {
    //base.getVar('Status').string = 'Disconnected'
    //tcpClient && tcpClient.end()
  }

  return {
    setup, start, stop, tick, keepAlive,
    sendCommand
  }
}