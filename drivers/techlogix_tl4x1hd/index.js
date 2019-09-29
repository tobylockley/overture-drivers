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

  //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    base.setPoll({
      action: 'getStatus',
      period: POLL_PERIOD,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected' },
      startImmediately: true
    })
  }

  function start() {
    initTcpClient()
  }

  function tick() {
    !tcpClient && initTcpClient()  // Attempt reconnection after an error
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

  const onFrame = data => {
    base.commandDone()
    logger.silly(`onFrame: ${data}`)
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