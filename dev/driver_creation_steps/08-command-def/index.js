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
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
  }

  const stop = () => {
    disconnect()
  }

  const setPower = params => {
    sendDefer(`!Power ${params.Status}\r`)
  }

  const selectSource = params => {
    sendDefer(`!Source ${params.Name}\r`)
  }

  const setAudioLevel = params => {
    sendDefer(`!Level ${params.Level}\r`)
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string =  'Connected'
      })

      tcpClient.on('data', data => {
        data = data.toString()
        logger.silly(`TCPClient data: ${data}`)
        onFrame(data)
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`)
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
      base.commandDefer()
    } else {
      base.commandError(`Data not sent`)
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const onFrame = data => {
    base.commandDone()
    logger.silly(`onFrame ${data}`)
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
  }

  return {
    setup, start, stop,
    setPower, selectSource, setAudioLevel,
  }
}