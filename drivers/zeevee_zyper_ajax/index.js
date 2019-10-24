'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 10000          // In-built tick interval
const POLL_PERIOD_FAST = 5000      // Continuous polling function interval
const POLL_PERIOD_SLOW = 30000     // Continuous polling function interval, for less frequent tasks like updating source list
const REQUEST_TIMEOUT = 2000       // Timeout for AJAX requests

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
        enums: ['See function updateAvailableSources()'],
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
        enums: ['See function updateAvailableSources()'],
        perform: {
          action: 'selectSource',
          params: { Channel: wall.name, Name: '$string' }
        }
      })
    }

    // Initialise variables for Audio switching
    for (let decoder of config.decoders) {
      decoder.varname_audio = `Audio_${decoder.name.replace(/[^A-Za-z0-9_]/g, '')}`  // Make legal variable name
      base.createVariable({
        name: decoder.varname_audio,
        type: 'enum',
        enums: ['See function updateAvailableSources()'],
        perform: {
          action: 'joinAudio',
          params: { Channel: decoder.name, Name: '$string' }
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
          enums: ['See function updateAvailableSources()'],
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


  // ------------------------------ GET FUNCTIONS ------------------------------

  async function updateDecoders() {
    try {
      let response = await zyperCmd('show device config decoders')
      // let response_status = await zyperCmd('show device status decoders')
      // Process each decoder in response
      for (let decoder of response.text) {
        let decoder_config = config.decoders.find(x => x.name === decoder.gen.name)
        let varname_sources = decoder_config.varname_sources
        let varname_usb = decoder_config.varname_usb
        let varname_audio = decoder_config.varname_audio

        if (decoder.connectedEncoder.name === 'N/A') {
          base.getVar(varname_sources).value = 0  // Set to 'None', first enum entry
        }
        else {
          base.getVar(varname_sources).string = decoder.connectedEncoder.name
        }

        if (decoder.usbUplink && decoder.usbUplink.name) {
          if (decoder.usbUplink.name === 'none') {
            base.getVar(varname_usb).value = 0  // Set to 'None', first enum entry
          }
          else {
            base.getVar(varname_usb).string = decoder.usbUplink.name
          }
        }

        if (decoder.autoAudioConnections && decoder.autoAudioConnections.hdmiAudioFollowVideo === 'true') {
          base.getVar(varname_audio).value = 0  // Audio follows Video
        }
        else if (decoder.audioConnections) {
          // Determine if analog or hdmi
          let analogSource = decoder.audioConnections.analogSourceName
          let hdmiSource = decoder.audioConnections.hdmiAudioSourceName
          if (analogSource !== 'none') {
            let re = new RegExp(`ANALOG.*?${analogSource}`, 'i')
            let s = base.getVar(varname_audio).enums.find(x => re.test(x))
            base.getVar(varname_audio).string = s
          }
          else if (hdmiSource !== 'none') {
            let re = new RegExp(`HDMI.*?${hdmiSource}`, 'i')
            let s = base.getVar(varname_audio).enums.find(x => re.test(x))
            base.getVar(varname_audio).string = s
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
      let sourcesByType = {
        'ZyperUHD': encoders.filter(x => x.gen.model === 'ZyperUHD').map(x => x.gen.name).sort(),
        'Zyper4K': encoders.filter(x => x.gen.model === 'Zyper4K').map(x => x.gen.name).sort(),
        'MV': multiviews.map(x => x.gen.name).sort()
      }

      for (let decoder of config.decoders) {
        let data = decoders.find(x => x.gen.name === decoder.name)
        let sources = ['None'].concat(sourcesByType[data.gen.model])
        let audioSources = ['Audio Follows Video']

        // For ZyperUHD, add USB and analog audio sources
        if (data.gen.model === 'ZyperUHD') {
          base.getVar(decoder.varname_usb).enums = sources
          audioSources = audioSources.concat(sourcesByType['ZyperUHD'].map(x => `[HDMI] ${x}`))
          audioSources = audioSources.concat(sourcesByType['ZyperUHD'].map(x => `[ANALOG] ${x}`))
        }
        
        // For Zyper4K, add multiviews
        if (data.gen.model === 'Zyper4K') {
          sources = sources.concat(sourcesByType['MV'])
          audioSources = audioSources.concat(sourcesByType['Zyper4K'])
        }

        base.getVar(decoder.varname_sources).enums = sources
        base.getVar(decoder.varname_audio).enums = audioSources
      }

      for (let wall of config.videowalls) {
        let data = videowalls.find(x => x.gen.name === wall.name)
        let wallModel = decoders.find(x => x.gen.name === data.decodersRow1.col1).gen.model
        base.getVar(wall.varname_sources).enums = ['None'].concat(sourcesByType[wallModel])
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
        await zyperCmd(`join ${params.Name} ${params.Channel} ${joinmethod}`)
        base.getVar(varname_sources).string = params.Name  // No need to pass the response. If no errors, source was set OK
      }
      else if (wall) {
        joinmethod = 'video-wall'
        varname_sources = wall.varname_sources
        await zyperCmd(`join ${params.Name} ${params.Channel} ${joinmethod}`)
        base.getVar(varname_sources).string = params.Name  // No need to pass the response. If no errors, source was set OK
      }
    }
    catch (error) {
      logger.error(`selectSource > ${error.message}`)
    }
  }

  async function joinAudio(params) {
    try {
      let decoder = config.decoders.find(x => x.name === params.Channel)
      let varname_audio = decoder.varname_audio
      if (base.getVar(varname_audio).enums.indexOf(params.Name) === 0) {
        // Audio Follows Video
        params.Name = 'video-source'
      }
      let jointype = 'audio'
      if (params.Name.includes('[HDMI] ')) {
        jointype = 'hdmi-audio'
        params.Name = params.Name.replace('[HDMI] ', '')
      }
      else if (params.Name.includes('[ANALOG] ')) {
        jointype = 'analog-audio'
        params.Name = params.Name.replace('[ANALOG] ', '')
      }
      await zyperCmd(`join ${params.Name} ${params.Channel} ${jointype}`)
      base.getVar(varname_audio).string = params.Name  // No need to pass the response. If no errors, source was set OK
    }
    catch (error) {
      logger.error(`joinAudio > ${error.message}`)
    }
  }

  async function joinUSB(params) {
    try {
      let decoder = config.decoders.find(x => x.name === params.Channel)
      let varname_usb = decoder.varname_usb
      await zyperCmd(`join ${params.Name} ${params.Channel} usb`)
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
    selectSource, joinAudio, joinUSB
  }
}