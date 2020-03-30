let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  let frameParser = host.createFrameParser()
  //frameParser.setSeparator('\r\n')
  frameParser.on('data', data => onFrame(data))

  base.setTickPeriod(5000)

  const setup = _config => {
    config = _config

    base.setPoll('Get Status', 5000)

  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
  }

  const stop = () => {
    disconnect()
  }

  const startPolling = () => {
    base.perform('Get Status')
    base.startPolling()
  }

  const setPower = params => {
    sendDefer(`!Power ${params.Status}\r`)
  }

  const setMute = params => {
    if (params.Status == "On"){
      sendDefer(`OUTON`)
    }

    else if (params.Status == "Off"){
      sendDefer(`OUTOFF`)
    }
    
  }


  const selectSource = params => {
    var HDMI_in = params.Name.replace(/\D/g , '');
    sendDefer("OUTFR0" + HDMI_in)
  }

  const getStatus = () => sendDefer(`STATUS`)

  const onFrame = data => {
    logger.silly(`onFrame ${data}`)


    base.commandDone()
    if(data.startsWith("AV: ") == true){
      logger.silly(data.substr(4,1))

      base.getVar("Sources").string = "HDMI" + data.substr(4,1)
    }

    if(data == "MUTE\r\n"){
      base.getVar("Mute").string = "On"
    }
    else if(data == "UNMUTE\r\n"){
      base.getVar("Mute").string = "Off"
    }

  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
        startPolling()
      })

      tcpClient.on('data', data => {
        data = data.toString()
        logger.silly(`TCPClient data: ${data}`)
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

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer(2500)
    } else {
      base.commandError(`Data not sent`)
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
  }

  function tick() {
    if (base.getVar('Status').string == 'Disconnected'){
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }


  return {
    setup, start, stop,
    setPower, selectSource, getStatus, setMute, tick
  }
}