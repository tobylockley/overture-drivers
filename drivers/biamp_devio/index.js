'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const TCP_TIMEOUT = 30000          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000   // How long to wait before attempting to reconnect

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

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Register audio level polling functions
    for (let channel of ['softCodecInputGain', 'hdmiInputGain', 'ampOutputLevel', 'lineOutputLevel', 'hdmiAudioLevel']) {
      base.setPoll({
        action: 'getAudioLevel',
        params: { Channel: channel },
        period: POLL_PERIOD,
        enablePollFn: isConnected,
        startImmediately: true
      })
    }
    
    // Register boolean polling functions
    for (let channel of ['masterMicMute', 'overrideAmpLevel', 'overrideRCALevel', 'overrideHDMILevel']) {
      base.setPoll({
        action: 'getBoolean',
        params: { Channel: channel },
        period: POLL_PERIOD,
        enablePollFn: isConnected,
        startImmediately: true
      })
    }
  }

  function start() {
    initTcpClient()
  }

  function stop() {
    tcpClient && tcpClient.end()  // Status is set to disconnected on tcp close
    tcpClient = null
    base.clearPendingCommands()
    base.stopPolling()  // startPolling is called in onFrame after authentication
  }

  function tick() {
    if (!tcpClient) initTcpClient()
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
      send('\r\n')  // Activate the password prompt on initial connection
    })

    tcpClient.on('data', data => {
      data = data.toString()
      // Check for password prompt
      if (data.includes('Password:')) {
        logger.debug('Received password prompt, sending password...')
        send(config.password)
      }
      frameParser.push(data)
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


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  function onFrame(data) {
    let match
    let pendingCommand = base.getPendingCommand()

    // AUTHENTICATION
    if (data.match(/Password: \+OK/)) {
      logger.debug('Authentication complete')
      base.startPolling()
      return
    }

    if (!pendingCommand) {
      logger.warn(`onFrame data received, but no pending command: ${data}`)
      return
    }

    // Lookup table for converting devio variable -> overture variable
    let varnames = {
      'softCodecInputGain': 'UsbInputGain',
      'hdmiInputGain': 'HdmiInputGain',
      'ampOutputLevel': 'AmpAudioLevel',
      'lineOutputLevel': 'LineAudioLevel',
      'hdmiAudioLevel': 'HdmiOutputAudioLevel',
      'masterMicMute': 'MicMute',
      'overrideAmpLevel': 'EnableAmpAdjustment',
      'overrideRCALevel': 'EnableLineAdjustment',
      'overrideHDMILevel': 'EnableHdmiOutputAdjustment'
    }

    // SET COMMANDS
    if (pendingCommand.action.includes('set') && data.match(/\+OK/)) {
      logger.debug(`onFrame ${pendingCommand.action}(${pendingCommand.params.Channel}): ${data}`)
      let varname = varnames[pendingCommand.params.Channel]
      let value = {
        'setAudioLevel': pendingCommand.params.Level,
        'setBoolean': pendingCommand.params.Status
      }[pendingCommand.action]
      logger.debug(`Set command OK, setting variable ${varname} = ${value}`)
      base.getVar(varname).value = value
      base.commandDone()
    }

    // GET COMMANDS
    else if (pendingCommand.action.includes('get') && (match = data.match(/\+OK "value":"(.*?)"/))) {
      logger.debug(`onFrame ${pendingCommand.action}(${pendingCommand.params.Channel}): ${data}`)
      let varname = varnames[pendingCommand.params.Channel]
      let value = {
        'getAudioLevel': Math.round(map(parseFloat(match[1]), -20, 20, 0, 100)),
        'getBoolean': {'false': 0, 'true': 1}[match[1]]
      }[pendingCommand.action]
      logger.debug(`Get command OK, setting variable ${varname} = ${value}`)
      base.getVar(varname).value = value
      base.commandDone()
    }

    // ERROR
    else {
      base.commandError(`onFrame data not recognised (pending = ${pendingCommand.action}): ${data}`)
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------
  function getAudioLevel(params) {
    sendDefer(`DEVICE get ${params.Channel}\n`)
  }

  function getBoolean(params) {
    sendDefer(`DEVICE get ${params.Channel}\n`)
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setAudioLevel(params) {
    // Channel = string, Level = 0-100
    let value = map(params.Level, 0, 100, -20, 20).toFixed(6)
    sendDefer(`DEVICE set ${params.Channel} ${value}\n`)
  }

  function setBoolean(params) {
    // Channel = string, Status = enum ['Off', 'On'] etc, passed as integer $value
    let value = ['false', 'true'][params.Status]
    sendDefer(`DEVICE set ${params.Channel} ${value}\n`)
  }


  // ------------------------------ HELPER FUNCTIONS ------------------------------

  function map(value, in_min, in_max, out_min, out_max) {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getAudioLevel, getBoolean,
    setAudioLevel, setBoolean
  }
}