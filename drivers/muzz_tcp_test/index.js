'use strict'

//---------------------------------------------------------------------------------------- CONSTANTS
const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const TCP_TIMEOUT = 30000          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 5000   // How long to wait before attempting to reconnect

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
    let pollms = config.polltime * 1000
    base.setPoll({action: 'getText', period: pollms, enablePollFn: isConnected, startImmediately: true})
    base.setPoll({action: 'getRGB', period: pollms, enablePollFn: isConnected, startImmediately: true})
  }

  function start() {
    initTcpClient()
  }

  function tick() {
    if (!tcpClient) initTcpClient()
  }

  function disconnect() {
    base.getVar('Status').string = 'Disconnected'
  }

  function stop() {
    disconnect()
    tcpClient && tcpClient.end()
    tcpClient = null
    base.stopPolling()
    base.clearPendingCommands()
  }

  function initTcpClient() {
    if (tcpClient) return  // Do nothing if tcpClient already exists

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
      disconnect() // Triggered on timeout, this allows auto reconnect
    })

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`)
      stop() // Throw out the tcpClient and get a fresh connection
    })
  }

  //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
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
    let pending = base.getPendingCommand()
    logger.debug(`onFrame (pending = ${pending && pending.action}): ${data}`)

    match = data.match(/getText,OK,(.*)\n/)
    if (match) {
      base.getVar('Text').string = match[1]
      base.commandDone()
      return
    }

    match = data.match(/getRGB,OK,(\d+),(\d+),(\d+)\n/)
    if (match) {
      base.getVar('Red').value = parseInt(match[1])
      base.getVar('Green').value = parseInt(match[2])
      base.getVar('Blue').value = parseInt(match[3])
      base.commandDone()
      return
    }
    
    logger.warn(`onFrame data not processed: ${data}`)
  }

  //---------------------------------------------------------------------------------- GET FUNCTIONS
  function getText() {
    sendDefer('getText\n')
  }

  function getRGB() {
    sendDefer('getRGB\n')
  }

  //---------------------------------------------------------------------------------- SET FUNCTIONS
  function sendCommand(params) {
    sendDefer(`${params.Name},${params.Value}\n`)
  }

  //------------------------------------------------------------------------------- HELPER FUNCTIONS
  function isConnected() {
    return base.getVar('Status').string == 'Connected'
  }


  //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
  return {
    setup, start, stop, tick,
    getText,
    getRGB,
    sendCommand
  }
}