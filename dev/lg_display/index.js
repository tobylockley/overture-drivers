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
  let wol = require('wakeonlan')  // Used to turn display on
  let persist = require(`./persistent_addon.js`)  // Stores MAC address

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
      logger.debug(`Initialising polling for: ${fn}`)
      base.setPoll({
        action: fn,
        period: 5000,
        enablePollFn: () => { base.getVar('Status').string === 'Connected'; },
        startImmediately: true
      });
    });
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
    getMacAddress()
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
    // Helper function for resolving multiple promises below
    const reflect = p => p.then(value => ({value, status: "resolved" }), error => ({error, status: "rejected" }));

    let a = networkUtilities.getMacAddress(config.host);
    let b = persist.loadPersistent('MacAddress');
    Promise.all([a, b].map(reflect)).then(results => {
      let actual_mac = results[0]
      let saved_mac = results[1]

      if (actual_mac.status === "resolved") {
        base.getVar('MacAddress').string = actual_mac.value
        persist.savePersistent('MacAddress', actual_mac.value)  // Save actual MAC address to json file
      }
      else if (saved_mac.status === "resolved") {
        base.getVar('MacAddress').string = saved_mac.value
      }
      else {
        logger.error(`Failed to retrieve MAC address from device AND persistent.json`)
      }
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
        autoReconnectionAttemptDelay: 5000,
        receiveTimeout: 60000
      });

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
      })

      tcpClient.on('data', data => {
        frameParser.push(data.toString())
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`)
        disconnect()
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`)
        disconnect()
        tcpClient && tcpClient.end()
      })
    }
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    base.getVar('Power').string = 'Off'
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
    logger.silly(`onFrame: ${data}`)

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

  return {
    setup, start, stop,
    setPower, selectSource, setAudioLevel, setAudioMute, setBrightness, setContrast,
    getPower, getSource, getAudioLevel, getAudioMute, getBrightness, getContrast, getTemperature, getMacAddress
  }
}
