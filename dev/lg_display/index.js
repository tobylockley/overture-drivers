'use strict';

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  let networkUtilities
  let wol

  const setID = '01'  // This is used for IP control, see http://www.proaudioinc.com/Dealer_Area/RS232.pdf
  const SOURCES = [
    { name: 'RGB', value: 0x60 },
    { name: 'HDMI1', value: 0x90 },
    { name: 'HDMI2', value: 0x91 },
    { name: 'DisplayPort', value: 0xD0 },
    { name: 'OPS/DVI', value: 0xA5 }
  ]

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('x')
  frameParser.on('data', data => onFrame(data))

  // base.setTickPeriod(5000)

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  const setup = _config => {
    config = _config

    let poll_functions = [
      'Get Power', 
      'Get Source', 
      'Get Audio Mute', 
      'Get Audio Level', 
      'Get Brightness', 
      'Get Contrast', 
      'Get Temperature'
    ]
    poll_functions.forEach(fn => {
      logger.debug(`Setting poll for: ${fn}`)
      base.setPoll({
        action: fn,
        period: 5000,
        enablePollFn: isConnected,
        startImmediately: true
      });
    });
  }

  const start = () => {
    // Persistent variable hack, probably needs updating!                                                        <---------
    let fs = require('fs');
    let p_path = `${process.env.data}/persistent.json`
    if (fs.existsSync(p_path)) {
      let macVar = base.getVar('MacAddress')  // For debugging
      let p_data = require(p_path)
      p_data.forEach(o => {
        logger.debug(`persistent.json ... ${o.fullName} : ${o.value}`)
        if (o.fullName === macVar.fullName) macVar.string = o.value
      });
    }

    wol = require('wakeonlan')  // Used to turn display on
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
    tcpClient && tcpClient.end()
  }

  const getPower = () => sendDefer(Buffer.from(`ka ${setID} FF\r`));
  const getSource = () => sendDefer(Buffer.from(`xb ${setID} FF\r`));
  const getAudioMute = () => sendDefer(Buffer.from(`ke ${setID} FF\r`));
  const getAudioLevel = () => sendDefer(Buffer.from(`kf ${setID} FF\r`));
  const getBrightness = () => sendDefer(Buffer.from(`kh ${setID} FF\r`));
  const getContrast = () => sendDefer(Buffer.from(`kg ${setID} FF\r`));
  const getTemperature = () => sendDefer(Buffer.from(`dn ${setID} FF\r`));

  const getMacAddress = () => {
    networkUtilities.getMacAddress(config.host).then(mac => {
      base.getVar('MacAddress').string = mac
    });
  }

  const setPower = params => {
    if (params.Status == 'Off') {
      sendDefer(Buffer.from(`ka ${setID} 00\r`));
    }
    else if (params.Status == 'On') {
      let mac = base.getVar('MacAddress').string;
      wol(mac).then(() => logger.silly(`setPower: WOL sent to ${mac}`));
    }
  }

  const selectSource = params => {
    sendDefer(`xb ${setID} ${SOURCES.find(x => x.name === params.Name).value.toString(16)}\r`)
  }

  const setAudioMute = params => {
    if (params.Status == 'Off') sendDefer(`ke ${setID} 01\r`)
    else if (params.Status == 'On') sendDefer(`ke ${setID} 00\r`)
  }

  const setAudioLevel = params => {
    sendDefer(Buffer.from(`kf ${setID} ${params.Level.toString(16)}\r`))
  }

  const setBrightness = params => {
    sendDefer(Buffer.from(`kh ${setID} ${params.Level.toString(16)}\r`))
  }

  const setContrast = params => {
    sendDefer(Buffer.from(`kg ${setID} ${params.Level.toString(16)}\r`))
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()
      networkUtilities = host.createNetworkUtilities()

      tcpClient.setOptions({
        autoReconnectionAttemptDelay: 2000,
        receiveTimeout: 6000,
        disconnectOnReceiveTimeout: true,
        keepAlive: true,
        keepAliveInitialDelay: 1000
      });

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
        getMacAddress()  // Get MAC address during initial connection                                          <---------
      })

      tcpClient.on('data', data => {
        data = data.toString()
        //logger.silly(`TCPClient data: ${data}`)
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
    base.getVar('Power').string = 'Off'
    //tcpClient && tcpClient.end()
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const sendDefer = data => {
    if (send(data)) base.commandDefer(5000)
    else base.commandError(`Data not sent`)
  }

  const onFrame = data => {
    base.commandDone()
    logger.debug(`onFrame: ${data}`)

    let match = data.match(/(\w) \d+ OK([0-9a-fA-F]+)/)
    if (match) {
      switch (match[1]) {
        case 'a':
          base.getVar('Power').string = (parseInt(match[2]) == 1) ? 'On' : 'Off'
          break
        case 'b':
          base.getVar('Sources').string = SOURCES.find(x => x.value == parseInt(match[2], 16)).name
          break
        case 'e':
          base.getVar('AudioMute').string = (parseInt(match[2]) == 1) ? 'Off' : 'On'
          break
        case 'f':
          base.getVar('AudioLevel').value = parseInt(match[2], 16)
          break
        case 'h':
          base.getVar('Brightness').value = parseInt(match[2], 16)
          break
        case 'g':
          base.getVar('Contrast').value = parseInt(match[2], 16)
          break
        case 'n':
          base.getVar('Temperature').value = parseInt(match[2], 16)
          break
      }
    }
  }

  function tick() {
    // if (base.getVar('Status').string == 'Disconnected') {
    //   initTcpClient()
    //   tcpClient.connect(config.port, config.host)
    // }
    //logger.debug(`Tick: ${tcpClient}`)
  }

  return {
    setup, start, stop, tick,
    setPower, selectSource, setAudioLevel, setAudioMute, setBrightness, setContrast,
    getPower, getSource, getAudioLevel, getAudioMute, getBrightness, getContrast, getTemperature, getMacAddress
  }
}
