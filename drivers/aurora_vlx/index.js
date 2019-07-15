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
  frameParser.setSeparator('\n')
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Register polling functions
    base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
  }

  function start() {
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
    let pendingCommand = base.getPendingCommand()
    logger.debug(`onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data}`)
    let match = data.match(/POWR(\d+)/)
    if (match && pendingCommand) {
      if (match && pendingCommand.action == 'getPower') {
        base.getVar('Power').value = parseInt(match[1])  // 0 = off, 1 = on
        base.commandDone()
      }
      else if (match && pendingCommand.action == 'setPower') {
        base.getVar('Power').string = pendingCommand.params.Status
        base.commandDone()
      }
    }
    else if (match && !pendingCommand) {
      logger.warn(`Received data but no pending command: ${data}`)
    }
    else {
      logger.warn(`onFrame data not processed: ${data}`)
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getPower() {
    sendDefer('*SEPOWR################\n')
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setPower(params) {
    if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n')
    else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n')
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getPower,
    setPower
  }
}