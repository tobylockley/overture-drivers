'use strict'

const CMD_DEFER_TIME = 1000        // Timeout when using commandDefer
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
  frameParser.setSeparator('\r')
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Register polling functions
    base.setPoll({ action: 'getSource', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
  }

  function start() {
    initTcpClient()
  }

  function tick() {
    if (!tcpClient) initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
    tcpClient = null
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
      frameParser.push( data.toString() )
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
    if (send(data)) base.commandDefer(CMD_DEFER_TIME)
    else base.commandError('Data not sent')
  }

  function onFrame(data) {
    let pendingCommand = base.getPendingCommand()
    logger.debug(`onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data.trim()}`)
    // Check for errors, otherwise process as normal
    let err = /ERR/
    if (err.test(data)) {
      base.commandError('Error from module, check Error variable')
      if (data == 'ERR 001\r') base.getVar('Error').string = 'Invalid request. Command not found.'
      else if (data == 'ERR 002\r') base.getVar('Error').string = 'Bad request syntax used with a known command.'
      else if (data == 'ERR 003\r') base.getVar('Error').string = 'Invalid or missing module and/or connector address.'
      else if (data == 'ERR 004\r') base.getVar('Error').string = 'No carriage return found.'
      else if (data == 'ERR 005\r') base.getVar('Error').string = 'Command not supported by current port setting.'
      else if (data == 'ERR 006\r') base.getVar('Error').string = 'Settings are locked.'
      else base.getVar('Error').string = 'General Error'
      // Clear error in 30 secs
      setTimeout(() => {
        base.getVar('Error').string = ''
      }, 30000)
    }
    else {
      let match = data.match(/state,1:(\d),(\d)/)
      if (match) {
        if (pendingCommand && pendingCommand.inputsScanned === undefined) pendingCommand.inputsScanned = 0
        pendingCommand && (pendingCommand.inputsScanned += 1)
        let input = parseInt(match[1])
        let state = parseInt(match[2])
        if (state === 1) {
          base.getVar('Sources').string = `HDMI${input}`
          pendingCommand && (pendingCommand.inputFound = true)
        }

        // Command complete when all 3 inputs scanned
        if (pendingCommand && pendingCommand.inputsScanned === 3) {
          base.commandDone()
          // If no input was found to be selected, change to None
          if (!pendingCommand.inputFound) base.getVar('Sources').string = 'None'
        }
      }
      else {
        logger.warn('onFrame data not processed!')
      }
    }
  }

  function getSource() {
    sendDefer('getstate,1:1\rgetstate,1:2\rgetstate,1:3\r')
  }

  function selectSource(params) {
    if (params.Name == 'None') {
      sendDefer('setstate,1:1,0\rsetstate,1:2,0\rsetstate,1:3,0\r')  // Set all off in one command
    }
    else {
      let match = params.Name.match(/HDMI(\d)/)
      match && sendDefer(`setstate,1:${match[1]},1\r`)
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getSource, selectSource
  }
}