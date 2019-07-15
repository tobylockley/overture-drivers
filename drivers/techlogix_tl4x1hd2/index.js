'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 30000          // Continuous polling function interval
const TCP_TIMEOUT = 35000          // Will timeout after this length of inactivity
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
    base.setPoll({ action: 'keepAlive', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: false })
  }

  function start() {
    initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
    tcpClient = null
    base.clearPendingCommands()
    base.stopPolling()
  }

  function tick() {
    if (!tcpClient) initTcpClient()
  }

  function initTcpClient() {
    if (tcpClient) return  // Return if tcpClient already exists

    logger.silly('Initialising TCPClient...')
    tcpClient = host.createTCPClient()
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY,
      // disconnectOnReceiveTimeout: false
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

    tcpClient.on('error', error => {
      logger.error(`TCPClient error: ${error.message}`)
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
    if (!send(data)) {
      base.commandError('Data not sent')
    }
  }

  function onFrame(data) {
    if (data.trim().length === 0) {
      logger.debug('onFrame data is empty string, skipping...')
      return
    }

    let pendingCommand = base.getPendingCommand()
    logger.debug(`onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data.trim()}`)
    if (pendingCommand) {
      let pending = pendingCommand.action
      // Feedback Example - [CMD]: switch to HDMI1.
      let match = data.match(/switch to (HDMI\d)/)
      if ( pending === 'selectSource' && (match = data.match(/switch to (HDMI\d)/)) ) {
        base.getVar('Sources').string = match[1]
        base.commandDone()
      }
      else if ( pending === 'keepAlive' && /CMD NOT FOUND/.test(data) ) {
        base.commandDone()
      }
      else {
        logger.warn('onFrame data not processed')
      }
    }
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function keepAlive() {
    sendDefer('%')  // Will cause an error, this is just to test connection and keep socket alive
  }

  function selectSource(params) {
    sendDefer(`${params.Name}%`)
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup,
    start,
    stop,
    tick,
    keepAlive,
    selectSource
  }
}