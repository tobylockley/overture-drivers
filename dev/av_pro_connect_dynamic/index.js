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
    base.setPoll('Get All Outputs', 10000)
    let inputs
    let outputs
    if (config.model == "MX42") {
      inputs = 4
      outputs = 2
    }
    else if (config.model == "MX44") {
      inputs = 4
      outputs = 4
    }
    else if (config.model == "MX88") {
      inputs = 8
      outputs = 8
    }

    for (let i = 1; i <= outputs; i++) {
      base.createVariable({
        name: `Output${i}`,
        type: 'integer',
        min: 1,
        max: inputs,
        perform: {
          action: 'Set Output',
          params: {
            Output: i,
            Input: '$value'
          }
        }
      })
    }
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  const getAllOutputs = () => {
    sendDefer('GET OUT0 VS\r\n');  // Get all outputs
  }

  const getOutput = params => {
    sendDefer(`GET OUT${params.Output} VS\r\n`);
  }

  const setOutput = params => {
    logger.debug(`Connecting Input${params.Input} to Output${params.Output}`);
    sendDefer(`SET OUT${params.Output} VS IN${params.Input}\r\n`);
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
        //logger.silly(`TCPClient data: ${data}`)
        frameParser.push(data)
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

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
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
    logger.silly(`onFrame ${data}`)
    match = data.match(/OUT(\d).*IN(\d)/i)
    if (match) {
      base.getVar(`Output${match[1]}`).value = parseInt(match[2])
      base.commandDone()
    }
  }

  return {
    setup, start, stop,
    getAllOutputs, getOutput, setOutput
  }
}


