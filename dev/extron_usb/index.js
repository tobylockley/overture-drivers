let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\r\n')
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config
    base.createVariable({
      name: 'UsbInput',
      type: 'integer',
      min: 0,
      max: config.inputs,
      perform: {
        action: 'Select Input',
        params: {
          Input: '$value'
        }
      }
    })
    base.setPoll('Get Input', 5000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect();
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()
      tcpClient.setOptions({
        autoReconnectionAttemptDelay: 5000,
        receiveTimeout: 60000
      })

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string =  'Connected'
      })

      tcpClient.on('data', data => {
        onFrame(data)
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`)
        disconnect()
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`)
        disconnect()
        tcpClient && tcpClient.end()
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

  const onFrame = data => {
    logger.silly(`onFrame: ${data}`)

    if (data.match(/E\d+/)) {
      base.commandError()
    }
    else {
      // The following syntax is the same for both selectInput and getInput response (see doc)
      let match = data.match(/Chn(d+)/)
      match && (base.getVar('UsbInput').value = parseInt(match[1]))
    }
  }

  const getInput = () => {
    sendDefer('I')
  }

  const selectInput = params => {
    sendDefer(`${params.Input}!`)
  }

  return {
    setup, start, stop,
    getInput, selectInput
  }
}