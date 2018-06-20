let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  let frameParser = host.createFrameParser()
  frameParser.setSeparator(/FB.{8}/)  // 1st byte is always 0xFB, followed by 4 bytes
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config
    base.setPoll('Get Info', 5000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  const getInfo = () => { sendDefer(Buffer.from([0xFA, config.address, 0x14, 0, 0])); }

  const setPower = params => {
    let status = params.Status === 'Off' ? 0x00 : 0x01
    sendDefer(Buffer.from([0xFA, config.address, 0x02, status, 0]))
  }

  const setPosition = params => {
    let status = params.Status === 'Down' ? 0x00 : 0x01
    sendDefer(Buffer.from([0xFA, config.address, 0x01, status, 0]))
  }

  const setButtonLock = params => {
    let status = params.Status === 'Unlocked' ? 0x00 : 0x01
    sendDefer(Buffer.from([0xFA, config.address, 0x04, status, 0]))
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
        // logger.silly(`TCPClient data: ${data}`)
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
    tcpClient && tcpClient.end()
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
    let match
    // match = data.match(/POWR(\d+)/)
    // match && (base.getVar('Power').string = (parseInt(match[1]) == 1) ? 'On' : 'Off')
    let datachunks = data.match(/.{2}/g)  // Trick using regex to split the string into chunks
    logger.silly(`onFrame: ${datachunks.join(' ')}`)

    if (datachunks[0] != 'FB') {
      logger.error(`onFrame: Unexpected data`)
      return
    }
    if (parseInt(datachunks[1], 16) != config.address) {
      logger.error(`onFrame: Device address does not match`)
      return
    }

    base.commandDone()

    if (datachunks[2] == '01') {
      // Up/Down
    }
    else if (datachunks[2] == '02') {
      // On/Off
    }
    else if (datachunks[2] == '03') {
      // Source
    }
    else if (datachunks[2] == '04') {
      // Button Lock
    }
    else if (datachunks[2] == '14') {
      // Enquiry control byte - need to read bits

      // Taken from AHnet manual
      let descriptions = [
        'Up position',
        'Down position',
        'Screen on',
        'Button lock',
        'Source (0 = DVI1, 1 = DVI2)',
        '-',
        '-',
        'System Failure'
      ]

      let controlbyte = []
      let controlval = parseInt(datachunks[3], 16)
      for (let i = 0; i < 8; i++) {
        controlbyte[i] = (controlval >> i) & 1
        // logger.debug(`${i} : ${controlbyte[i]} : ${descriptions[i]}`)
      }
      // controlbyte now contains an array of bits with index 0 = LSB
      // Bit 0 (1) UP position
      // Bit 1 (1) DOWN position
      // Bit 2 (1) Screen ON
      // Bit 3 (1) Button lock
      // Bit 4 (1) Input DVI (0) Input VGA
      // Bit 5
      // Bit 6
      // Bit 7 (1) System failure

      if (controlbyte[0]) {
        base.getVar('Position').string = 'Up'
      }
      else if (controlbyte[1]) {
        base.getVar('Position').string = 'Down'
      }
      
      base.getVar('Power').string = controlbyte[2] ? 'On' : 'Off'
      base.getVar('ButtonLock').string = controlbyte[3] ? 'Locked' : 'Unlocked'

      // Source (bit4), 0 = DVI1, 1 = DVI2
    }
  }

  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }

  return {
    setup, start, stop, tick,
    setPower, setPosition, setButtonLock, getInfo
  }
}