const CMD_DEFER_TIME = 30000 // Timeout when using commandDefer
const TICK_PERIOD = 5000 // In-built tick interval
const TCP_TIMEOUT = 10000 // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000 // How long to wait before attempting to reconnect

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

  //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Register polling functions
    let poll_ms = config.polltime * 1000 // Convert from seconds to milliseconds
    setPoll('getPower', poll_ms, isConnected)
    setPoll('getSource', poll_ms, isPoweredOn)
    setPoll('getAudioLevel', poll_ms, isPoweredOn)
    setPoll('getAudioMute', poll_ms, isPoweredOn)
    setPoll('getChannel', poll_ms, isDTVMode)
  }

  function start() {
    if (config.simulation) base.getVar('Status').string = 'Connected'
    else initTcpClient()
  }

  function tick() {
    if (!config.simulation && !tcpClient) initTcpClient()
  }

  function disconnect() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
  }

  function stop() {
    disconnect()
    tcpClient && tcpClient.end()
    tcpClient = null
  }

  //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
  function initTcpClient() {
    if (tcpClient) return // Return if tcpClient already exists

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
      let pending = base.getPendingCommand()
      disconnect() // Triggered on timeout, this allows auto reconnect
      if (pending) {
        base.commandError('Lost Connection')
        base.perform(pending.action, pending.params)
      }
    })

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`)
      stop() // Throw out the tcpClient and get a fresh connection
    })
  }

  function send(data) {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  function onFrame(data) {
    let match // Used for regex matching below
    const pendingCommand = base.getPendingCommand()
    logger.silly(`onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data}`)

    // Use arrays to match pending command action to expected response
    const setFns = [
      'setPower',
      'selectSource',
      'setAudioLevel',
      'setAudioMute',
      'setChannel',
      'shiftChannel'
    ]

    if (pendingCommand && setFns.includes(pendingCommand.action)) {
      // Parse response after issueing a SET function

      match = data.match(/POWR0{16}/)
      if (match) {
        base.getVar('Power').string = pendingCommand.params.Status
        base.commandDone()
      }

      match = data.match(/INPT0{16}/)
      if (match) {
        base.getVar('Sources').string = pendingCommand.params.Name
        base.commandDone()
        if (pendingCommand.params.Name === 'DTV') getChannel() // Get channel when set to DTV mode
      }

      match = data.match(/VOLU0{16}/)
      if (match) {
        base.getVar('AudioLevel').value = parseInt(pendingCommand.params.Level)
        base.commandDone()
      }

      match = data.match(/AMUT0{16}/)
      if (match) {
        base.getVar('AudioMute').string = pendingCommand.params.Status
        base.commandDone()
      }

      match = data.match(/CHNN0{16}/)
      if (match) {
        base.getVar('Channel').value = parseInt(pendingCommand.params.Name)
        base.commandDone()
      }

      match = data.match(/IRCC0{16}/)
      if (match) {
        base.getVar('ChannelShift').value = 0 // Reset to 'idle'
        base.commandDone()
      }
    }
    else {
      // Parse response after issueing a GET function, OR after a "notify" frame
      // Notify frames are received after changing something, either from the CS or an IR remote

      match = data.match(/POWR(.{16})/)
      if (match) {
        let val = parseInt(match[1])
        val && (base.getVar('Power').value = val) // 0 = off, 1 = on
        pendingCommand && base.commandDone()
      }

      match = data.match(/INPT0{16}/)
      if (match) {
        base.getVar('Sources').string = 'DTV'
        pendingCommand && base.commandDone()
      }

      match = data.match(/INPT0{7}1(\d+)/)
      if (match) {
        base.getVar('Sources').string = `HDMI${parseInt(match[1])}`
        pendingCommand && base.commandDone()
      }

      match = data.match(/VOLU(.{16})/)
      if (match) {
        let val = parseInt(match[1])
        val && (base.getVar('AudioLevel').value = val)
        pendingCommand && base.commandDone()
      }

      match = data.match(/AMUT(.{16})/)
      if (match) {
        let val = parseInt(match[1])
        val && (base.getVar('AudioMute').value = val) // 0 = unmute, 1 = mute
        pendingCommand && base.commandDone()
      }

      match = data.match(/CHNN(\d+)\./) // Ignores values after decimal point
      if (match) {
        base.getVar('Channel').value = parseInt(match[1])
        pendingCommand && base.commandDone()
      }
    }
  }

  //---------------------------------------------------------------------------------- GET FUNCTIONS
  function getPower() {
    sendDefer('*SEPOWR################\n')
  }

  function getSource() {
    sendDefer('*SEINPT################\n')
  }

  function getAudioLevel() {
    sendDefer('*SEVOLU################\n')
  }

  function getAudioMute() {
    sendDefer('*SEAMUT################\n')
  }

  function getChannel() {
    sendDefer('*SECHNN################\n')
  }

  //---------------------------------------------------------------------------------- SET FUNCTIONS
  function setPower(params) {
    if (config.simulation) {
      base.getVar('Power').string = params.Status
      return
    }

    if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n')
    else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n')
  }

  function selectSource(params) {
    if (config.simulation) {
      base.getVar('Sources').string = params.Name
      return
    }

    if (params.Name == 'DTV') sendDefer('*SCINPT0000000000000000\n')
    else {
      let match = params.Name.match(/HDMI(\d)/)
      match && sendDefer(`*SCINPT000000010000000${match[1]}\n`)
    }
  }

  function setAudioLevel(params) {
    if (config.simulation) {
      base.getVar('AudioLevel').value = params.Level
      return
    }

    let vol = params.Level.toString().padStart(3, '0') // Formats the integer with leading zeroes, e.g. 53 = '053'
    sendDefer(`*SCVOLU0000000000000${vol}\n`)
  }

  function setAudioMute(params) {
    if (config.simulation) {
      base.getVar('AudioMute').string = params.Status
      return
    }

    if (params.Status == 'Off') sendDefer('*SCAMUT0000000000000000\n')
    else if (params.Status == 'On') sendDefer('*SCAMUT0000000000000001\n')
  }

  function setChannel(params) {
    if (isDTVMode()) {
      if (config.simulation) {
        base.getVar('Channel').value = params.Name
        return
      }
      let channel = params.Name.toString().padStart(8, '0')
      sendDefer(`*SCCHNN${channel}.0000000\n`)
    }
    else {
      logger.error('Cannot change channel unless set to DTV mode')
    }
  }

  function shiftChannel(params) {
    if (isDTVMode()) {
      if (config.simulation) {
        let delta = { Up: 1, Down: -1 }
        base.getVar('Channel').value += delta[params.Name]
        return
      }
      if (params.Name == 'Up') sendDefer('*SCIRCC0000000000000033\n')
      else if (params.Name == 'Down') sendDefer('*SCIRCC0000000000000034\n')
      base.getVar('ChannelShift').string = params.Name
    }
    else {
      logger.error('Cannot change channel unless set to DTV mode')
    }
  }

  //------------------------------------------------------------------------------- HELPER FUNCTIONS
  function isConnected() {
    return base.getVar('Status').string === 'Connected'
  }

  function isPoweredOn() {
    return isConnected() && base.getVar('Power').string === 'On'
  }

  function isDTVMode() {
    return isPoweredOn() && base.getVar('Sources').string === 'DTV'
  }

  function setPoll(action, period, enableFn) {
    base.setPoll({
      action: action,
      period: period,
      enablePollFn: enableFn,
      startImmediately: true
    })
  }

  //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
  return {
    setup,
    start,
    stop,
    tick,
    getPower,
    getSource,
    getAudioLevel,
    getAudioMute,
    getChannel,
    setPower,
    selectSource,
    setAudioLevel,
    setAudioMute,
    setChannel,
    shiftChannel
  }
}
