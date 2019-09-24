/*
TODO
- Only send keepAlive if data has not been sent in 1/2 tcp timeout
- Smooth level changes (reduce queueing)
*/

'use strict'

const CMD_DEFER_TIME = 3000 // Timeout when using commandDefer
const TICK_PERIOD = 5000 // In-built tick interval
const TCP_TIMEOUT = 30000 // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000 // How long to wait before attempting to reconnect

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\r')
  frameParser.on('data', data => onFrame(data))

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() {
    return base.getVar('Status').string === 'Connected'
  }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    base.setPoll({
      action: 'keepAlive',
      period: config.poll,
      enablePollFn: isConnected,
      startImmediately: true
    })

    // Setup variables based on config
    if (config.presets) {
      base.createVariable({
        name: 'Presets',
        type: 'enum',
        enums: ['Choose a preset...'].concat(config.presets),
        perform: {
          action: 'recallPreset',
          params: {
            Name: '$string'
          }
        }
      })
    }

    for (let level of config.levels) {
      level.varname = level.nickname.replace(/[^A-Za-z0-9_]/g, '') // Make legal variable name
      base.createVariable({
        name: level.varname,
        type: 'real',
        min: 0,
        max: 100,
        perform: {
          action: 'setAudioLevel',
          params: {
            InstanceTag: level.tag,
            Channel: level.channel,
            Level: '$value'
          }
        }
      })
      // Register polling function
      base.setPoll({
        action: 'getAudioLevel',
        period: config.poll,
        enablePollFn: isConnected,
        startImmediately: true,
        params: {
          InstanceTag: level.tag,
          Channel: level.channel
        }
      })
    }

    for (let mute of config.mutes) {
      mute.varname = mute.nickname.replace(/[^A-Za-z0-9_]/g, '') // Make legal variable name
      base.createVariable({
        name: mute.varname,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'setAudioMute',
          params: {
            InstanceTag: mute.tag,
            Channel: mute.channel,
            Status: '$value'
          }
        }
      })
      // Register polling function
      base.setPoll({
        action: 'getAudioMute',
        period: config.poll,
        enablePollFn: isConnected,
        startImmediately: true,
        params: {
          InstanceTag: mute.tag,
          Channel: mute.channel
        }
      })
    }

    for (let state of config.states) {
      state.varname = state.nickname.replace(/[^A-Za-z0-9_]/g, '') // Make legal variable name
      base.createVariable({
        name: state.varname,
        type: 'enum',
        enums: ['False', 'True'],
        perform: {
          action: 'setLogicState',
          params: {
            InstanceTag: state.tag,
            Channel: state.channel,
            Status: '$value'
          }
        }
      })
      // Register polling function
      base.setPoll({
        action: 'getLogicState',
        period: config.poll,
        enablePollFn: isConnected,
        startImmediately: true,
        params: {
          InstanceTag: state.tag,
          Channel: state.channel
        }
      })
    }

    if (config.commands) {
      let enums = ['Choose a command...']
      for (let c of config.commands) {
        enums.push(c.nickname)
      }
      base.createVariable({
        name: 'Commands',
        type: 'enum',
        enums: enums,
        perform: {
          action: 'runCustomCommand',
          params: {
            Command: '$string'
          }
        }
      })
    }
  }

  function start() {
    initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
    tcpClient = null
    base.clearPendingCommands()
  }

  function tick() {
    if (!tcpClient) initTcpClient()
  }

  function initTcpClient() {
    if (tcpClient) return // Return if tcpClient already exists

    tcpClient = host.createTCPClient()
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
    })
    tcpClient.connect(config.port, config.host)

    tcpClient.on('connect', () => {
      logger.silly('TCPClient connected')
      base.getVar('Status').string = 'Connected'
      base.startPolling()
    })

    tcpClient.on('data', data => {
      // logger.info(`RAW > ${data.toString().replace(/\n/g, '{N}').replace(/\r/g, '{R}')}`)
      if (!checkTelnetNegotiation(data)) frameParser.push(data.toString())
    })

    tcpClient.on('close', () => {
      logger.silly('TCPClient closed')
      base.getVar('Status').string = 'Disconnected' // Triggered on timeout, this allows auto reconnect
    })

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`)
      stop() // Throw out the tcpClient and get a fresh connection
    })
  }

  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  function onFrame(data) {
    let match
    let pendingCommand = base.getPendingCommand()
    logger.silly(
      `onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data}`
    )

    if (pendingCommand && pendingCommand.action === 'getAudioLevel') {
      match = data.match(/\+OK "value":(-?\d*\.\d*)/)
      if (match) {
        let conf = config.levels.find(
          x =>
            x.tag === pendingCommand.params.InstanceTag &&
            x.channel === pendingCommand.params.Channel
        )
        let val = parseFloat(match[1])
        base.getVar(conf.varname).value = map(val, conf.min, conf.max, 0, 100) // Convert value from decibel to percentage
        base.commandDone()
      }
    }
    else if (pendingCommand && pendingCommand.action === 'getAudioMute') {
      match = data.match(/\+OK "value":(false|true)/)
      if (match) {
        let varname = config.mutes.find(
          x =>
            x.tag === pendingCommand.params.InstanceTag &&
            x.channel === pendingCommand.params.Channel
        ).varname
        base.getVar(varname).value = { false: 0, true: 1 }[match[1]]
        base.commandDone()
      }
    }
    else if (pendingCommand && pendingCommand.action === 'getLogicState') {
      match = data.match(/\+OK "value":(false|true)/)
      if (match) {
        let varname = config.states.find(
          x =>
            x.tag === pendingCommand.params.InstanceTag &&
            x.channel === pendingCommand.params.Channel
        ).varname
        base.getVar(varname).value = { false: 0, true: 1 }[match[1]]
        base.commandDone()
      }
    }
    else {
      match = data.match(/\+OK/)
      if (match && pendingCommand) {
        base.commandDone()
      }
      else {
        logger.warn(`onFrame data not processed: ${data}`)
      }
    }
  }

  function checkTelnetNegotiation(data) {
    let negFlag = false
    while (data.length > 0 && data.length % 3 === 0) {
      let chunk = data.slice(0, 3)
      if (chunk[0] === 0xff && chunk[1] === 0xfb) {
        send(Buffer.from([0xff, 0xfe, chunk[2]]))
        negFlag = true
      }
      else if (chunk[0] === 0xff && chunk[1] === 0xfd) {
        send(Buffer.from([0xff, 0xfc, chunk[2]]))
        negFlag = true
      }
      data = data.slice(3)
    }
    return negFlag
  }

  // ------------------------------ GET FUNCTIONS ------------------------------

  function keepAlive() {
    sendDefer('DEVICE get version\n')
  }

  function getAudioLevel(params) {
    // params: InstanceTag, Channel
    sendDefer(`${params.InstanceTag} get level ${params.Channel}\n`)
  }

  function getAudioMute(params) {
    // params: InstanceTag, Channel
    sendDefer(`${params.InstanceTag} get mute ${params.Channel}\n`)
  }

  function getLogicState(params) {
    // params: InstanceTag, Channel
    sendDefer(`${params.InstanceTag} get state ${params.Channel}\n`)
  }

  // ------------------------------ SET FUNCTIONS ------------------------------

  function recallPreset(params) {
    // params: Name
    let num = parseInt(params.Name)
    if (num) {
      sendDefer(`DEVICE recallPreset ${num}\n`)
    }
    else {
      sendDefer(`DEVICE recallPresetByName ${params.Name}\n`)
    }
  }

  function setAudioLevel(params) {
    // params: InstanceTag, Channel, Level (0-100)
    let conf = config.levels.find(x => x.tag === params.InstanceTag)
    let val = map(params.Level, 0, 100, conf.min, conf.max).toFixed(6) // Convert value from percentage to decibel
    sendDefer(`${params.InstanceTag} set level ${params.Channel} ${val}\n`)
  }

  function setAudioMute(params) {
    // params: InstanceTag, Channel, Status (0/1)
    let state = ['false', 'true'][params.Status]
    sendDefer(`${params.InstanceTag} set mute ${params.Channel} ${state}\n`)
  }

  function setLogicState(params) {
    // params: InstanceTag, Channel, Status (0/1)
    let state = ['false', 'true'][params.Status]
    sendDefer(`${params.InstanceTag} set state ${params.Channel} ${state}\n`)
  }

  function runCustomCommand(params) {
    // Search custom commands config for supplied command, and retrieve actual command, otherwise send as is
    let cmd = config.commands.find(x => x.nickname === params.Command)
    if (cmd) {
      sendDefer(`${cmd.command}\n`)
    }
    else {
      sendDefer(`${params.Command}\n`)
    }
  }

  // ------------------------------ HELPER FUNCTIONS ------------------------------

  function map(value, in_min, in_max, out_min, out_max) {
    if (value < in_min) {
      logger.error(
        `map value (${value}) out of range (min = ${in_min}), returning min: ${out_min}`
      )
      return out_min
    }
    else if (value > in_max) {
      logger.error(
        `map value (${value}) out of range (max = ${in_max}), returning max: ${out_max}`
      )
      return out_max
    }
    else {
      return (
        ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
      )
    }
  }

  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup,
    start,
    stop,
    tick,
    keepAlive,
    getAudioLevel,
    getAudioMute,
    getLogicState,
    setAudioLevel,
    setAudioMute,
    setLogicState,
    recallPreset,
    runCustomCommand
  }
}
