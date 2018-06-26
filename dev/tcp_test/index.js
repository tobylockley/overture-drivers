let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  let tcpport = 4998
  let tcphost = "192.168.1.123"

  const setup = _config => {
    config = _config
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(tcpport, tcphost)
    //base.startPolling()
    base.setTickPeriod(2000)
  }

  const stop = () => {
    disconnect()
  }

  const disconnect = () => {
    logger.silly(`TCPClient disconnected`)
    base.getVar('Status').string = 'Disconnected'
    //tcpClient && tcpClient.end()
  }

  function tick() {
    logger.silly(`TICK: tcpClient is connected? ${tcpClient.isConnected()}`)
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()
      tcpClient.setOptions({
        autoReconnectionAttemptDelay: 5000,
        receiveTimeout: 20000,
        keepAlive: true,
        keepAliveInitialDelay: 0
      })

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string =  'Connected'
      })

      tcpClient.on('data', data => {
        logger.silly(`onFrame data: ${data}`)
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`)
        disconnect()
      })

      tcpClient.on('end', () => {
        logger.silly(`TCPClient end`)
      })

      tcpClient.on('timeout', () => {
        logger.silly(`TCPClient timeout`)
      })

      tcpClient.on('drain', () => {
        logger.silly(`TCPClient write buffer empty`)
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`)
        disconnect()
      })
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer(1000)
    } else {
      base.commandError(`Data not sent`)
    }
  }
  
  const setPower = params => {
    logger.silly(`Set Power: ${params.Status}`)
    sendDefer("A\r")
  }

  return {
    setup, start, stop, tick,
    setPower
  }
}