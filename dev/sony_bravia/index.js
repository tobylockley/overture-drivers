let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  let getFlag = false

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\n')
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config
    let poll_period = 5000
    base.setPoll('Get Power', poll_period)
    base.setPoll('Get Source', poll_period)
    base.setPoll('Get Audio Level', poll_period)
    base.setPoll('Get Audio Mute', poll_period)
    base.setPoll('Get Channel', poll_period)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  const startPolling = () => {
    base.perform('Get Power')
    base.perform('Get Source')
    base.perform('Get Audio Level')
    base.perform('Get Audio Mute')
    base.perform('Get Channel')
  }

  const getPower = () => { getFlag = true; sendDefer(Buffer.from("*SEPOWR################\n")); }
  const getSource = () => { getFlag = true; sendDefer(Buffer.from("*SEINPT################\n")); }
  const getAudioLevel = () => { getFlag = true; sendDefer(Buffer.from("*SEVOLU################\n")); }
  const getAudioMute = () => { getFlag = true; sendDefer("*SEAMUT################\n"); }
  const getChannel = () => {
    if (base.getVar('Sources').string == 'DTV') {
      getFlag = true;
      sendDefer("*SECHNN################\n");
    }
  }

  const setPower = params => {
    if (params.Status == 'Off') sendDefer(Buffer.from(`*SCPOWR0000000000000000\n`))
    else if (params.Status == 'On') sendDefer(Buffer.from(`*SCPOWR0000000000000001\n`))
  }

  const selectSource = params => {
    if (params.Name == 'DTV') sendDefer("*SCINPT0000000000000000\n")
    else {
      let match = params.Name.match(/HDMI(\d)/)
      match && sendDefer(`*SCINPT000000010000000${match[1]}\n`)
    }
  }

  const setAudioLevel = params => {
    let vol = params.Level.toString().padStart(3, '0')
    sendDefer(Buffer.from(`*SCVOLU0000000000000${vol}\n`))
  }

  const setAudioMute = params => {
    if (params.Status == 'Off') sendDefer("*SCAMUT0000000000000000\n")
    else if (params.Status == 'On') sendDefer("*SCAMUT0000000000000001\n")
  }

  const setChannel = params => {
    if (base.getVar('Sources').string == 'DTV') {
      let channel = params.Name.toString().padStart(8, '0')
      sendDefer(Buffer.from(`*SCCHNN${channel}.0000000\n`))
    }
  }

  const shiftChannel = params => {
    if (base.getVar('Sources').string == 'DTV') {
      if (params.Name == 'Up') sendDefer(Buffer.from(`*SCIRCC0000000000000033\n`))
      else if (params.Name == 'Down') sendDefer(Buffer.from(`*SCIRCC0000000000000034\n`))
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

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const sendDefer = data => {
    if (send(data)) base.commandDefer(1000)
    else base.commandError(`Data not sent`)
  }

  const onFrame = data => {
    base.commandDone()
    let match
    if (getFlag || data[2] == 'N') {  // 'N' means the device is notifying after a change
      match = data.match(/POWR(\d+)/)
      match && (base.getVar('Power').string = (parseInt(match[1]) == 1) ? 'On' : 'Off')
      
      match = data.match(/INPT0{16}/)
      match && (base.getVar('Sources').string = 'DTV')
      
      match = data.match(/INPT0{7}1(\d+)/)
      match && (base.getVar('Sources').string = `HDMI${parseInt(match[1])}`)
      
      match = data.match(/VOLU(\d+)/)
      match && (base.getVar('AudioLevel').value = parseInt(match[1]))
      
      match = data.match(/AMUT(\d+)/)
      match && (base.getVar('AudioMute').string = (parseInt(match[1]) == 1) ? 'On' : 'Off')
      
      match = data.match(/CHNN(\d+)\./)
      match && (base.getVar('Channel').value = parseInt(match[1]))

      getFlag = false
    }
  }

  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }

  return {
    setup, start, stop, tick,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel, shiftChannel,
    getPower, getSource, getAudioLevel, getAudioMute, getChannel
  }
}