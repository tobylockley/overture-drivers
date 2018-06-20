let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  const setup = _config => {
    config = _config

    // INPUT FADER GAINS
    for (let i = 1; i <= config.inputs; i++) {
      base.createVariable({
        name: `AudioLevelInput${i}`,
        type: 'integer',
        min: 0,
        max: 126,
        perform: {
          action: 'Set Audio Level In',
          params: {
            Channel: i,
            Level: '$value'
          }
        }
      });
    }

    // OUTPUT FADER GAINS
    for (let i = 1; i <= config.outputs; i++) {
      base.createVariable({
        name: `AudioLevel${i}`,
        type: 'integer',
        min: 0,
        max: 126,
        perform: {
          action: 'Set Audio Level',
          params: {
            Channel: i,
            Level: '$value'
          }
        }
      });
    }

    // CROSSPOINT GAINS
    for (let i = 1; i <= config.outputs; i++) {
      for (let j = 1; j <= config.inputs; j++) {
        base.createVariable({
          name: `Crosspoint_Output${i}_Input${j}`,
          type: 'integer',
          min: 0,
          max: 81,
          perform: {
            action: 'Set Crosspoint Gain',
            params: {
              Output: i,
              Input: j,
              Level: '$value'
            }
          }
        });
      }
    }

    // AUDIO MUTE INPUT
    for (let i = 1; i <= config.inputs; i++) {
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

    // AUDIO MUTE OUTPUT
    for (let i = 1; i <= config.outputs; i++) {
      base.createVariable({
        name: `AudioMute${i}`,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'Set Audio Mute',
          params: {
            Channel: i,
            Status: '$string'
          }
        }
      });
    }
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
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

  function bufferToString(thebuffer) {
    // Small helper functions to make hex buffer easier to read
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
        // logger.silly(`TCPClient data: ${bufferToString(data)}`)
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

    valid_data = validateResponse(data, 0xF4)
    if (valid_data) {  // Set Power
      base.commandDone()
      validated = true
      base.getVar('Power').string = valid_data[2] == 1 ? 'On' : 'Off'
    }

    valid_data = validateResponse(data, 0xF1)
    if (valid_data) {  // Recall Preset
      base.commandDone()
      validated = true
      base.getVar(`Preset`).string = `Preset ${valid_data[3] + 1}`
    }

    valid_data = validateResponse(data, 0x92)
    if (valid_data) {  // Channel On/Off (Mute)
      base.commandDone()
      validated = true
      let channel = valid_data[3] + 1
      let status = valid_data[4] == 1 ? 'Off' : 'On'
      if (valid_data[2] == 0x00) base.getVar(`AudioMuteInput${channel}`).string = status
      else if (valid_data[2] == 0x01) base.getVar(`AudioMute${channel}`).string = status
    }

    valid_data = validateResponse(data, 0x91)
    if (valid_data) {  // 0x91 = Channel Gain
      // E.g. 0x91, 3, 0/1, channel, gain
      base.commandDone()
      validated = true
      let channel = valid_data[3] + 1
      if (valid_data[2] == 0x00) base.getVar(`AudioLevelInput${channel}`).value = valid_data[4]
      else if (valid_data[2] == 0x01) base.getVar(`AudioLevel${channel}`).value = valid_data[4]
    }

    valid_data = validateResponse(data, 0x95)
    if (valid_data) {  // 0x95 = Crosspoint Gain
      // Example: 0x95, 5, 0, input, 1, output, gain
      base.commandDone()
      validated = true
      let input = valid_data[3] + 1
      let output = valid_data[5] + 1
      base.getVar(`Crosspoint_Output${output}_Input${input}`).value = valid_data[6]
    }

    if (!validated) {
      logger.error(`onFrame: Unrecognised data packet`)
    }
  }
  
  const validateResponse = (data, id_byte) => {
    // Will extract valid packets even if surrounded by extraneous bytes
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
    let value = parseInt(params.Name.replace(/\D/g , '')) - 1;  // Extract number, convert to 0 index
    sendDefer(Buffer.from([0xF1, 0x02, 0x00, value]));
  }

  const setAudioLevel = params => {
    sendDefer(Buffer.from([0x91, 0x03, 0x01, params.Channel-1, params.Level]));
  }

  const setAudioLevelIn = params => {
    sendDefer(Buffer.from([0x91, 0x03, 0x00, params.Channel-1, params.Level]));
  }

  const setAudioMute = params => {
    let mute_val = params.Status == 'On' ? 0 : 1
    sendDefer(Buffer.from([0x92, 0x03, 0x01, params.Channel-1, mute_val]));
  }

  const setAudioMuteIn = params => {
    let mute_val = params.Status == 'On' ? 0 : 1
    sendDefer(Buffer.from([0x92, 0x03, 0x00, params.Channel-1, mute_val]));
  }

  const setCrosspointGain = params => {
    sendDefer(Buffer.from([0x95, 0x05, 0x00, params.Input-1, 0x01, params.Output-1, params.Level]));
  }

  return {
    setup, start, stop, tick,
    setPower, recallPreset, setAudioLevel, setAudioLevelIn, setAudioMute, setAudioMuteIn, setCrosspointGain
  }
}