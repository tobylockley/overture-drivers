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
    

    let preset_names = [];  // Construct array of preset names
    for (let i = 1; i <= 32; i++) { preset_names.push(`Preset${i}`); }
    base.createVariable({
      name: 'Preset',
      type: 'enum',
      enums: preset_names,
      perform: {
        action: 'Recall Preset',
        params: {
          Name: '$string'
        }
      }
    });

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
    // getAllLevels()
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
        //logger.silly(`TCPClient data: ${bufferToString(data)}`)
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
    let valid_data
    let validated = false

    valid_data = validateResponse(data, 0xC0)
    if (valid_data) {  // Return from keepAlive() - don't really care about response
      validated = true
      base.commandDone()
      //logger.silly(`keepAlive: ${data.slice(4).toString()}`)
    }

    valid_data = validateResponse(data, 0xF4)
    if (valid_data) {  // Set Power
      validated = true
      base.commandDone()
      base.getVar('Power').string = valid_data[2] == 1 ? 'On' : 'Off'
    }

    valid_data = validateResponse(data, 0xF1)
    if (valid_data) {  // Recall Preset
      validated = true
      base.commandDone()
      base.getVar(`Preset`).string = `Preset${valid_data[3] + 1}`
    }

    valid_data = validateResponse(data, 0x92)
    if (valid_data) {  // Channel On/Off (Mute)
      validated = true
      base.commandDone()
      let channel = valid_data[3] + 1
      let status = valid_data[4] == 1 ? 'Off' : 'On'
      if (valid_data[2] == 0x00) base.getVar(`AudioMuteInput${channel}`).string = status
      else if (valid_data[2] == 0x01) base.getVar(`AudioMute${channel}`).string = status
    }

    valid_data = validateResponse(data, 0x91)
    if (valid_data) {  // 0x91 = Channel Gain
      validated = true
      base.commandDone()
      let channel = valid_data[3] + 1
      let value = Math.round((valid_data[4] * 100) / MAX_LEVEL)  // Compress from 126 steps down to 100
      if (valid_data[2] == 0x00) base.getVar(`AudioLevelInput${channel}`).value = value
      else if (valid_data[2] == 0x01) base.getVar(`AudioLevel${channel}`).value = value
    }

    valid_data = validateResponse(data, 0x93)
    if (valid_data) {  // 0x93 = Return from Channel "step" (the getLevel hack)
      validated = true
      base.commandDone()
      let channel = valid_data[3] + 1
      let value = Math.round((valid_data[4] * 100) / MAX_LEVEL)  // Compress from 126 steps down to 100
      if (valid_data[2] == 0x00) base.getVar(`AudioLevelInput${channel}`).value = value
      else if (valid_data[2] == 0x01) base.getVar(`AudioLevel${channel}`).value = value
    }

    if (!validated) {
      logger.error(`onFrame: Unrecognised data packet`)
    }
  }
  
  const validateResponse = (data, id_byte) => {
    if (data.includes(id_byte)) {
      let msg_start = data.indexOf(id_byte)
      if (data.length >= msg_start + 2) {  // Make sure we can read the next byte
        let msg_length = data[msg_start + 1] + 2  // Get the next byte, which denotes message length (minus command byte and length byte, hence +2)
        if (data.length >= msg_start + msg_length) {  // Have we received enough to extract a whole message?
          // Copy the actual data for return
          let temp = Buffer.alloc(msg_length)
          data.copy(temp, 0, msg_start, msg_start + msg_length)
          return temp
        }
        else {
          logger.error(`onFrame: Response does not match expected format`)
          return undefined
        }
      }
      else {
        logger.error(`onFrame: Packet length not as expected`)
        return undefined
      }
    }
    else {
      return undefined
    }
  }
  
  const setPower = params => {
    if (params.Status == 'Off') sendDefer(Buffer.from([0xF4, 0x01, 0x00]))
    else if (params.Status == 'On') sendDefer(Buffer.from([0xF4, 0x01, 0x01]))
  }

  const recallPreset = params => {
    let value = params.Name.replace(/\D/g , '').parseInt() - 1;  // Must be 0 indexed
    sendDefer(Buffer.from([0xF1, 0x02, 0x00, value]));
    setTimeout(getAllLevels, 3000)  // Read all levels after 3 sec delay
  }

  const setAudioLevel = params => {
    let value = Math.round((MAX_LEVEL * params.Level) / 100.0)  // 126 steps, compressed to 100 for percentage
    sendDefer(Buffer.from([0x91, 0x03, 0x01, params.Channel-1, value]));
  }

  const setAudioLevelIn = params => {
    let value = Math.round((MAX_LEVEL * params.Level) / 100.0)  // 126 steps, compressed to 100 for percentage
    sendDefer(Buffer.from([0x91, 0x03, 0x00, params.Channel-1, value]));
  }

  const setAudioMute = params => {
    let mute_val = params.Status == 'On' ? 0 : 1
    sendDefer(Buffer.from([0x92, 0x03, 0x01, params.Channel-1, mute_val]));
  }

  const setAudioMuteIn = params => {
    let mute_val = params.Status == 'On' ? 0 : 1
    sendDefer(Buffer.from([0x92, 0x03, 0x00, params.Channel-1, mute_val]));
  }
  
  const getAudioLevel = channel => {
    // Get command does not exist. This is a slight hack that adjusts the volume
    // down then up, and the device will return the current level
    sendDefer(Buffer.from([0x93, 0x03, 0x01, channel-1, 0x61]));  // Adjust down 1 step
    sendDefer(Buffer.from([0x93, 0x03, 0x01, channel-1, 0x41]));  // Adjust up 1 step
  }
  
  const getAudioLevelIn = channel => {
    // Get command does not exist. This is a slight hack that adjusts the volume
    // down then up, and the device will return the current level
    sendDefer(Buffer.from([0x93, 0x03, 0x00, channel-1, 0x61]));  // Adjust down 1 step
    sendDefer(Buffer.from([0x93, 0x03, 0x00, channel-1, 0x41]));  // Adjust up 1 step
  }

  const getAllLevels = () => {
    for (let i = 1; i <= config.outputs; i++) {
      getAudioLevel(i)
    }
    for (let i = 1; i <= config.inputs; i++) {
      getAudioLevelIn(i)
    }
  }

  return {
    setup, start, stop, tick, keepAlive,
    setPower, recallPreset, setAudioLevel, setAudioLevelIn, setAudioMute, setAudioMuteIn,
    getAudioLevel, getAudioLevelIn, getAllLevels
  }
}