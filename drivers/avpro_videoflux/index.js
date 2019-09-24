const CMD_DEFER_TIME = 1000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 10000           // Continuous polling function interval
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

  //-------------------------------------------------------------------------- BASE FUNCTIONS
  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    setPoll('getAllOutputs', POLL_PERIOD, isConnected)
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
    if (send(data)) base.commandDefer(CMD_DEFER_TIME)
    else base.commandError('Data not sent')
  }

  function onFrame(data) {
    let match // Used for regex matching below
    const pendingCommand = base.getPendingCommand()
    logger.silly(`onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data}`)

    match = data.match(/OUT(\d).*IN(\d)/i)
    if (match) {
      base.getVar('').string = ''
      base.commandDone()
    }
  }

  //-------------------------------------------------------------------------- GET FUNCTIONS
  function getAllOutputs() {
    sendDefer('GET OUT0 VS\r\n')  // Get all outputs
  }

  //-------------------------------------------------------------------------- SET FUNCTIONS
  function selectSource(params) {
    let output_name = config.model.output_names[params.Channel]

    // Make sure params.Channel is in valid range
    if (params.Channel < 1 || params.Channel > config.model.output_names.length) {
      logger.error(`selectSource: params.Channel (${params.Channel}) is out of valid range (1-${config.model.output_names.length})`)
      return
    }

    // If simulation mode, just set the variable
    if (config.simulation) {
      base.getVar(`Sources_${output_name}`).string = params.Name
      return
    }

    // Find input number based on name
    let input_number = 0
    for (let input in config.model.input_names) {
      if (params.Name == config.model.input_names[input]) {
        input_number = parseInt(input)
      }
    }

    // Send join command, or error message if input not found
    if (input_number > 0) {
      logger.debug(`Connecting "${params.Name}" (Input${input_number}) to "${output_name}" (Output${params.Channel})`)
      sendDefer(`SET OUT${params.Channel} VS IN${input_number}\r\n`)
    }
    else {
      logger.error(`selectSource: Could not find an input matching "${params.Name}"`)
    }
  }

  //------------------------------------------------------------------------------- HELPER FUNCTIONS
  function isConnected() {
    return base.getVar('Status').string === 'Connected'
  }

  function setPoll(action, period, enableFn) {
    base.setPoll({
      action: action,
      period: period,
      enablePollFn: enableFn,
      startImmediately: true
    })
  }

  //-------------------------------------------------------------------------- EXPORTED FUNCTIONS
  return {
    setup, start, stop, tick,
    getAllOutputs, selectSource
  }
}


