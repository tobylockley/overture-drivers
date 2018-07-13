'use strict';

const POLL_PERIOD = 5000
const TELNET_TIMEOUT = 30000  // Socket will timeout after specified milliseconds of inactivity
const SEND_TIMEOUT = 1000  // Timeout when using telnet send function

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config

  let Telnet = require('telnet-client')
  let telnetClient

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('Zyper$')
  frameParser.on('data', data => onFrame(data))

  const isConnected = () => { return base.getVar('Status').string === 'Connected' }

  const setup = _config => {
    config = _config

    // Possible config.devices (all boolean):
    // .encoders_uhd
    // .decoders_uhd
    // .encoders_4k
    // .decoders_4k
    // .multiviews
    // .videowalls

    if (config.devices.encoders_uhd) base.createVariable({ name: 'Encoders_UHD', type: 'enum'})
    if (config.devices.encoders_4k) base.createVariable({ name: 'Encoders_4K', type: 'enum'})
    if (config.devices.multiviews) base.createVariable({ name: 'Multiviews', type: 'enum'})

    if (config.videowalls.length > 0) {
      config.videowalls.forEach(vw => {
        let sources = ['Idle']
        if (vw.model === 'Zyper4K') sources = sources.concat(temp4K)
        else if (vw.model === 'ZyperUHD') sources = sources.concat(tempUHD)
        base.createVariable({
          name: `VideoWall_${vw.name.replace(/[^A-Za-z0-9_]/g, '')}`,  // Ensure legal variable name
          type: 'enum',
          enums: sources,  // Will be populated with appropriate sources above
          perform: {
            action: 'startVideoWall',
            params: { Name: vw.name, Source: '$string' }
          }
        })
      });
    }

    if (config.decoders.length > 0) {
      config.decoders.forEach(decoder => {
        let sources = ['VideoWall']
        if (decoder.model === 'Zyper4K') sources = sources.concat(temp4K.concat(tempMV))
        else if (decoder.model === 'ZyperUHD') sources = sources.concat(tempUHD)
        base.createVariable({
          name: `Decoder_${decoder.name.replace(/[^A-Za-z0-9_]/g, '')}`,  // Ensure legal variable name
          type: 'enum',
          enums: sources,  // Will be populated with appropriate sources above
          perform: {
            action: 'setDecoder',
            params: { Name: decoder.name, Source: '$string' }
          }
        })
      });
    }

    base.setPoll({
      action: 'getInfo',
      period: POLL_PERIOD,
      enablePollFn: isConnected
    });
  }

  const start = () => {
    initTelnetClient()
    telnetClient.connect({
      host: config.host,
      port: config.port,
      timeout: TELNET_TIMEOUT,
      initialLFCR: true,
      sendTimeout: SEND_TIMEOUT
    })
    initVariables()
    base.startPolling()
  }

  const stop = () => {
    disconnect()
    telnetClient && telnetClient.end()
  }

  const initTelnetClient = () => {
    if (!telnetClient) {
      telnetClient = new Telnet()

      telnetClient.on('connect', function () {
        logger.silly('Telnet connected!')
        base.getVar('Status').string = 'Connected'
      })

      telnetClient.on('data', (chunk) => {
        frameParser.push(chunk)
      })

      telnetClient.on('close', function () {
        logger.silly('telnet closed')
        disconnect()
      })

      telnetClient.on('error', err => {
        logger.error(`telnetClient: ${err}`)
        disconnect()
        telnetClient && telnetClient.end()
      })
    }
  }

  const send = data => {
    logger.silly(`Telnet send: ${data}`)
    telnetClient.send(`${data}\r\n`)
  }

  const sendDefer = data => {
    logger.silly(`Telnet sendDefer: ${data}`)
    base.commandDefer(1000)
    telnetClient.send(`${data}\r\n`).then(result => {
      // Handled in onFrame
      // logger.silly(`Telnet send OK: ${data}`)
    }, err => {
      base.commandError(`Telnet send error: ${err}`)
    })
  }

  const getInfo = () => { sendDefer('show device config decoders') }

  const initVariables = () => {
    // ENCODERS
    if (config.devices.encoders_uhd || config.devices.encoders_4k) sendDefer('show device config encoders')
    telnetClient.send(`show device status encoders\r\n`).then(data => {
      let match, temp = []
      logger.silly('-------------- ZYPER ENCODER INFO --------------')
      logger.debug(data)
      let regex = /device\.gen.*?model=(.*?),.*?name=(.*?),/g;
      while (match = regex.exec(data)) {
        logger.silly(`Name: ${match[2]} Model: ${match[1]}`)
        temp.push({name: match[2], model: match[1]})
      }
      temp.sort((a,b) => a.name.localeCompare(b.name))
      encoders_uhd = temp.filter(x => x.model == 'ZyperUHD')
      base.getVar('Encoders_UHD').enums = encoders_uhd.map(x => x.name)
      encoders_4k = temp.filter(x => x.model == 'Zyper4K')
      base.getVar('Encoders_4K').enums = encoders_4k.map(x => x.name)

      // MULTIVIEWS
      telnetClient.send(`show multiviews status\r\n`).then(data => {
        logger.silly('------------- ZYPER MULTIVIEWS INFO ------------')
        let regex = /multiview\((.+?)\)/g;
        while (match = regex.exec(data)) {
          logger.silly(`Name: ${match[1]}`)
          multiviews.push(match[1])
        }
        multiviews.sort()
        base.getVar('Multiviews').enums = multiviews

        // DECODERS
        telnetClient.send(`show device status decoders\r\n`).then(data => {
          logger.silly('-------------- ZYPER DECODER INFO --------------')
          let regex = /device\.gen.*?model=(.+?),.*?name=(.+?),[\s\S]*?connectedEncoder.+?name=(.+?),/g;
          while (match = regex.exec(data)) {
            logger.silly(`Name: ${match[2]}, Model: ${match[1]}, Source: ${match[3]}`)
            decoders.push({name: match[2], model: match[1], source: match[3]})
          }
          decoders.sort((a,b) => a.name.localeCompare(b.name))
          // Create variable for each decoder
          decoders.forEach(decoder => {
            let sources
            if (decoder.model === 'Zyper4K') sources = encoders_4k.map(x => x.name).concat(multiviews)
            else if (decoder.model === 'ZyperUHD') sources = encoders_uhd.map(x => x.name)
            base.createVariable({
              name: `Decoder_${decoder.name.replace(/[^A-Za-z0-9_]/g, '')}`,  // Ensure legal variable name
              type: 'enum',
              enums: sources,  // Will be populated with appropriate sources above
              perform: {
                action: 'setDecoder',
                params: { Name: decoder.name, Source: '$string' }
              }
            }).string = decoder.source  // Set the current source WARNING: Not checking against valid list
          });
        })

      })

    })
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  const setDecoder = params => {
    // Search for source name to determine join mode
    // params.Name params.Source
    let joinmode
    if (base.getVar('Encoders_UHD').enums.includes(params.Source)) {
      // UHD Encoder
      joinmode = 'fast-switched'
    }
    else if (base.getVar('Encoders_4K').enums.includes(params.Source)) {
      // 4k Encoder
      joinmode = 'fast-switched' // Could also be 'genlocked'
    }
    if (base.getVar('Multiviews').enums.includes(params.Source)) {
      // Multiview
      joinmode = 'multiview'
    }
    sendDefer(`join ${params.Source} ${params.Name} ${joinmode}`)

    // Set HDMI switcher output accordingly
    let match = params.Name.match(/dec(\d)/)
    let screenId = parseInt(match[1])  // Hackish way to get the number from the decoder name
    if (params.Name.includes('UHD')) setScreenMode({ScreenId: screenId, Mode: 'UHD'})
    else if (params.Name.includes('4K')) setScreenMode({ScreenId: screenId, Mode: '4K'})
  }

  const setScreenMode = params => {
    // Sends command to TechLogix HDMI switcher
    // ScreenId should = 1-4, corresponding to UHD_dec[1-4]
    if (params.Mode === 'UHD') sendDefer(`send UHD_dec${params.ScreenId} rs232 HDMI1%`)
    else if (params.Mode === '4K') sendDefer(`send UHD_dec${params.ScreenId} rs232 HDMI2%`)
    // Ignores 'Unknown' screen mode
  }

  const startVideoWall = params => {
    sendDefer(`set video-wall-encoder ${params.Source} ${params.Name}`)
    // Set HDMI switcher output accordingly for all screens
    for (let i = 1; i <= 4; i++) {
      if (params.Source.includes('UHD')) setScreenMode({ScreenId: i, Mode: 'UHD'})
      else if (params.Source.includes('4K')) setScreenMode({ScreenId: i, Mode: '4K'})
    }
  }

  const onFrame = data => {
    let match  // Used for regex matching NOTE: [\s\S] will match any character, even newlines
    logger.silly(`onFrame: ${data}`)

    match = data.match(/join (.+?) (.+?) [\s\S]*?Success/)
    if (match) {
      base.commandDone()
      base.getVar(`Decoder_${match[2]}`).string = match[1]
    }

    match = data.match(/set video-wall-encoder[\s\S]*?Success/)
    if (match) {
      base.commandDone()
    }

    match = data.match(/send UHD_dec(\d) rs232 HDMI(\d)[\s\S]*?Success/)
    if (match) {
      base.commandDone()
      base.getVar(`ScreenMode${match[1]}`).value = match[2]  // 1 = UHD, 2 = 4K
    }

    // Response from polling command
    match = data.match(/show device config decoders/)
    if (match) {
      base.commandDone()
      // Parse all decoders
      let regex = /device\.gen.*?model=(.+?),.*?name=(.+?),[\s\S]*?connectedEncoder;.*?name=(.+?),.*?connectionMode=(.+)/g;
      while (match = regex.exec(data)) {

        let this_decoder = base.getVar(`Decoder_${match[2]}`)
        if (!this_decoder) {
          // Variable does not exist yet, so create it
          let sources_uhd = base.getVar('Encoders_UHD').enums
          let sources_4k = base.getVar('Encoders_4K').enums
          let sources_mv = base.getVar('Multiviews').enums
          let sources = ['VideoWall']
          if (match[1] === 'ZyperUHD') sources = sources.concat(sources_uhd)
          else if (match[1] === 'Zyper4K') sources = sources.concat(sources_uhd.concat(sources_mv))
          this_decoder = base.createVariable({
            name: `Decoder_${match[2]}`,  // Ensure legal variable name
            type: 'enum',
            enums: sources,  // Will be populated with appropriate sources above
            perform: {
              action: 'setDecoder',
              params: { Name: decoder.name, Source: '$string' }
            }
          });
        }

        if (match[4].includes('wall')) base.getVar(`Decoder_${match[2]}`).string = 'VideoWall'
        else base.getVar(`Decoder_${match[2]}`).string = match[3]
      }
    }

    // Response from initVariables
    match = data.match(/show device config encoders/)
    if (match) {
      base.commandDone()
      logger.silly('-------------- ZYPER ENCODER INFO --------------')
      let temp_uhd = [], temp_4k = []  // Temp arrays for building the variable enums
      let regex = /device\.gen.*?model=(.+?),.*?name=(.+?),/g;
      while (match = regex.exec(data)) {
        logger.silly(`Name: ${match[2]} Model: ${match[1]}`)
        if (match[1] === 'ZyperUHD') temp_uhd.push(match[2])
        if (match[1] === 'Zyper4K') temp_4k.push(match[2])
      }
      temp_uhd.sort()
      temp_4k.sort()
      if (config.devices.encoders_uhd) base.getVar('Encoders_UHD').enums = temp_uhd
      if (config.devices.encoders_4k) base.getVar('Encoders_4K').enums = temp_4k
    }

    // Response from initVariables
    match = data.match(/show multiviews config/)
    if (match) {
      base.commandDone()
      logger.silly('------------- ZYPER MULTIVIEWS INFO ------------')
      let temp_mv = []  // Temp array for building the variable enums
      let regex = /multiview\((.+?)\)/g;
      while (match = regex.exec(data)) {
        logger.silly(`Name: ${match[1]}`)
        temp_mv.push(match[1])
      }
      temp_mv.sort()
      base.getVar('Multiviews').enums = temp_mv
    }

    // Response from initVariables
    // match = data.match(/show video-walls/)
    // if (match) {
    //   base.commandDone()
    //   logger.silly('------------- ZYPER VIDEOWALLS INFO ------------')
    //   let temp_vw = []  // Temp array for building the variable enums
    //   let regex = /videoWall\((.+?)\)/g;
    //   while (match = regex.exec(data)) {
    //     logger.silly(`Name: ${match[1]}`)
    //     temp_vw.push(match[1])


    //     let sources = ['Idle']
    //     if (vw.model === 'Zyper4K') sources = sources.concat(temp4K)
    //     else if (vw.model === 'ZyperUHD') sources = sources.concat(tempUHD)
    //     base.createVariable({
    //       name: `VideoWall_${vw.name.replace(/[^A-Za-z0-9_]/g, '')}`,  // Ensure legal variable name
    //       type: 'enum',
    //       enums: sources,  // Will be populated with appropriate sources above
    //       perform: {
    //         action: 'startVideoWall',
    //         params: { Name: vw.name, Source: '$string' }
    //       }
    //     })
    //   }
    //   temp_vw.sort()
    //   base.getVar('VideoWalls').enums = temp_mv
    // }

  }

  return {
    setup, start, stop,
    setDecoder, setScreenMode, startVideoWall, getInfo
  }
}