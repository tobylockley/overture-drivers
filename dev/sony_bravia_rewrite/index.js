let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  var getFlag = false

  const setup = _config => {
    config = _config
    base.setPoll('Get Power', 5000)
    base.setPoll('Get Source', 5000)
    base.setPoll('Get Audio Level', 5000)
    base.setPoll('Get Audio Mute', 5000)
    base.setPoll('Get Channel', 5000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  const getPower = () => { getFlag = true; sendDefer(Buffer.from("*SEPOWR################\n")); }
  const getSource = () => { getFlag = true; sendDefer(Buffer.from("*SEINPT################\n")); }
  const getAudioLevel = () => { getFlag = true; sendDefer(Buffer.from("*SEVOLU################\n")); }
  const getAudioMute = () => { getFlag = true; sendDefer("*SEAMUT################\n"); }
  const getChannel = () => { 
    getFlag = true; 
    let source = base.getVar('Sources').string
    source == "DTV" && sendDefer("*SECHNN################\n"); }

  var timerPower
  const setPower = params => {
    if (params.Status == 'Off') sendDefer(Buffer.from(`*SCPOWR0000000000000000\n`))
    else if (params.Status == 'On') sendDefer(Buffer.from(`*SCPOWR0000000000000001\n`))
    clearTimeout(timerPower)
    timerPower = setTimeout(getPower, 1000)
  }

  var timerSource
  const selectSource = params => {
    if (params.Name == 'DTV') sendDefer("*SCINPT0000000000000000\n")
    else {
      let match = params.Name.match(/HDMI(\d)/)
      match && sendDefer(`*SCINPT000000010000000${match[1]}\n`)
    }
    clearTimeout(timerSource)
    timerSource = setTimeout(getSource, 1000)
  }

  var timerVolume
  const setAudioLevel = params => {
    let vol = params.Level.toString().padStart(3, '0')
    sendDefer(Buffer.from(`*SCVOLU0000000000000${vol}\n`))
    clearTimeout(timerVolume)
    timerVolume = setTimeout(getAudioLevel, 1000)
  }

  var timerMute
  const setAudioMute = params => {
    if (params.Status == 'Off') sendDefer("*SCAMUT0000000000000000\n")
    else if (params.Status == 'On') sendDefer("*SCAMUT0000000000000001\n")
    clearTimeout(timerMute)
    timerMute = setTimeout(getAudioMute, 1000)
  }

  var timerChannel
  const setChannel = params => {
    let channel = params.Name.toString().padStart(8, '0')
    sendDefer(Buffer.from(`*SCCHNN${channel}.0000000\n`))
    clearTimeout(timerChannel)
    timerChannel = setTimeout(getChannel, 1000)
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
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
    let match
    if (getFlag) {
      match = data.match(/POWR(\d+)/)
      match && (base.getVar('Power').string = (parseInt(match[1]) == 1) ? 'On' : 'Off')
      
      match = data.match(/INPT0{16}/)
      match && (base.getVar('Sources').string = 'DTV')
      
      match = data.match(/INPT0{7}1(\d+)/)
      match && (base.getVar('Sources').string = `HDMI${match[1]}`)
      
      match = data.match(/VOLU(\d+)/)
      match && (base.getVar('AudioLevel').value = parseInt(match[1]))
      
      match = data.match(/AMUT(\d+)/)
      match && (base.getVar('AudioMute').string = (parseInt(match[1]) == 1) ? 'On' : 'Off')
      
      match = data.match(/CHNN(\d+)\./)
      match && (base.getVar('Channel').value = parseInt(match[1]))

      getFlag = false
    }
    base.commandDone()
  }

  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }

  return {
    setup, start, stop, tick,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel,
    getPower, getSource, getAudioLevel, getAudioMute, getChannel
  }
}