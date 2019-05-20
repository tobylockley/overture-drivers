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
    base.setPoll('Get Status', 10000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    getStatus()
    base.startPolling()
  }

  const stop = () => {
    disconnect()
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
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
      })

      tcpClient.on('data', data => {
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

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer(1000)
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

    // EXPECTED RESULT FROM getStatus():
    // A: 3 -> 1               (input -> output)
    // Volume of MIC : 8
    // Volume of LINE : 50
    // Bass of LINE : 4
    // Treble of LINE : 0
    // Ducking Off

    let match

    match = data.match(/(\d+) -> \d+/)
    match && (base.getVar('Sources').string = `Input${match[1]}`)

    match = data.match(/Volume.*?MIC.*?(\d+)/)
    match && (base.getVar('AudioLevelInput').value = match[1])

    match = data.match(/Volume.*?LINE.*?(\d+)/)
    match && (base.getVar('AudioLevel').value = match[1])

    match = data.match(/Bass.*?(\d+)/)
    match && (base.getVar('Bass').string =match[1])

    match = data.match(/Treble.*?(\d+)/)
    match && (base.getVar('Treble').string = match[1])

    match = data.match(/Ducking (Off|On)/)
    match && (base.getVar('DuckingFunction').string = match[1])

    // These are received only after a set function

    match = data.match(/Ducking.*?LINE.*?(\d+)/)
    match && (base.getVar('DuckingLevel').value = match[1])

    match = data.match(/Mute/)
    match && (base.getVar('AudioMute').string = 'On')

    match = data.match(/UnMute/)
    match && (base.getVar('AudioMute').string = 'Off')

    base.commandDone()
  }

  const getStatus = () => sendDefer(Buffer.from('600%'))

  const selectSource = params => {
    let match = params.Name.match(/.*?(\d+)/i)
    match && send(Buffer.from(`${parseInt(match[1])}A1.`))
  }

  const setAudioMute = params => {
    if (params.Status == 'Off') send(Buffer.from('0A1.'))
    else if (params.Status == 'On') send(Buffer.from('0A0.'))
  }

  const setDucking = params => send(Buffer.from('610%'))
  const setDuckingLevel = params => send(Buffer.from(`4${params.Level.toString().padStart(2, '0')}%`))
  const setAudioLevelIn = params => send(Buffer.from(`5${params.Level.toString().padStart(2, '0')}%`))
  const setAudioLevel = params => send(Buffer.from(`7${params.Level.toString().padStart(2, '0')}%`))
  const setBass = params => send(Buffer.from(`8${params.Level.toString().padStart(2, '0')}%`))
  const setTreble = params => send(Buffer.from(`9${params.Level.toString().padStart(2, '0')}%`))

  return {
    setup, start, stop, tick,
    selectSource, setAudioMute, setDucking, setDuckingLevel, setAudioLevelIn, setAudioLevel, setBass, setTreble,
    getStatus
  }
}