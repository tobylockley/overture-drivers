'use strict'

const CMD_DEFER_TIME = 2000
const TICK_PERIOD = 5000
const POLL_PERIOD = 5000
const TCP_TIMEOUT = 30000
const TCP_RECONNECT_DELAY = 10000

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

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }


  const setup = _config => {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Register polling functions
    base.setPoll({ action: 'getStatus', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })

    // Create dynamic variables based on model
    let sources, mic_input, ducking
    if (config.model == 'TL-A70-40W') {
      // 3 inputs, mic
      sources = ['Input1', 'Input2', 'Input3']
      mic_input = true
      ducking = true
    }
    else if (config.model == 'TL-A8O-20W') {
      // 2 inputs, mic
      sources = ['Input1', 'Input2']
      mic_input = true
      ducking = false
    }
    else if (config.model == 'TL-A8O-50W') {
      // 3 inputs, no mic
      sources = ['Input1', 'Input2', 'Input3']
      mic_input = false
      ducking = false
    }

    base.getVar('Sources').enums = sources

    if (mic_input) {
      base.createVariable({
        name: 'AudioLevelInput',
        type: 'integer',
        min: 0,
        max: 60,
        perform: {
          action: 'Set Audio Level In',
          params: {
            Level: '$value'
          }
        }
      })
      base.createVariable({
        name: 'AudioMuteInput',
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'Set Audio Mute In',
          params: {
            Status: '$string'
          }
        }
      })
    }

    if (ducking) {
      base.createVariable({
        name: 'DuckingFunction',
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'Toggle Ducking'
        }
      })
      base.createVariable({
        name: 'DuckingLevel',
        type: 'integer',
        min: 0,
        max: 60,
        perform: {
          action: 'Set Ducking Level',
          params: {
            Level: '$value'
          }
        }
      })
    }
  }

  const start = () => {
    initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
    tcpClient = null
    base.stopPolling()
    base.clearPendingCommands()
  }

  function tick() {
    !tcpClient && initTcpClient()
  }

  function initTcpClient() {
    if (tcpClient) return  // Return if tcpClient already exists

    tcpClient = host.createTCPClient()
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
    })
    tcpClient.connect(config.port, config.host)

    tcpClient.on('connect', () => {
      logger.silly('TCPClient connected')
      base.getVar('Status').string = 'Connected'
      base.startPolling()
    })

    tcpClient.on('data', data => {
      frameParser.push(data.toString())
    })

    tcpClient.on('close', () => {
      logger.silly('TCPClient closed')
      base.getVar('Status').string = 'Disconnected'  // Triggered on timeout, this allows auto reconnect
    })

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`)
      stop()  // Throw out the tcpClient and get a fresh connection
    })
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const sendDefer = data => {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  const onFrame = data => {
    let match
    base.commandDone()
    logger.silly(`onFrame ${data}`)

    // EXPECTED RESULT FROM getStatus():
    // A: 3 -> 1                                     (input -> output)
    // Volume of MIC : 8
    // Volume of LINE : 50
    // Bass of LINE : 4
    // Treble of LINE : 0
    // Ducking Off

    match = data.match(/(\d+) -> \d+/)
    match && (base.getVar('Sources').string = `Input${match[1]}`)

    // Need this logic to distinguish A70 and A8O
    if (data.match(/MIC/)) {
      match = data.match(/Volume.*?MIC.*?(\d+)/)
      match && (base.getVar('AudioLevelInput').value = match[1])
      match = data.match(/Volume.*?LINE.*?(\d+)/)
      match && (base.getVar('AudioLevel').value = match[1])
    }
    else {
      match = data.match(/Volume.*?(\d+)/)
      match && (base.getVar('AudioLevel').value = match[1])
    }

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
  }

  const getStatus = () => sendDefer(Buffer.from('600%'))

  const selectSource = params => {
    let match = params.Name.match(/.*?(\d+)/i)
    match && send(Buffer.from(`${parseInt(match[1])}A1.`))
  }

  const setAudioMute = params => {
    if (params.Status == 'Off') {
      send(Buffer.from('0A1.'))
    }
    else if (params.Status == 'On') {
      if (config.model == 'TL-A8O-50W') {
        send(Buffer.from('0A0.'))  // This model has no 'line only' mute
      }
      else {
        send(Buffer.from('2A0.'))  // Mute line only
      }
    }
  }

  const setAudioMuteIn = params => {
    if (params.Status == 'Off') send(Buffer.from('0A1.'))
    else if (params.Status == 'On') send(Buffer.from('1A0.'))  // Mute mic only
  }

  const muteAll = () => send(Buffer.from('0A0.'))
  const setDucking = () => send(Buffer.from('610%'))
  const setDuckingLevel = params => send(Buffer.from(`4${params.Level.toString().padStart(2, '0')}%`))
  const setAudioLevelIn = params => send(Buffer.from(`5${params.Level.toString().padStart(2, '0')}%`))
  const setAudioLevel = params => send(Buffer.from(`7${params.Level.toString().padStart(2, '0')}%`))
  const setBass = params => send(Buffer.from(`8${params.Level.toString().padStart(2, '0')}%`))
  const setTreble = params => send(Buffer.from(`9${params.Level.toString().padStart(2, '0')}%`))

  return {
    setup, start, stop, tick,
    selectSource, setAudioMute, setAudioMuteIn, setDucking, setDuckingLevel, setAudioLevelIn, setAudioLevel, setBass, setTreble,
    getStatus, muteAll
  }
}