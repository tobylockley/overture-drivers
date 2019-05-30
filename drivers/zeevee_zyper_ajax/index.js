'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 10000          // In-built tick interval
const POLL_PERIOD_FAST = 5000      // Continuous polling function interval
const POLL_PERIOD_SLOW = 30000     // Continuous polling function interval, for less frequent tasks like updating source list
const REQUEST_TIMEOUT = 2000       // Timeout for AJAX requests

const VWALL_NAMING_TEMPLATE = 'VW_<vw_name>_<enc_name>'  // Change this to alter the appearance in overture source list
const MVIEW_NAMING_TEMPLATE = 'MV_<mv_name>'  // Change this to alter the appearance in overture source list

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Polling functions needed to update source list, not needed as frequently
    base.setPoll({ action: 'updateAvailableSources', period: POLL_PERIOD_SLOW, enablePollFn: isConnected, startImmediately: true })

    // Register fast polling functions, like retrieving current source
    base.setPoll({ action: 'updateDecoders', period: POLL_PERIOD_FAST, enablePollFn: isConnected, startImmediately: true })

    // Initialise variables for each decoder
    for (let decoder of config.decoders) {
      decoder.varname_sources = `Sources_${decoder.name.replace(/[^A-Za-z0-9_]/g, '')}`  // Make legal variable name
      base.createVariable({
        name: decoder.varname_sources,
        type: 'enum',
        enums: ['None'],
        perform: {
          action: 'selectSource',
          params: { Channel: decoder.name, Name: '$string' }
        }
      })
    }

    // Initialise variables for each video wall
    for (let wall of config.videowalls) {
      wall.varname_sources = `Sources_VideoWall_${wall.name.replace(/[^A-Za-z0-9_]/g, '')}`  // Make legal variable name
      base.createVariable({
        name: wall.varname_sources,
        type: 'enum',
        enums: ['None'],
        perform: {
          action: 'selectSource',
          params: { Channel: wall.name, Name: '$string' }
        }
      })
    }

    // Initialise variables for USB switching (ZyperUHD)
    for (let decoder of config.decoders) {
      if (decoder.model === 'ZyperUHD') {
        decoder.varname_usb = `USB_${decoder.name.replace(/[^A-Za-z0-9_]/g, '')}`  // Make legal variable name
        base.createVariable({
          name: decoder.varname_usb,
          type: 'enum',
          enums: ['None'],
          perform: {
            action: 'joinUSB',
            params: { Channel: decoder.name, Name: '$string' }
          }
        })
      }
    }
  }

  function start() {
    base.startPolling()
    tick()  // Get the connection state straight away
    updateAvailableSources()  // Update decoders and video walls with all available sources
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
    base.clearPendingCommands()
  }

  async function tick() {
    try {
      let response = await zyperCmd('show server info')  // If no error is thrown, command succeeded
      if (base.getVar('Status').string === 'Disconnected') {
        base.getVar('Status').string = 'Connected'
        base.getVar('MacAddress').string = response.text.gen.macAddress
        base.getVar('SerialNumber').string = response.text.gen.serialNumber
        base.getVar('FirmwareVersion').string = response.text.gen.version
      }
    }
    catch (error) {
      base.getVar('Status').string === 'Disconnected'
      logger.error(`tick > ${error.message}`)
    }
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  async function zyperCmd(cmdString) {
    base.commandDefer(CMD_DEFER_TIME)
    try {
      logger.silly(`Running zyperCmd > ${cmdString}`)
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

    if (pendingCommand && pendingCommand.action == 'getDecoderStatus') {
      decoder_status = importZyperData(data)
      if (decoder_status.length == 0) {
        logger.error('No decoder status information available. Check connection to Zyper MP.')
        return
      }

      // Decipher status and update current sources
      config.decoders.forEach( decoder => {
        // decoder.model
        // decoder.name
        // decoder.varname
        let this_status = decoder_status.filter(device => device.gen.name == decoder.name)
        if (this_status.length != 1) {
          logger.error(`onFrame/getDecoderStatus: Retrieving device status for ${decoder.name} failed. Possible duplicate device names, or incorrect name.`)
          return
        }
        this_status = this_status[0]  // Should be only 1 entry, no need to store in an array

        // Retrieve this decoders source list from overture enum
        let this_sources = base.getVar(decoder.varname).enums

        // Is decoder showing a video wall?
        if (this_status.activeVideoWall.name == 'none') {
          if (this_status.connectedEncoder.mac == 'none') {
            // DECODER HAS NO SOURCE ATTACHED
            base.getVar(decoder.varname).string = 'None'
          }
          else if (this_status.connectedEncoder.mac == 'multiview') {
            // MULTIVIEW
            let mv_sourcename = MVIEW_NAMING_TEMPLATE.replace('<mv_name>', this_status.connectedEncoder.name)
            let result = this_sources.filter(source => source == mv_sourcename)
            if (result.length == 1) {
              // multiview found in source list, set current source
              base.getVar(decoder.varname).string = result[0]
            }
            else {
              logger.error(`onFrame/getDecoderStatus: Multiview '${this_status.connectedEncoder.name}' not found in source list for ${decoder.name}`)
            }
          }
          else {
            // REGULAR ENCODER
            let result = this_sources.filter(source => source == this_status.connectedEncoder.name)
            if (result.length == 1) {
              // encoder found in source list, set current source
              base.getVar(decoder.varname).string = result[0]
            }
            else {
              logger.error(`onFrame/getDecoderStatus: Encoder '${this_status.connectedEncoder.name}' not found in source list for ${decoder.name}`)
            }
          }
        }
        else {
          // VIDEOWALL - search source list for videowall name and connected encoder  `VW_${vw_name}_${encoder}`
          let vw_sourcename = VWALL_NAMING_TEMPLATE.replace('<vw_name>', this_status.activeVideoWall.name).replace('<enc_name>', this_status.connectedEncoder.name)
          let result = this_sources.filter(source => source == vw_sourcename)
          if (result.length == 1) {
            // encoder found in source list, set current source
            base.getVar(decoder.varname).string = result[0]
          }
          else {
            logger.error(`onFrame/getDecoderStatus: Videowall source '${vw_sourcename}' not found in source list for ${decoder.name}`)
          }
        }
      })
      base.commandDone()
    }
    else if (pendingCommand && pendingCommand.action == 'selectSource') {
      if (data.includes('Success')) base.commandDone()
      else base.commandError(`onFrame/selectSource: Unexpected response: ${data}`)

      // Print warning to logs
      let match = data.match(/Warning.*(?=[\r\n])/)
      match && logger.error(`selectSource[${pendingCommand.params.Channel}]: ${match[0]}`)
    }

  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  async function updateDecoders() {
    try {
      let response = await zyperCmd('show device config decoders')
      let response_status = await zyperCmd('show device status decoders')
      // Process each decoder in response
      for (let decoder of response.text) {
        let decoder_config = config.decoders.find(x => x.name === decoder.gen.name)
        let varname_sources = decoder_config.varname_sources
        let varname_usb = decoder_config.varname_usb

        if (decoder.connectedEncoder.name === 'N/A') {
          base.getVar(varname_sources).value = 0  // Set to 'None', first enum entry
        }
        else {
          base.getVar(varname_sources).string = decoder.connectedEncoder.name
        }

        if (decoder_config.usb_enabled) {
          if (decoder.usbUplink.name === 'none') {
            base.getVar(varname_usb).value = 0  // Set to 'None', first enum entry
          }
          else {
            base.getVar(varname_usb).string = decoder.usbUplink.name
          }
        }
      }
    }
    catch (error) {
      logger.error(`updateDecoders > ${error.message}`)
    }
  }

  async function updateAvailableSources() {
    try {
      let encoders = await zyperCmd('show device config encoders')
      let decoders = await zyperCmd('show device config decoders')
      let videowalls = await zyperCmd('show video-walls')
      let multiviews = await zyperCmd('show multiviews config')

      encoders = encoders.text
      decoders = decoders.text
      videowalls = videowalls.text
      multiviews = multiviews.text

      // Store for reference (used in selectSource)
      config.multiviews = multiviews
      config.encoders = encoders

      // Generate a sorted array for each type of encoder
      let sources = {
        'ZyperUHD': encoders.filter(x => x.gen.model === 'ZyperUHD').map(x => x.gen.name).sort(),
        'Zyper4K': encoders.filter(x => x.gen.model === 'Zyper4K').map(x => x.gen.name).sort(),
        'MV': multiviews.map(x => x.gen.name).sort()
      }

      for (let decoder of config.decoders) {
        let data = decoders.find(x => x.gen.name === decoder.name)
        let temp = ['None'].concat(sources[data.gen.model])
        // Init enums for USB variable if enabled
        if (data.gen.model === 'ZyperUHD' && decoder.usb_enabled) {
          base.getVar(decoder.varname_usb).enums = temp
        }
        // If Zyper4K, add multiviews
        if (data.gen.model === 'Zyper4K') temp = temp.concat(sources['MV'])
        base.getVar(decoder.varname_sources).enums = temp
      }

      for (let wall of config.videowalls) {
        let data = videowalls.find(x => x.gen.name === wall.name)
        let wallModel = decoders.find(x => x.gen.name === data.decodersRow1.col1).gen.model
        base.getVar(wall.varname_sources).enums = ['None'].concat(sources[wallModel])
      }
    }
    catch (error) {
      logger.error(`updateAvailableSources > ${error.message}`)
    }
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  async function selectSource(params) {
    try {
      let joinmethod
      let varname_sources
      let decoder = config.decoders.find(x => x.name === params.Channel)
      let wall = config.videowalls.find(x => x.name === params.Channel)
      // Determine join method based on decoder/videowall, and encoder/multiview as source
      if (decoder) {
        if (config.encoders.find(x => x.gen.name === params.Name)) {
          joinmethod = 'fast-switched'
        }
        else if (config.multiviews.find(x => x.gen.name === params.Name)) {
          joinmethod = 'multiview'
        }
        else if (params.Name === 'None') {
          params.Name = 'none'
          joinmethod = 'fast-switched'
        }
        varname_sources = decoder.varname_sources
        if (params.Name === 'None') {
          params.Name = 'none'
          joinmethod = 'fast-switched'
        }
        let response = await zyperCmd(`join ${params.Name} ${params.Channel} ${joinmethod}`)
        base.getVar(varname_sources).string = params.Name  // No need to pass the response. If no errors, source was set OK
      }
      else if (wall) {
        joinmethod = 'video-wall'
        varname_sources = wall.varname_sources
        let response = await zyperCmd(`join ${params.Name} ${params.Channel} ${joinmethod}`)
        base.getVar(varname_sources).string = params.Name  // No need to pass the response. If no errors, source was set OK
      }
    }
    catch (error) {
      logger.error(`selectSource > ${error.message}`)
    }
  }

  async function joinUSB(params) {
    try {
      let decoder = config.decoders.find(x => x.name === params.Channel)
      let varname_usb = decoder.varname_usb
      let response = await zyperCmd(`join ${params.Name} ${params.Channel} usb`)
      base.getVar(varname_usb).string = params.Name  // No need to pass the response. If no errors, source was set OK
    }
    catch (error) {
      logger.error(`joinUSB > ${error.message}`)
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    updateDecoders, updateAvailableSources,
    selectSource, joinUSB
  }
}