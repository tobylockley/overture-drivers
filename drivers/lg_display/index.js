'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const TCP_TIMEOUT = 30000          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 1000   // How long to wait before attempting to reconnect

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  let wol = require('wol')  // Used to turn wake from power off, must be enabled in menu
  let sourcesInfo = []  // Used to store inputs sources hex codes
  let irCodes  // Populated during setup

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('x')
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    base.setPoll({ action: 'getScreenMute', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    base.setPoll({ action: 'getSource', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    base.setPoll({ action: 'getAudioMute', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    base.setPoll({ action: 'getAudioLevel', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    base.setPoll({ action: 'getTemperature', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })

    // Load this drivers package.json and get sources title and hexcode, add only if enabled
    let sourcesData = require('./package.json').overture.pointSetupSchema.properties.inputs.properties
    for (let name in sourcesData) {
      if (config.inputs && config.inputs[name] === true) {  // Enabled in driver config
        let source = sourcesData[name]
        logger.silly(`Adding input source: ${source.title}, Hex code: ${source.hexcode}`)
        sourcesInfo.push({title: source.title, hexcode: parseInt(source.hexcode, 16)})
      }
    }
    base.getVar('Sources').enums = sourcesInfo.map(x => x.title)

    // Create IR Commands enum based on ir_codes.json
    irCodes = require('./ir_codes.json')
    base.getVar('IRCommands').enums = ['Choose a Command'].concat(Object.keys(irCodes))

    // Create videowall variables and set polls if enabled
    if (config.videowall) {
      base.createVariable({
        name: 'TileMode',
        type: 'enum',
        enums: [
          'Off',
          '1x2',
          '2x2',
          '3x3',
          '4x4',
          '5x5'
        ],
        perform: {
          action: 'setTileMode',
          params: { Status: '$string' }
        }
      })
      base.createVariable({
        name: 'TileId',
        type: 'integer',
        min: 1,
        max: 25,
        perform: {
          action: 'setTileId',
          params: { Value: '$value' }
        }
      })
      base.setPoll({ action: 'getTileMode', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
      base.setPoll({ action: 'getTileId', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    }
  }

  function start() {
    initTcpClient()
  }

  function tick() {
    if (!tcpClient) initTcpClient()
  }

  function disconnect() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
    base.clearPendingCommands()
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
      disconnect() // Triggered on timeout, this allows auto reconnect
      base.getVar('Power').value = 0  // Allow for WOL to be sent
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

  function onFrame(data) {
    const pendingCommand = base.getPendingCommand()
    logger.silly(`onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data}`)
    
    let match = data.match(/(\w) (\d+) NG/)
    if (match && pendingCommand) {
      base.commandError('Device returned error')
      return
    }

    match = data.match(/(\w) (\d+) OK([0-9a-fA-F]+)/)
    if (match && pendingCommand) {
      let id = parseInt(match[2], 16)
      let val = parseInt(match[3], 16)
      if (id === config.setID) {
        if (match[1] === 'a') {
          base.getVar('Power').value = val
          base.commandDone()
          if (val === 0) {
            // Stop all other polling commands, and set to disconnected
            // setTimeout is needed to perform at end of event loop
            setTimeout(() => { base.clearPendingCommands() }, 0)
            base.getVar('Status').string = 'Disconnected'
          }
        }
        else if (match[1] === 'd') {
          // Could be screen mute or tile mode set
          if (pendingCommand.action === 'setTileMode') {
            base.getVar('TileMode').string = pendingCommand.params.Status
            base.commandDone()
          }
          else {
            base.getVar('ScreenMute').value = val
            base.commandDone()
          }
        }
        else if (match[1] === 'b') {
          let source = sourcesInfo.find(x => x.hexcode === val)
          if (source) {
            base.getVar('Sources').string = source.title
            base.commandDone()
          }
          else {
            base.commandError(`Could not find current source hexcode (${val.toString(16)}) in available sources`)
          }
        }
        else if (match[1] === 'e') {
          base.getVar('AudioMute').string = ['On', 'Off'][val]  // 0 = Muted, 1 = Unmuted
          base.commandDone()
        }
        else if (match[1] === 'f') {
          base.getVar('AudioLevel').value = val
          base.commandDone()
        }
        else if (match[1] === 'c') {
          base.getVar('IRCommands').value = 0  // Reset to idle state
          base.commandDone()
        }
        else if (match[1] === 'n') {
          base.getVar('Temperature').value = val
          base.commandDone()
        }
        else if (match[1] === 'z' && base.getVar('TileMode')) {
          let bytes = match[3].match(/.{2}/g).map(x => parseInt(x, 16))
          let tileMode = bytes[0]
          let cols = bytes[1]
          let rows = bytes[2]
          let tileString = (tileMode > 0) ? `${rows}x${cols}` : 'Off'
          base.getVar('TileMode').string = tileString
          base.commandDone()
        }
        else if (match[1] === 'i' && base.getVar('TileId')) {
          base.getVar('TileId').value = val
          base.commandDone()
        }
        else {
          base.commandError(`Unable to process received data: ${data}`)
        }
      }
      else {
        base.commandError(`onFrame: Set ID received (${id}) does not match configured ID (${config.setID})`)
      }
    }
    else if (match && !pendingCommand) {
      logger.warn(`Received data but no pending command: ${data}`)
    }
    else {
      logger.warn('onFrame data not processed')
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getPower() { sendDefer(`ka ${config.setID} FF\r`) }
  function getSource() { sendDefer(`xb ${config.setID} FF\r`) }
  function getScreenMute() { sendDefer(`kd ${config.setID} FF\r`) }
  function getAudioMute() { sendDefer(`ke ${config.setID} FF\r`) }
  function getAudioLevel() { sendDefer(`kf ${config.setID} FF\r`) }
  function getTemperature() { sendDefer(`dn ${config.setID} FF\r`) }
  function getTileMode() { sendDefer(`dz ${config.setID} FF\r`) }
  function getTileId() {
    if (base.getVar('TileMode').value > 0) {
      sendDefer(`di ${config.setID} FF\r`)
    }
    else {
      logger.silly('Skipping getTileId while tile mode is disabled to avoid errors')
    }
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function setPower(params) {
    if (params.Status == 'Off') {
      sendDefer(`ka ${config.setID} 00\r`)
    }
    else if (params.Status == 'On') {
      wol.wake(config.mac).then(
        () => {
          logger.silly(`setPower: WOL sent to ${config.mac}`)
        },
        error => {
          logger.error(`setPower WOL Error: ${error.message}`)
        }
      )
    }
  }

  function selectSource(params) {
    sendDefer(`xb ${config.setID} ${sourcesInfo.find(x => x.title === params.Name).hexcode.toString(16)}\r`)
  }

  function setScreenMute(params) {
    if (params.Status == 'Off') sendDefer(`kd ${config.setID} 00\r`)
    else if (params.Status == 'On') sendDefer(`kd ${config.setID} 01\r`)
  }

  function setAudioMute(params) {
    if (params.Status == 'Off') sendDefer(`ke ${config.setID} 01\r`)
    else if (params.Status == 'On') sendDefer(`ke ${config.setID} 00\r`)
  }

  function setAudioLevel(params) {
    sendDefer(`kf ${config.setID} ${params.Level.toString(16)}\r`)
  }

  function sendIRCommand(params) {
    base.getVar('IRCommands').string = params.Name  // Set to command name, and reset to idle in frame parser
    sendDefer(`mc ${config.setID} ${irCodes[params.Name]}\r`)
  }

  function setTileMode(params) {
    let rows, cols
    let match = params.Status.match(/(\d)x(\d)/)
    if (match) {
      rows = match[1]
      cols = match[2]
    }
    else {
      rows = 0
      cols = 0
    }
    sendDefer(`dd ${config.setID} ${cols.toString(16)}${rows.toString(16)}\r`)
  }

  function setTileId(params) {
    let idMax = currentTileIdMax()
    if (params.Value <= idMax) {
      sendDefer(`di ${config.setID} ${params.Value.toString(16)}\r`)
    }
    else {
      let mode = base.getVar('TileMode').string
      logger.error(`Requested Tile ID (${params.Value}) exceeds Tile Mode maximum (${mode} = ${idMax})`)
    }
  }


  // ------------------------------ HELPER FUNCTIONS ------------------------------

  function currentTileIdMax() {
    // Make sure the current Tile ID is <= rows x cols, otherwise reset to 1
    let match = base.getVar('TileMode').string.match(/(\d)x(\d)/)
    if (match) {
      return parseInt(match[1]) * parseInt(match[2])
    }
    else {
      return 1
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    setPower, selectSource, setScreenMute, setAudioMute, setAudioLevel, sendIRCommand, setTileMode, setTileId,
    getPower, getSource, getScreenMute, getAudioMute, getAudioLevel, getTemperature, getTileMode, getTileId
  }
}
