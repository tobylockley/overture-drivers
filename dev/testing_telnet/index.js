'use strict';

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('Zyper$')
  frameParser.on('data', data => onFrame(data))

  let Telnet = require('telnet-client')
  let telnet = new Telnet()  // See start for telnet config

  let cmdEncoders = 'show device status encoders'
  let cmdMultiviews = 'show multiviews status'
  let cmdDecoders = 'show device status decoders'

  let encoders = [], multiviews = [], decoders = [];

  const setup = _config => {
    config = _config
    logger.debug('Setup')

    // Dynamic Variable Creation Below
    base.createVariable({ name: 'EncoderID', type: 'enum', perform: { action: 'Set Encoder', params: {Name: '$string'} } })
    base.createVariable({ name: 'MultiviewID', type: 'enum', perform: { action: 'Set Multiview', params: {Name: '$string'} } })
    base.createVariable({ name: 'DecoderID', type: 'enum', perform: { action: 'Set Decoder', params: {Name: '$string'} } })
  }

  const start = () => {
    logger.silly('Starting')
    telnet.connect({
      host: config.host,
      port: config.port,
      timeout: 30000,
      initialLFCR: true
    })
    getDevices()
  }

  const stop = () => {
    logger.silly('Stopping')
  }

  const getDevices = () => {
    // Responses are parsed in onFrame
    telnet.send(`${cmdDecoders}\r\n`)
    telnet.send(`${cmdEncoders}\r\n`)
    telnet.send(`${cmdMultiviews}\r\n`)
  }

  telnet.on('close', function () {
    logger.silly('telnet closed')
  })

  telnet.on('data', (chunk) => {
    frameParser.push(chunk)
  });

  telnet.on('connect', function () {
    logger.silly('telnet connected!')
    base.getVar('Status').string = 'Connected'
  })

  const setPower = params => {
    base.getVar('Power').string = params.Status
    getDevices()  // USED FOR TESTING
  }

  const setJoinMode = params => { base.getVar('JoinMode').string = params.Name }
  const setEncoder = params => { base.getVar('EncoderID').string = params.Name }
  const setMultiview = params => { base.getVar('MultiviewID').string = params.Name }
  const setDecoder = params => {
    base.getVar('DecoderID').string = params.Name
    let mode = base.getVar('JoinMode').string
    let input = mode === 'multiview' ? base.getVar('MultiviewID').string : base.getVar('EncoderID').string
    let output = base.getVar('DecoderID').string
    joinDevices({Input: input, Output: output, Mode: mode})
  }

  const joinDevices = params => {
    telnet.send(`join ${params.Input} ${params.Output} ${params.Mode}\r\n`)
  }

  const onFrame = data => {
    logger.silly(`onFrame: ${data}`)

    let match
    if (data.includes(cmdDecoders)) {
      decoders = []
      logger.debug('------------- ZYPER DECODER INFO -------------')
      let regex = /device\((.*?)\)[\s\S]*?model=(.*?),.*?name=(.*?),/g;
      while (match = regex.exec(data)) {
        logger.debug(`MAC: ${match[1]}, Name: ${match[3]}, Model: ${match[2]}`)
        decoders.push({mac: match[1], name: match[3], model: match[2]})
      }
      base.getVar('DecoderID').enums = decoders.map(x => x.name)
      base.getVar('DecoderID').string = decoders[0].name
    }

    else if (data.includes(cmdEncoders)) {
      encoders = []
      logger.debug('------------- ZYPER ENCODER INFO -------------')
      let regex = /device\((.*?)\)[\s\S]*?model=(.*?),.*?name=(.*?),/g;
      while (match = regex.exec(data)) {
        logger.debug(`MAC: ${match[1]}, Name: ${match[3]}, Model: ${match[2]}`)
        encoders.push({mac: match[1], name: match[3], model: match[2]})
      }
      base.getVar('EncoderID').enums = encoders.map(x => x.name)
      base.getVar('EncoderID').string = encoders[0].name
    }

    else if (data.includes(cmdMultiviews)) {
      multiviews = []
      logger.debug('------------- ZYPER MULTIVIEWS INFO -------------')
      let regex = /multiview\((.*?)\)/g;
      while (match = regex.exec(data)) {
        logger.debug(`Name: ${match[1]}`)
        multiviews.push({name: match[1]})
      }
      base.getVar('MultiviewID').enums = multiviews.map(x => x.name)
      base.getVar('MultiviewID').string = multiviews[0].name
    }

    else if (data.includes('join')) {
      logger.debug(`Join attempt: ${data}`)
    }

  }

  return {
    setup, start, stop, joinDevices,
    setPower, setEncoder, setMultiview, setDecoder, setJoinMode,
    getDevices
  }
}