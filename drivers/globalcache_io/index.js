'use strict'

const CMD_DEFER_TIME = 2000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD_RELAY = 3000     // Continuous polling function interval for relays
const POLL_PERIOD_INPUT = 1000     // Continuous polling function interval for inputs
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
    
    //CREATE VARIABLES BASED ON RELAYS
    for (let i = 1; i <= config.relays; i++) {
      base.createVariable({
        name: `PowerChannel${i}`,
        type: 'enum',
        enums: ['Off', 'On'],
        smooth: true,
        perform: {
          action: 'setPower',
          params: {
            Channel: i,
            Status: '$value'
          }
        }
      })
      // Set up polling
      base.setPoll({
        action: 'getPower',
        period: POLL_PERIOD_RELAY,
        enablePollFn: isConnected,
        startImmediately: true,
        params: { Channel: i }
      })
    }

    //CREATE VARIABLES BASED ON INPUTS
    for (let i = 1; i <= config.inputs; i++) {
      base.createVariable({
        name: `InputChannel${i}`,
        type: 'enum',
        enums: ['Off', 'On']
      })
      // Set up polling
      base.setPoll({
        action: 'getInput',
        period: POLL_PERIOD_INPUT,
        enablePollFn: isConnected,
        startImmediately: true,
        params: { Channel: i }
      })
    }
  }

  function start() {
    initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
    tcpClient = null
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

    // Finally, initiate connection
    tcpClient.connect(config.port, config.host)
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
    if (/ERR/.test(data)) {
      logger.error(`GC IO error: ${data}`)
      base.commandError('Error from module, check Error variable')
      if (data.includes('ERR 003')) base.getVar('Error').string = 'Bad Module or Channel Number'
      else if (data.includes('ERR RS004')) base.getVar('Error').string = 'Logical Relay Disabled or Unavailable'
      else base.getVar('Error').string = 'General Error'
    }
    else base.getVar('Error').string = ''

    let rPower = /state,(\d):(\d),(\d)/
    if (rPower.test(data)) {
      let mod = Number(rPower.exec(data)[1])
      let channel = Number(rPower.exec(data)[2])
      let value = Number(rPower.exec(data)[3])
      if (mod == config.modRelay) base.getVar('PowerChannel' + channel).value = value
      else if (mod == config.modInput) base.getVar('InputChannel' + channel).value = value
      base.commandDone()
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getPower(params) {
    sendDefer(`getstate,${config.modRelay}:${params.Channel}\r`)
  }

  function getInput(params) {
    sendDefer(`getstate,${config.modInput}:${params.Channel}\r`)
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setPower(params) {
    sendDefer(`setstate,${config.modRelay}:${params.Channel},${params.Status}\r`)
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------

  return {
    setup, start, stop, tick,
    getPower, getInput,
    setPower
  }
}