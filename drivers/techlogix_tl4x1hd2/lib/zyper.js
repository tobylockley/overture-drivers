'use strict'

const CMD_DEFER_TIME = 3000         // Timeout when using commandDefer
const TICK_PERIOD = 10000           // In-built tick interval
const POLL_PERIOD = 20000           // Continuous polling function interval
const REQUEST_TIMEOUT = 2000        // Timeout for REST requests
const TCP_TIMEOUT = 30000           // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000    // How long to wait before attempting to reconnect
const RS232_BAUDRATE = 9600         // Baudrate for TL switcher comms
const DATARELAY_PORT = 5000         // Start port for data relays. If taken, will increment

exports.createDevice = (host, base, config) => {
  const logger = base.logger || host.logger
  let tcpClient
  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\r\n')
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup() {
    base.setTickPeriod(TICK_PERIOD)
    base.setPoll({ action: 'poll', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    initBaudrate()
    initDataRelay()
  }

  function start() {
    initTcpClient()
    base.startPolling()
  }

  function stop() {
    base.stopPolling()
    base.clearPendingCommands()
    base.getVar('Status').string = 'Disconnected'
  }

  async function tick() {
    // Get connection status to Zyper MP
    try {
      await zyperCmd('show server info')  // If no error is thrown, command succeeded
      if (base.getVar('Status').string === 'Disconnected') {
        base.getVar('Status').string = 'Connected'
      }
    }
    catch (error) {
      base.getVar('Status').string === 'Disconnected'
      logger.error(`tick > ${error.message}`)
    }
  }


  // ------------------------------ RS232 SETUP FUNCTIONS ------------------------------

  async function initBaudrate() {
    // Set baud rate and setup data relay for each zyper device
    try {
      let result = await zyperCmd(`set device ${config.device} rs232 ${RS232_BAUDRATE} 8-bits 1-stop none`)
      logger.info(`Successfully set RS232 baudrate for ${config.device} to ${RS232_BAUDRATE}`)
      console.log(`result = ${result}`)
    }
    catch (error) {
      logger.error(`initBaudrate > Error settings baudrate for ${config.device} > ${error.message}`)
    }
  }

  async function initDataRelay() {
    // Set up data relay for RS232 comms
    try {
      let relays = await zyperCmd('show data-relays')
      // Check if data relay already exists, if not, create one
      console.log('relays', relays)
      // DATARELAY_PORT
      // let result = await zyperCmd(`data-connect ${config.device} server rs232 tcp-port `)
      // logger.info(`Successfully set RS232 baudrate for ${config.device} to ${RS232_BAUDRATE}`)
      // console.log(`result = ${result}`)
    }
    catch (error) {
      logger.error(`initBaudrate > Error settings baudrate for ${config.device} > ${error.message}`)
    }
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

  async function zyperCmd(cmdString) {
    base.commandDefer(CMD_DEFER_TIME)
    try {
      logger.silly(`Sending zyperCmd > ${cmdString}`)
      const options = {
        method: 'POST',
        uri: `http://${config.host}/rcCmd.php`,
        timeout: REQUEST_TIMEOUT,
        form: {
          commands: cmdString
        }
      }
      let response = await host.request(options)
      response = JSON.parse(response)
      let zyperResponse = response.responses[0]
      for (let warning of zyperResponse.warnings) logger.warn(`zyperCmd warning > ${warning}`)
      if (zyperResponse.errors.length > 0) throw new Error(zyperResponse.errors[0])
      base.commandDone()
      return zyperResponse
    }
    catch (error) {
      base.commandError(error.message)
      throw new Error(`zyperCmd failed > ${error.message}`)
    }
  }

  function onFrame(data) {
    logger.silly(`onFrame > ${data}`)
    // Feedback Example - [CMD]: switch to HDMI1.
    let match = data.match(/switch to (HDMI\d)/)
    if (match) {
      base.getVar('Sources').string = match[1]
      base.commandDone()
    }
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function selectSource(params) {
    // params.Name      string    Name of channel to select

  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------

  return {
    setup,
    start,
    stop,
    tick,
    selectSource
  }
}