'use strict';

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

  let encoders_uhd = []
  let encoders_4k = []
  let multiviews = []
  let decoders = []

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('Zyper$')
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config

    for (let i = 1; i <= 4; i++) {
      base.createVariable({
        name: `ScreenMode${i}`,
        type: 'enum',
        enums: ['Unknown', 'UHD', '4K'],
        perform: {
          action: 'setScreenMode',
          params: {ScreenId: i, Mode: '$string'}
        }
      })
    }

    base.createVariable({ name: 'Encoders_UHD', type: 'enum'})
    base.createVariable({ name: 'Encoders_4K', type: 'enum'})
    base.createVariable({ name: 'Multiviews', type: 'enum'})
  }

  const start = () => {
    initTelnetClient()
    telnetClient.connect({
      host: config.host,
      port: config.port,
      timeout: TELNET_TIMEOUT,
      initialLFCR: true,
      sendTimeout: SEND_TIMEOUT,
      ors: '\r\n'  // Send this with each command
    })
    logger.silly('Querying Zyper MP for device info....')
    initVariables()
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

  const initVariables = () => {
    // ENCODERS
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
    if (encoders_uhd.map(x => x.name).includes(params.Source)) {
      // UHD Encoder
      joinmode = 'fast-switched'
    }
    else if (encoders_4k.map(x => x.name).includes(params.Source)) {
      // 4k Encoder
      joinmode = 'fast-switched' // Could also be 'genlocked'
    }
    if (multiviews.includes(params.Source)) {
      // Multiview
      joinmode = 'multiview'
    }
    telnetClient.send(`join ${params.Source} ${params.Name} ${joinmode}`)

    // Set HDMI switcher output accordingly
    let screenId = parseInt(params.Name.replace(/\D/g, ''))  // Hackish way to get the number from the decoder name
    if (params.Name.includes('UHD')) setScreenMode({ScreenId: screenId, Mode: 'UHD'})
    else if (params.Name.includes('4K')) setScreenMode({ScreenId: screenId, Mode: '4K'})
  }

  const setScreenMode = params => {
    // Sends command to TechLogix HDMI switcher
    // ScreenId should = 1-4, corresponding to UHD_dec[1-4]
    if (params.Mode === 'UHD') telnetClient.send(`send UHD_dec${params.ScreenId} rs232 HDMI1%`)
    else if (params.Mode === '4K') telnetClient.send(`send UHD_dec${params.ScreenId} rs232 HDMI2%`)
    // Ignores 'Unknown' screen mode
  }

  const onFrame = data => {
    logger.silly(`onFrame: ${data}`)

    if (data.includes('join')) {
    }

  }

  return {
    setup, start, stop,
    setDecoder, setScreenMode
  }
}