let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  let frameParser = host.createFrameParser()
  let buffer_string

  base.setTickPeriod(5000)

  // frameParser.setSeparator('\n')
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config
    // base.setPoll('Get Power', 5000)
    // base.setPoll('Get Source', 5000)
    // base.setPoll('Get Audio Level', 5000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
  }

  const stop = () => {
    disconnect()
  }

  const startPolling = () => {
    // base.perform('Get Power')
    // base.perform('Get Source')
    // base.perform('Get Audio Level')
    base.startPolling()
  }

  const recallPreset = (params) => {

    var preset = params.Name.replace(/\D/g, '')
    var preset_hex = parseInt(preset, 16) - 0x01;
    var buf = Buffer.from([0xF1, 0x02, 0x00, preset_hex])

    sendDefer(buf);
  }

  const setAudioLevel1 = params => {
    var buf = Buffer.from([0x91, 0x03, 0x01, 0x00, params.Level])
    sendDefer(buf);
  }

  const setAudioLevel2 = params => {
    var buf = Buffer.from([0x91, 0x03, 0x01, 0x01, params.Level])
    sendDefer(buf);
  }


  const onFrame = data => {
    logger.silly(`onFrame ${data}`)
    base.commandDone()


    if (buffer_string[0] == 0xF1) {
      base.getVar("Presets").value = buffer_string[3]

    }

    else if ((buffer_string[0] == 0x91) && (buffer_string[3] == 0x00)) {
      base.getVar("AudioLevel1").value = buffer_string[4]
    }

    else if ((buffer_string[0] == 0x91) && (buffer_string[3] == 0x01)) {
      base.getVar("AudioLevel2").value = buffer_string[4]
    }

  }
  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
        startPolling()
      })

      tcpClient.on('data', data => {
        data = data.toString()
        buffer_string = Buffer.from(data)
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
      base.commandDefer(500)
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


  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }


  return {
    setup, start, stop,
    recallPreset, tick, setAudioLevel2, setAudioLevel1
  }
}