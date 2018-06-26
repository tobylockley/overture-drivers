let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  let frameParser = host.createFrameParser()
  frameParser.setSeparator(/FB.{8}/)  // 1st byte is always 0xFB, followed by 4 x hex string (e.g. FB0101C0FF)
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config

    config.devices.forEach(device => {
      // Creates dynamic variables and polling for each device
      base.setPoll({
        action: 'Get Info',
        period: 5000,
        params: { Name: device.name, Address: device.address },
        enablePollFn: () => { return tcpClient.isConnected() }
      });
      
      base.createVariable({
        name: `Device${device.address}_Power`,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'Set Power',
          params: {
            Address: device.address,
            Status: '$string'
          }
        }
      });
      
      base.createVariable({
        name: `Device${device.address}_Position`,
        type: 'enum',
        enums: ['Down', 'Up'],
        smooth: 15000,                             // Allows delay between moving up/down
        perform: {
          action: 'Set Position',
          params: {
            Address: device.address,
            Status: '$string'
          }
        }
      });
      
      base.createVariable({
        name: `Device${device.address}_Source`,
        type: 'enum',
        enums: ['Input1', 'Input2'],
        perform: {
          action: 'Select Source',
          params: {
            Address: device.address,
            Name: '$string'
          }
        }
      });
      
      base.createVariable({
        name: `Device${device.address}_ButtonLock`,
        type: 'enum',
        enums: ['Unlocked', 'Locked'],
        perform: {
          action: 'Set Button Lock',
          params: {
            Address: device.address,
            Status: '$string'
          }
        }
      });

    });
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
    tcpClient && tcpClient.end()
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
      })

      tcpClient.on('data', data => {
        data = data.toString('hex').toUpperCase()
        frameParser.push(data)
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

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data.toString('hex').toUpperCase()}`)
    return tcpClient && tcpClient.write(data)
  }

  const sendDefer = data => {
    if (send(data)) base.commandDefer(1000)
    else base.commandError(`Data not sent`)
  }

  const onFrame = data => {
    // data will be a string of hex characters, e.g. FB02140600
    logger.silly(`onFrame: ${data}`)
    
    // let datachunks = data.match(/.{2}/g)  // Trick using regex to split the string into chunks of 2 chars
    // logger.silly(`onFrame: ${datachunks.join(' ')}`)

    let match
    match = data.match(/FB(\w\w)(\w\w)(\w\w)(\w\w)/)

    if (match) {
      base.commandDone()
      let address = parseInt(match[1], 16)

      if (match[2] == '01') {  // Up/Down
      }
      else if (match[2] == '02') {  // On/Off
      }
      else if (match[2] == '03') {  // Source
      }
      else if (match[2] == '04') {  // Button Lock
      }
      else if (match[2] == '14') {  // Enquiry control byte - need to read bits
        // Taken from AHnet manual
        let descriptions = [
          'Up position',
          'Down position',
          'Screen on',
          'Button lock',
          'Source (0 = DVI1, 1 = DVI2)',  // Need to experiment with microphone sources
          '-',
          '-',
          'System Failure'
        ]
        let controlbits = []
        let controlval = parseInt(match[3], 16)
        for (let i = 0; i < 8; i++) {
          controlbits[i] = (controlval >> i) & 1
          // logger.debug(`${i} : ${controlbits[i]} : ${descriptions[i]}`)
        }
        // controlbits now contains an array of bits matching the following:
        // Bit 0 (1) UP position
        // Bit 1 (1) DOWN position
        // Bit 2 (1) Screen ON
        // Bit 3 (1) Button lock
        // Bit 4 (1) Input DVI (0) Input VGA
        // Bit 5
        // Bit 6
        // Bit 7 (1) System failure
  
        if (controlbits[0]) {
          base.getVar(`Device${address}_Position`).string = 'Up'
        }
        else if (controlbits[1]) {
          base.getVar(`Device${address}_Position`).string = 'Down'
        }
        
        base.getVar(`Device${address}_Power`).string = controlbits[2] ? 'On' : 'Off'
        base.getVar(`Device${address}_ButtonLock`).string = controlbits[3] ? 'Locked' : 'Unlocked'
        base.getVar(`Device${address}_Source`).string = controlbits[4] ? 'Input2' : 'Input1'
      }
    }
  }

  const getInfo = params => {
    sendDefer(Buffer.from([0xFA, params.Address, 0x14, 0, 0]));
  }

  const setPower = params => {
    let value = params.Status === 'Off' ? 0x00 : 0x01
    sendDefer(Buffer.from([0xFA, params.Address, 0x02, value, 0]))

    // Microphone sometimes not updating variable when using button - need to investigate
  }

  const setPosition = params => {
    let value = params.Status === 'Down' ? 0x00 : 0x01
    sendDefer(Buffer.from([0xFA, params.Address, 0x01, value, 0]))
  }

  const selectSource = params => {
    let value = params.Name === 'Input1' ? 0x00 : 0x02
    sendDefer(Buffer.from([0xFA, params.Address, 0x03, value, 0]))

    // Display
    // 0 = DVI 1
    // 1 = DVI-A
    // 2 = DVI 2

    // Microphone - Not sure it needs a source select? Need to investigate.
  }

  const setButtonLock = params => {
    let value = params.Status === 'Unlocked' ? 0x00 : 0x01
    sendDefer(Buffer.from([0xFA, params.Address, 0x04, value, 0]))
  }

  return {
    setup, start, stop,
    getInfo, setPower, setPosition, selectSource, setButtonLock
  }
}