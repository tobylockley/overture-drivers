'use strict'

const CMD_DEFER_TIME = 5000
const POLL_PERIOD = 5000
const TICK_PERIOD = 5000
const TCP_TIMEOUT = 30000
const TCP_RECONNECT_DELAY = 1000

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

    // Register polling functions
    base.setPoll({ action: 'getStatus', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
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

  function send(data) {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  const onFrame = data => {
    let pending = base.getPendingCommand()
    logger.debug(`onFrame (pending = ${pending && pending.action}): ${data}`)
    if (data.startsWith('AV: ')) {
      logger.silly(data.substr(4,1))
      base.getVar('Sources').string = 'HDMI' + data.substr(4,1)
    }
    else if (data == 'MUTE\r\n') {
      base.getVar('Mute').string = 'On'
    }
    else if (data == 'UNMUTE\r\n') {
      base.getVar('Mute').string = 'Off'
    }
    base.commandDone()
  }

  //---------------------------------------------------------------------------------- GET FUNCTIONS
  function getStatus() {
    sendDefer('600%')
  }

  //---------------------------------------------------------------------------------- SET FUNCTIONS
  const selectSource = params => {
    var HDMI_in = params.Name.replace(/\D/g , '')
    sendDefer(`${HDMI_in}B1.`)
  }

  const setMute = params => {
    if (params.Status == 'On'){
      sendDefer('0B0.')
    }
    else if (params.Status == 'Off'){
      sendDefer('0B2.')
    }
  }

  //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
  return {
    setup, start, stop, tick,
    selectSource, setMute, getStatus
  }
}