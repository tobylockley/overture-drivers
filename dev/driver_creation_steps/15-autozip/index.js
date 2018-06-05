let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config 
  let tcpClient
  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\n')
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config
    base.setPoll('Get Power', 5000)
    base.setPoll('Get Source', 5000)
    base.setPoll('Get Audio Level', 5000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
  }

  const stop = () => {
    disconnect()
  }

  const startPolling = () => {
    base.perform('Get Power')
    base.perform('Get Source')
    base.perform('Get Audio Level')
    base.startPolling()
  }

  const setPower = params => {
    if (base.getVar('Power').enums.includes(params.Status)) {
      sendDefer(`!Power ${params.Status}\r`)
    } else {
      logger.error(`invalid parameter ${params.Status}`)
    }
  }

  const selectSource = params => {
    if (base.getVar('Sources').enums.includes(params.Name)) {
      sendDefer(`!Source ${params.Name}\r`)
    } else {
      logger.error(`invalid parameter ${params.Name}`)
    }
  }

  const setAudioLevel = params => {
    const v = base.getVar('AudioLevel')
    if (params.Level >= v.min  && params.Level < v.max) {
      sendDefer(`!Level ${params.Level}\r`)
    } else {
      logger.error(`invalid parameter ${params.Name}`)
    }
  }

  const getPower = () => sendDefer(`?Power\r`)
  const getSource = () => sendDefer(`?Source\r`)
  const getAudioLevel = () => sendDefer(`?Level\r`)

  const onFrame = data => {
    logger.silly(`onFrame ${data}`)
    base.commandDone()

    let match

    if (!match) {
      match = data.match(/\?Power (\w+)\r/)
      if (match) {
        const string = match[1]
        if (['Off', 'On'].includes(string)) {
          base.getVar('Power').string = string
        } else {
          logger.debug('Invalid response parameter')
        } 
      }
    }

    if (!match) {
      match = data.match(/\?Source (\w+)\r/)
      match && (base.getVar('Sources').string = match[1])
    }

    if (!match) {
      match = data.match(/\?Level (\d+)\r/)
      match && (base.getVar('AudioLevel').value = match[1])
    }
    
    if (!match && data !== 'ACK\r\n') {
      logger.silly('Unknown response')
    }
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string =  'Connected'
        startPolling()
      })

      tcpClient.on('data', data => {
        data = data.toString()
        logger.silly(`TCPClient data: ${data}`)
        frameParser.push(data)
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

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
  }

  return {
    setup, start, stop,
    setPower, selectSource, setAudioLevel, getPower, getSource, getAudioLevel
  }
}