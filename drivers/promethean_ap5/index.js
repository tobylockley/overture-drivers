let host

function bufferToString(thebuffer) {
  let str = '['
  thebuffer.forEach(element => {
    str += '0x' + element.toString(16) + ', '
  })
  return str.slice(0, -2) + ']'
}

exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  const commands = require('./commands.js')  // Stores all hex codes

  const setup = _config => {
    config = _config
    base.setPoll('Poll Master', 2000)
  }

  const getPower = () => sendDefer(Buffer.from(commands.GetPower))
  const getSource = () => sendDefer(Buffer.from(commands.GetSource))
  const getAudioMute = () => sendDefer(Buffer.from(commands.GetAudioMute))
  const getAudioLevel = () => sendDefer(Buffer.from(commands.GetAudioLevel))
  const getBrightness = () => sendDefer(Buffer.from(commands.GetBrightness))
  const getContrast = () => sendDefer(Buffer.from(commands.GetContrast))
  const getSharpness = () => sendDefer(Buffer.from(commands.GetSharpness))

  let pollCount = 0
  const pollList = [
    getPower,
    getSource,
    getAudioMute,
    getAudioLevel,
    getBrightness,
    getContrast,
    getSharpness
  ]

  const pollMaster = () => {
    logger.silly(`pollMaster: calling ${pollList[pollCount]}`)
    pollList[pollCount]()  // Call one of the poll functions
    pollCount = ++pollCount % pollList.length  // Increment the poll counter, looping back to zero
  }

  const start = () => {
    initTcpClient()
    tcpClient.connect(config.port, config.host)
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      initTcpClient()
      tcpClient.connect(config.port, config.host)
    }
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()

      tcpClient.on('connect', () => {
        logger.silly('TCPClient connected')
        base.getVar('Status').string = 'Connected'
      })

      tcpClient.on('data', data => {
        //data = data.toString()
        logger.silly(`TCPClient data: ${bufferToString(data)}`)
        onFrame(data)
      })

      tcpClient.on('close', () => {
        logger.silly('TCPClient closed')
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

  const sendDefer = data => {
    if (send(data)) {
      base.commandDefer(1000)
    }
    else {
      base.commandError('Data not sent')
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${bufferToString(data)}`)
    return tcpClient && tcpClient.write(data)
  }

  const onFrame = data => {
    logger.silly(`onFrame ${data}`)

    // Expected data format (as array) = [0xF6] [Command] [SetID] [Data] [Checksum] [0x6F]
    // Checksum is the sum of the first 4 bytes, taking lowest byte of result
    // see https://support.prometheanworld.com/home/content/activpanel-5-rs232-get-status-commands

    let getCmds = Object.keys(commands).filter(key => key.match(/get/i))  // Create array with only the get command names
    for (let i = 0; i < getCmds.length; i++) {
      //check first 3 bytes, skip if mismatch
      let command_name = getCmds[i]
      let byte_pattern = commands[command_name]
      if (data[0] != byte_pattern[0]) continue
      if (data[1] != byte_pattern[1]) continue
      if (data[2] != byte_pattern[2]) continue

      //make sure checksum is valid
      let checksum = (data[0] + data[1] + data[2] + data[3]) & 0xFF
      if (checksum != data[4]) {
        logger.error('Checksum error on received serial data')
        continue
      }

      //set variable based on param name
      let val = data[3]
      let var_name = command_name.slice(3)  // Get substring that excludes first 3 chars, this will be the func name (e.g. 'Power')
      if (var_name == 'Power') {
        if (val == 0x01) base.getVar(var_name).string = 'On'
        else if (val == 0x02) base.getVar(var_name).string = 'Off'
        // Unhandled ...
        // 03 = Remote Manager On and Backlight Off
        // 04 = Remote Manager On and Backlight On
      }
      else if (var_name == 'Source') {
        if (val == 0x01) base.getVar(var_name).string = 'AV'
        else if (val == 0x06) base.getVar(var_name).string = 'YPbPr'
        else if (val == 0x08) base.getVar(var_name).string = 'VGA'
        else if (val == 0x09) base.getVar(var_name).string = 'HDMI1'
        else if (val == 0x0A) base.getVar(var_name).string = 'HDMI2'
        else if (val == 0x13) base.getVar(var_name).string = 'HDMI3'
        else if (val == 0x14) base.getVar(var_name).string = 'HDMI4'
        else if (val == 0x12) base.getVar(var_name).string = 'OPS'
        else if (val == 0x0B) base.getVar(var_name).string = 'MultiMedia'
      }
      else if (var_name == 'AudioMute') {
        if (val == 0x00) base.getVar(var_name).string = 'Off'
        else if (val == 0x01) base.getVar(var_name).string = 'On'
      }
      else if (var_name == 'AudioLevel' || var_name == 'Brightness' || var_name == 'Contrast' || var_name == 'Sharpness') {
        base.getVar(var_name).value = val
      }
      else {
        logger.error('onFrame: var_name not recognised')
      }
    }

    base.commandDone()
  }
  

  var timerPower
  const setPower = params => {
    if (params.Status == 'Off') send(Buffer.from(commands.PowerOff))
    else if (params.Status == 'On') send(Buffer.from(commands.PowerOn))
    clearTimeout(timerPower)
    timerPower = setTimeout(getPower, 1000)
  }

  var timerSource
  const selectSource = params => {
    send(Buffer.from(commands[params.Name]))
    clearTimeout(timerSource)
    timerSource = setTimeout(getSource, 1000)
  }

  var timerAudioMute
  const setAudioMute = params => {
    if (params.Status == 'Off') send(Buffer.from(commands.MuteOff))
    else if (params.Status == 'On') send(Buffer.from(commands.MuteOn))
    clearTimeout(timerAudioMute)
    timerAudioMute = setTimeout(getAudioMute, 1000)
  }

  var timerAudioLevel
  const setAudioLevel = params => {
    send(Buffer.from(commands.SetAudioLevel(params.Level)))
    clearTimeout(timerAudioLevel)
    timerAudioLevel = setTimeout(getAudioLevel, 1000)
  }

  var timerBrightness
  const setBrightness = params => {
    send(Buffer.from(commands.SetBrightness(params.Level)))
    clearTimeout(timerBrightness)
    timerBrightness = setTimeout(getBrightness, 1000)
  }

  var timerContrast
  const setContrast = params => {
    send(Buffer.from(commands.SetContrast(params.Level)))
    clearTimeout(timerContrast)
    timerContrast = setTimeout(getContrast, 1000)
  }

  var timerSharpness
  const setSharpness = params => {
    send(Buffer.from(commands.SetSharpness(params.Level)))
    clearTimeout(timerSharpness)
    timerSharpness = setTimeout(getSharpness, 1000)
  }

  return {
    setup, start, stop, tick, pollMaster,
    setPower, selectSource, setAudioMute, setAudioLevel, setBrightness, setContrast, setSharpness,
    getPower, getSource,    getAudioMute, getAudioLevel, getBrightness, getContrast, getSharpness
  }
}