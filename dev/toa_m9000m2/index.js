let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const MAX_LEVEL = 0x7E  // Max value for audio levels
  const logger = base.logger || host.logger
  let config 
  let tcpClient

  const setup = _config => {
    config = _config
    base.setPoll('Keep Alive', 30000)

    for (let i = 1; i <= config.inputs; i++) {
      base.createVariable({
        name: `AudioLevelInput${i}`,
        type: 'integer',
        min: 0,
        max: 100,
        perform: {
          action: 'Set Audio Level In',
          params: {
            Channel: i,
            Level: '$value'
          }
        }
      });
      base.createVariable({
        name: `AudioMuteInput${i}`,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'Set Audio Mute In',
          params: {
            Channel: i,
            Status: '$string'
          }
        }
      });
    }

    for (let j = 1; j <= config.outputs; j++) {
      base.createVariable({
        name: `AudioLevel${j}`,
        type: 'integer',
        min: 0,
        max: 100,
        perform: {
          action: 'Set Audio Level',
          params: {
            Channel: j,
            Level: '$value'
          }
        }
      });
      base.createVariable({
        name: `AudioMute${j}`,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'Set Audio Mute',
          params: {
            Channel: j,
            Status: '$string'
          }
        }
      });
    }
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    getAllLevels()
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
  }

  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }

  const keepAlive = () => { sendDefer(Buffer.from([0xF0, 0x03, 0x40, 0x00, 0x00])); }  // Get Input1 Name

  function bufferToString(thebuffer) {
    let str = "["
    thebuffer.forEach(element => {
      str += '0x' + element.toString(16) + ", "
    });
    return str.slice(0, -2) + "]"
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string =  'Connected'
      })

      tcpClient.on('data', data => {
        logger.silly(`TCPClient data: ${bufferToString(data)}`)
        onFrame(data)
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`)
        disconnect()
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`)
        disconnect()
      })
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${bufferToString(data)}`)
    return tcpClient && tcpClient.write(data)
  }

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer(1000)
    } else {
      base.commandError(`Data not sent`)
    }
  }

  const onFrame = data => {
    logger.silly(`onFrame data: ${bufferToString(data)}`)
    base.commandDone()
    
    if (data.length != data[1] + 2) {  // Check valid message
      logger.error(`onFrame: Packet length not as expected`)
    }
    else if (data[0] == 0xC0) {  // Return from keepAlive() - get input 1 name
      logger.silly(`keepAlive: ${data.slice(4).toString()}`)
    }
    else if (data[0] == 0xF4) {  // Set Power
      base.getVar('Power').string = data[2] == 1 ? 'On' : 'Off'
    }
    else if (data[0] == 0xF1) {  // Recall Preset
      base.getVar(`Presets`).string = `Preset${data[3] + 1}`
    }
    else if (data[0] == 0x92) {  // Channel On/Off (Mute)
      let channel = data[3] + 1
      let status = data[4] == 1 ? 'On' : 'Off'
      if (data[2] == 0x00) base.getVar(`AudioMuteInput${channel}`).string = status
      else if (data[2] == 0x01) base.getVar(`AudioMute${channel}`).string = status
    }
    else if (data[0] == 0x91 || data[0] == 0x93) {
      // 0x91 = Channel Gain
      // 0x93 = Return from Channel "step" (the getLevel hack)
      let channel = data[3] + 1
      let value = Math.round((data[4] * 100) / MAX_LEVEL)  // Compress from 126 steps down to 100
      if (data[2] == 0x00) base.getVar(`AudioLevelInput${channel}`).value = value
      else if (data[2] == 0x01) base.getVar(`AudioLevel${channel}`).value = value
    }
    else {
      logger.error(`onFrame: Unrecognised data packet`)
    }
  }
  
  const setPower = params => {
    if (params.Status == 'Off') sendDefer(Buffer.from([0xF4, 0x01, 0x00]))
    else if (params.Status == 'On') sendDefer(Buffer.from([0xF4, 0x01, 0x01]))
  }

  const recallPreset = params => {
    let value = params.Name.replace(/\D/g , '').parseInt() - 1;  // Must be 0 indexed
    sendDefer(Buffer.from([0xF1, 0x02, 0x00, value]));
    setTimeout(getAllLevels, 1000)  // Read all levels after 1 sec delay
  }

  const setAudioLevel = params => {
    let value = Math.round((MAX_LEVEL * params.Level) / 100.0)  // 126 steps, compressed to 100 for percentage
    sendDefer(Buffer.from([0x91, 0x03, 0x01, params.Channel, value]));
  }

  const setAudioLevelIn = params => {
    let value = Math.round((MAX_LEVEL * params.Level) / 100.0)  // 126 steps, compressed to 100 for percentage
    sendDefer(Buffer.from([0x91, 0x03, 0x00, params.Channel, value]));
  }

  const setAudioMute = params => {
    let mute_val = params.Status == 'On' ? 1 : 0
    sendDefer(Buffer.from([0x92, 0x03, 0x01, params.Channel, mute_val]));
  }

  const setAudioMuteIn = params => {
    let mute_val = params.Status == 'On' ? 1 : 0
    sendDefer(Buffer.from([0x92, 0x03, 0x00, params.Channel, mute_val]));
  }
  
  const getAudioLevel = channel => {
    // Get command does not exist. This is a slight hack that adjusts the volume
    // down then up, and the device will return the current level
    sendDefer(Buffer.from([0x93, 0x03, 0x01, channel, 0x61]));  // Adjust down 1 step
    sendDefer(Buffer.from([0x93, 0x03, 0x01, channel, 0x41]));  // Adjust up 1 step
  }
  
  const getAudioLevelIn = channel => {
    // Get command does not exist. This is a slight hack that adjusts the volume
    // down then up, and the device will return the current level
    sendDefer(Buffer.from([0x93, 0x03, 0x00, channel, 0x61]));  // Adjust down 1 step
    sendDefer(Buffer.from([0x93, 0x03, 0x00, channel, 0x41]));  // Adjust up 1 step
  }

  const getAllLevels = () => {
    for (let i = 0; i < config.outputs; i++) {
      getAudioLevel(i)
    }
    for (let i = 0; i < config.inputs; i++) {
      getAudioLevelIn(i)
    }
  }

  return {
    setup, start, stop, tick, keepAlive,
    setPower, recallPreset, setAudioLevel, setAudioLevelIn, setAudioMute, setAudioMuteIn,
    getAudioLevel, getAudioLevelIn, getAllLevels
  }
}