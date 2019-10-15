'use strict'

const CMD_DEFER_TIME = 1000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 10000          // Continuous polling function interval
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
  let getAllTally = 0  // Used for counting getAllOutputs response frames

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\r\n')
  frameParser.on('data', onFrame)

  //------------------------------------------------------------------------- BASE FUNCTIONS
  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    base.setPoll({
      action: 'getAllOutputs',
      period: POLL_PERIOD,
      enablePollFn: isConnected,
      startImmediately: true
    })
    // Create an enum variable for each output, each containing enum of inputs
    let match = config.model.toString().match(/AC-MX(\d)(\d)/)
    if (match) {
      config.num_inputs = parseInt(match[1])
      config.num_outputs = parseInt(match[2])
      let enums = Array.from(Array(config.num_inputs).keys(), x => `IN${x+1}`)
      for (let i = 1; i <= config.num_outputs; i++) {
        base.createVariable({
          name: `Sources_OUT${i}`,
          type: 'enum',
          enums: enums,
          perform: {
            action: 'Select Source',
            params: {
              Channel: i,
              Name: '$string'
            }
          }
        })
      }
    }
    else {
      logger.error(`Unexpected model: ${config.model}`)
    }
  }

  function start() {
    if (config.simulation) base.getVar('Status').string = 'Connected'
    else initTcpClient()
  }

  function tick() {
    if (!config.simulation && !tcpClient) initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
    tcpClient = null
  }

  //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
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

  function send(data) {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  //---------------------------------------------------------------------------------- FRAME PARSER
  function onFrame(data) {
    let match  // Used for regex matching below
    const pending = base.getPendingCommand()
    logger.debug(`onFrame (pending = ${pending && pending.action}): ${data}`)
    match = data.match(/(OUT\d) VS (IN\d)/i)
    if (match) {
      base.getVar(`Sources_${match[1]}`).string = match[2]
      if (pending && pending.action === 'getAllOutputs') {
        getAllTally += 1
        if (getAllTally === config.num_outputs) base.commandDone()
      }
      else if (pending && pending.action === 'selectSource') {
        base.commandDone()
      }
    }
  }

  //---------------------------------------------------------------------------------- GET FUNCTIONS
  function getAllOutputs() {
    getAllTally = 0
    sendDefer('GET OUT0 VS\r\n')  // Get all outputs
  }

  //---------------------------------------------------------------------------------- SET FUNCTIONS
  function selectSource(params) {
    // If simulation mode, just set the variable
    if (config.simulation) {
      base.getVar(`Sources_OUT${params.Channel}`).string = params.Name
      return
    }
    sendDefer(`SET OUT${params.Channel} VS ${params.Name}\r\n`)
  }

  //------------------------------------------------------------------------------- HELPER FUNCTIONS
  function isConnected() {
    return base.getVar('Status').string === 'Connected'
  }

  //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
  return {
    setup, start, stop, tick,
    getAllOutputs, selectSource
  }
}


