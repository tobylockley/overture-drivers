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
  frameParser.setSeparator('\r')
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

  function disconnect() {
    base.getVar('Status').string = 'Disconnected'  // Triggered on timeout, this allows auto reconnect
    base.stopPolling()
    base.clearPendingCommands()
  }

  function stop() {
    disconnect()
    tcpClient && tcpClient.end()
    tcpClient = null
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
      disconnect() // Triggered on timeout, this allows auto reconnect
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
    let pending = base.getPendingCommand()
    logger.debug(`onFrame (pending = ${pending && pending.action}): ${data}`)

    match = data.match(/%1(.*?)=(.*?)\r/)
    if (match && match[2].includes('ERR')) {
      if (match[2] === 'ERR1') {
        logger.error('PJLink Error: Undefined command')
      }
      else if (match[2] === 'ERR2') {
        logger.error('PJLink Error: Out of parameter')
      }
      else if (match[2] === 'ERR3') {
        logger.error('PJLink Error: Unavailable at this time')
      }
      else if (match[2] === 'ERR4') {
        logger.error('PJLink Error: Projector/Display failure')
      }
      else {
        logger.error('Unknown PJLink Error')
      }
      pending && base.commandError('Error response from device')
    }
    else if (match) {
      if (pending.action == 'getPower' && match[1] === 'POWR') {
        base.getVar('Power').value = parseInt(match[2])  // 0=off, 1=on, 2=cooling, 3=warming
        base.commandDone()
      }
      else if (pending.action == 'setPower' && match[1] === 'POWR' && match[2] === 'OK') {
        if (pending.params.Status === 'Off') {
          base.getVar('Power').value = 2  // Cooling down
          base.commandDone()
        }
        else if (pending.params.Status === 'On') {
          base.getVar('Power').value = 3  // Warming up
          base.commandDone()
        }
      }
      else if (pending.action == 'getSource' && match[1] === 'INPT') {
        base.getVar('Sources').string = pending.params.Status
        base.commandDone()
      }
      // Set options for inputs in setup
      // AV Mute
      // Use INST to get sources available
    }
    else {
      logger.warn(`onFrame data not processed: ${data}`)
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------
  function getPower() {
    sendDefer('%1POWR ?\r')
  }

  function getSource() {
    sendDefer('%1INPT ?\r')
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setPower(params) {
    if (params.Status == 'Off') sendDefer('%1POWR 0\r')
    else if (params.Status == 'On') sendDefer('%1POWR 1\r')
    else logger.warn('setPower only accepts "Off" or "On"')
  }

  function selectSource(params) {
    let match = params.Name.match(/HDMI(\d)/)
    match && sendDefer(`*SCINPT000000010000000${match[1]}\n`)
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getPower, getSource,
    setPower, selectSource
  }
}