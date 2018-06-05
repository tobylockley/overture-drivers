let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  base.setTickPeriod(5000) // set systick timer of 5 seconds

  const setup = _config => {
    config = _config
     base.setPoll('Get Power', 9700)
    // base.setPoll('Get Source', 5000)
    // base.setPoll('Get Audio Level', 5000)
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  var Presets = {
    Preset1: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,21,22,21,22,65,22,21,22,65,22,21,22,21,22,21,22,65,22,65,22,21,22,65,22,3800",
    Preset2: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,21,22,21,22,21,22,21,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,65,22,4892",
    Preset3: "1,38226,1,1,342,174,21,21,21,21,21,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,21,22,21,22,65,22,65,22,21,22,21,22,65,22,21,22,65,22,65,22,21,22,21,22,65,22,65,22,21,22,65,22,3800",
    Preset4: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,21,22,65,22,21,22,21,22,65,22,21,22,65,22,21,22,65,22,21,22,65,22,65,22,21,22,65,22,21,22,65,22,3800",
    Preset5: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,65,22,65,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,21,22,65,22,65,22,21,22,65,22,65,22,65,22,3800",
    Preset6: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,21,22,21,22,21,22,21,22,65,22,21,22,65,22,21,22,65,22,65,22,65,22,65,22,21,22,65,22,21,22,65,22,3800",
    Preset7: "1,38580,1,1,343,175,22,21,22,22,22,22,22,66,22,22,22,22,22,22,22,22,22,66,22,66,22,66,22,22,22,66,22,66,22,66,22,66,22,22,22,66,22,66,22,22,22,66,22,22,22,66,22,22,22,66,22,22,22,22,22,66,22,22,22,66,22,22,22,66,22,3800",
    Preset8: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,21,22,65,22,21,22,21,22,21,22,21,22,21,22,21,22,65,22,21,22,65,22,65,22,65,22,3800",
    Preset9: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,21,22,21,22,65,22,21,22,65,22,21,22,65,22,21,22,65,22,65,22,21,22,65,22,21,22,65,22,21,22,65,22,3800",
    Preset10: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,21,22,21,22,21,22,21,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,3800"


  }
  var Power_command = {
    Toggle: "1,38226,1,1,343,174,22,21,22,21,22,21,22,65,22,21,22,21,22,21,22,21,22,65,22,65,22,65,22,21,22,65,22,65,22,65,22,65,22,21,22,21,22,21,22,21,22,21,22,21,22,65,22,21,22,65,22,65,22,65,22,65,22,65,22,65,22,21,22,65,22,3800"
  }




  const getPower = () => sendDefer("A")

  const setPower = params => {
    //base.getVar("Power").string = params.Status;
    if (params.Status == "Toggle"){
      sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Power_command.Toggle + "\r")
    }
    else{
      logger.silly("Wrong Syntax for power function")
    }
   


  }




  const recallPreset = params => {
    base.getVar("Presets").string = params.Name;

    switch (params.Name) {
      case "1":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset1 + "\r")
        break;
      case "2":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset2 + "\r")
        break;
      case "3":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset3 + "\r")
        break;
      case "4":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset4 + "\r")
        break;
      case "5":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset5 + "\r")
        break;
      case "6":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset6 + "\r")
        break;
      case "7":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset7 + "\r")
        break;
        case "8":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset8 + "\r")
        break;
        case "9":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset9 + "\r")
        break;
        case "10":
        sendDefer("sendir,"+  config.module + ":"+ config.ir_port +"," + Presets.Preset10 + "\r")
        break;
      default:
        logger.silly("Wrong command variable sent to function Send Command()")
        break;
    }
  }



  const onFrame = data => {
    logger.silly(`onFrame ${data}`)
    base.commandDone()

  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
      })

      tcpClient.on('data', data => {
        data = data.toString()
        logger.silly(`TCPClient data: ${data}`)
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

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer()
    } else {
      base.commandError(`Data not sent`)
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }


  function tick() {
    if (base.getVar('Status').string == 'Disconnected'){
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }

  const disconnect = () => {
    //base.getVar('Status').string = 'Disconnected'
    //tcpClient && tcpClient.end()
  }

  return {
    setup, start, stop,
    setPower, recallPreset, tick, getPower
  }
}