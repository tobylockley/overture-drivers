'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const SNMP_TIMEOUT = 2000          // SNMP request timeout
const TCP_TIMEOUT = 30000          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 10000   // How long to wait before attempting to reconnect

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  let networkUtilities  // Used for pinging device
  let snmp = require('snmp-native')
  let snmpSession
  let wol = require('wol')  // Used to turn wake from power off, must be enabled in menu
  let sourcesInfo = []  // Used to store inputs sources hex codes
  let irCodes  // Populated during setup from ir_codes.json
  let oids  // Populated during setup from oids.json

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('x')
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function setup(_config) {
    config = _config

    // Create IR Commands enum based on ir_codes.json
    irCodes = importIrCodes('./ir_codes.json')
    base.getVar('IRCommands').enums = ['Choose a Command'].concat(Object.keys(irCodes))

    // Load SNMP OID values in array format
    oids = importOids('./oids.json')

    base.setTickPeriod(TICK_PERIOD)
    base.setPoll({ action: 'getAll', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })

    // Load this drivers package.json and get sources title and hexcode, add only if enabled
    let sourcesData = require('./package.json').overture.pointSetupSchema.properties.inputs.properties
    for (let name in sourcesData) {
      if (config.inputs && config.inputs[name] === true) {  // Enabled in driver config
        let source = sourcesData[name]
        if (name === 'custom') {
          source.title = config.custom_title ? config.custom_title : source.title
          source.hexcode = config.custom_hexcode ? config.custom_hexcode : source.hexcode
        }
        logger.silly(`Adding input source: ${source.title}, Hex code: ${source.hexcode}`)
        sourcesInfo.push({title: source.title, hexcode: parseInt(source.hexcode, 16)})
      }
    }
    base.getVar('Sources').enums = sourcesInfo.map(x => x.title)

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
      base.setPoll({ action: 'getTileMode', period: POLL_PERIOD, enablePollFn: isTcpConnected, startImmediately: true })
      base.setPoll({ action: 'getTileId', period: POLL_PERIOD, enablePollFn: isTcpConnected, startImmediately: true })
    }
  }

  function start() {
    networkUtilities = host.createNetworkUtilities()
    base.startPolling()
    snmpSession = new snmp.Session({
      host: config.host,
      port: config.port,
      community: 'lgecommer',
      timeouts: [SNMP_TIMEOUT]
    })
  }

  function stop() {
    networkUtilities = null
    base.stopPolling()
    base.clearPendingCommands()
    snmpSession && snmpSession.close()
    snmpSession = null
    tcpClient && tcpClient.end()
    tcpClient = null
    base.getVar('Status').value = 0
    base.getVar('Power').value = 0
    base.getVar('Status_TCP_Port').value = 0
  }

  function tick() {
    if (!tcpClient) initTcpClient()
    // Check network connection
    networkUtilities.ping(config.host, {timeout: SNMP_TIMEOUT})
      .then(result => {
        if (result == true && base.getVar('Status').value === 0) {
          base.getVar('Status').value = 1  // Set to connected
          base.getVar('Power').value = 1  // Connection means power is on
        }
        else if (result == false) {
          base.getVar('Status').value = 0  // Set to disconnected
          base.getVar('Power').value = 0  // Set power off to allow WOL
        }
      })
      .catch(error => {
        logger.error(`Ping Error: ${error.message}`)
      })
  }


  //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
  function initTcpClient() {
    if (tcpClient) return // Return if tcpClient already exists

    logger.debug('Initialising TCP Client')
    tcpClient = host.createTCPClient()
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
    })
    tcpClient.connect(config.tcp_port, config.host)

    tcpClient.on('connect', () => {
      logger.silly(`TCPClient connected on port ${config.tcp_port}`)
      base.getVar('Status_TCP_Port').string = 'Connected'
      base.startPolling()
    })

    tcpClient.on('data', data => {
      frameParser.push(data.toString())
    })

    tcpClient.on('close', () => {
      logger.silly('TCPClient closed')
      base.getVar('Status_TCP_Port').value = 0 // Triggered on timeout, this allows auto reconnect
    })

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`)
      base.getVar('Status_TCP_Port').value = 0
      tcpClient.end()
      tcpClient = null
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
        if (match[1] === 'd') {
          // Could be screen mute or tile mode set
          if (pendingCommand.action === 'setTileMode') {
            base.getVar('TileMode').string = pendingCommand.params.Status
            base.commandDone()
          }
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
  function getAll() {
    // Retrieve all registered SNMP OIDs and update overture variables
    let varlist = Object.keys(oids).filter( x => x !== 'IRCommands')
    let varlist_oids = varlist.map( x => oids[x] )
    let varlist_string = varlist.reduce( (acc, x) => acc + ', ' + x )
    logger.debug(`Retrieving SNMP values for ${varlist_string}`)
    base.commandDefer(CMD_DEFER_TIME)
    snmpSession.getAll({ oids: varlist_oids }, function (error, varbinds) {
      if (error) {
        logger.error(`getAll error: ${error.message}`)
      }
      base.commandDone()
      // logger.silly(`varbinds: ${JSON.stringify(varbinds, null, 2)}`)
      for (let varbind of varbinds) {
        let varname = Object.keys(oids).find( x => compareOidArrays(oids[x], varbind.oid) )
        let value = parseInt(varbind.value, 16)  // Parse hex string into integer value
        logger.debug(`${varname}: ${varbind.oid} = ${value} (${varbind.value})`)
        if (varname === 'Sources') {
          let source = sourcesInfo.find( x => x.hexcode === value )
          if (source) {
            value = sourcesInfo.indexOf(source)  // Set value to index of source enum
          }
          else {
            logger.error(`Could not find current source hexcode (${value.toString(16)}) in available sources`)
            continue  // Go to next varbind
          }
        }
        else if (varname === 'AudioMute') {
          value = [1, 0][value]  // Mute logic is reversed
        }
        base.getVar(varname).value = value
      }
    })
  }

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
    // params: Status
    if (params.Status == 0) {
      setSnmpVar('Power', params.Status)
    }
    else if (params.Status == 1) {
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
    // params: Name
    let sourceval = sourcesInfo.find( x => x.title === params.Name ).hexcode
    setSnmpVar('Sources', sourceval)
  }

  function setScreenMute(params) {
    // params: Status
    setSnmpVar('ScreenMute', params.Status)
  }

  function setAudioMute(params) {
    // params: Status
    setSnmpVar('AudioMute', [1, 0][params.Status])  // Logic is reversed
  }

  function setAudioLevel(params) {
    // params: Level
    setSnmpVar('AudioLevel', params.Level)
  }

  function sendIRCommand(params) {
    // params: Name
    base.getVar('IRCommands').string = params.Name  // Set to command name, and reset to idle in response handler
    setSnmpVar('IRCommands', irCodes[params.Name])
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

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function isTcpConnected() { return base.getVar('Status_TCP_Port').string === 'Connected' }

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

  function importIrCodes(fname) {
    // Import IR codes from json as hex strings, convert to object of name: integer values
    let codes_strings = require(fname)
    let codes = {}
    for (let command in codes_strings) {
      codes[command] = parseInt(codes_strings[command], 16)
    }
    return codes
  }

  function importOids(fname) {
    // Import from json in string format, and convert to array format for snmp-native module
    let oids_strings = require(fname)
    let oids_arrays = {}
    for (let varname in oids_strings) {
      oids_arrays[varname] = getOidArray(oids_strings[varname])
    }
    return oids_arrays
  }

  function getOidArray(oidString) {
    if (typeof oidString === 'string' || oidString instanceof String) {
      return oidString.match(/\.?\d+/g).map(x => parseInt(x.replace('.','')))
    }
    else {
      logger.error(`getOidArray requires a string as input, but got ${typeof oidString}: ${oidString}`)
    }
  }

  function compareOidArrays(oid1, oid2) {
    if ( !(oid1 instanceof Array) || !(oid2 instanceof Array) ) {
      throw new Error('compareOidArray only accepts arrays as input')
    }
    if (oid1.length !== oid2.length) return false
    for (let i = 0; i < oid1.length; i++) {
      if (oid1[i] !== oid2[i]) return false
    }
    return true
  }

  function setSnmpVar(varname, value) {
    // Type 4 = Octet String
    snmpSession.set({ oid: oids[varname], value: value.toString(16).padStart(2, '0'), type: 4 }, function (error) {
      if (error) {
        logger.error(`set ${varname} error: ${error.message}`)
      }
      else {
        if (varname === 'Power' || varname === 'ScreenMute' || varname === 'AudioLevel') {
          base.getVar(varname).value = value  // Simple integer value
        }
        else if (varname === 'AudioMute') {
          base.getVar('AudioMute').value = [1, 0][value]  // Logic is reversed
        }
        else if (varname === 'Sources') {
          let sourcename = sourcesInfo.find( x => x.hexcode === value ).title
          base.getVar('Sources').string = sourcename
        }
        else if (varname === 'IRCommands') {
          base.getVar('IRCommands').value = 0  // Set back to idle state
        }
        else {
          logger.error(`setSnmpVar: no logic found for ${varname}`)
        }
      }
    })
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    setPower, selectSource, setScreenMute, setAudioMute, setAudioLevel, sendIRCommand, setTileMode, setTileId,
    getAll, getTileMode, getTileId
  }
}
