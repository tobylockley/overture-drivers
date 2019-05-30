// Verify lookup table
// Test everything works
// How do command names/control num work
// Selector name vs index
// Toggle 0 = off, 1 = on
// Check for duplicate variable name already declared

'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const TCP_TIMEOUT = 30000          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000   // How long to wait before attempting to reconnect

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient
  let controls = {};  // Lookup table of control number -> variable name

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\r\n')
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Register polling functions
    base.setPoll({ action: 'getAll', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    
    for (let level of config.levels) {
      if (controls[level.number] === undefined) {
        controls[level.number] = level.name.replace(/[^A-Za-z0-9_]/g, '')  // Ensure legal variable name
        base.createVariable({
          name: level.name,
          type: 'real',
          min: 0,
          max: 100,
          perform: {
            action: 'setLevel',
            params: {
              ControlNumber: level.number,
              Level: '$value'
            }
          }
        })
      }
      else {
        logger.error(`Duplicate control number (${level.number}), cannot create Level variable (${level.name})`)
      }
    }

    for (let selector of config.selectors) {
      if (controls[selector.number] === undefined) {
        controls[selector.number] = selector.name.replace(/[^A-Za-z0-9_]/g, '')  // Ensure legal variable name
        base.createVariable({
          name: controls[selector.number],
          type: 'enum',
          enums: selector.options,
          perform: {
            action: 'setSelector',
            params: {
              ControlNumber: selector.number,
              Name: '$string',
              Index: '$value'
            }
          }
        })
      }
      else {
        logger.error(`Duplicate control number (${selector.number}), cannot create Selector variable (${selector.name})`)
      }
    }

    for (let toggle of config.toggles) {
      if (controls[toggle.number] === undefined) {
        controls[toggle.number] = toggle.name.replace(/[^A-Za-z0-9_]/g, '')  // Ensure legal variable name
        base.createVariable({
          name: controls[toggle.number],
          type: 'enum',
          enums: ['Off', 'On'],
          perform: {
            action: 'setToggle',
            params: {
              ControlNumber: toggle.number,
              Status: '$value'
            }
          }
        })
      }
      else {
        logger.error(`Duplicate control number (${toggle.number}), cannot create Toggle variable (${toggle.name})`)
      }
    }

    let enums = ['Idle']
    for (let command of config.commands) {
      if (controls[command.number] === undefined) {
        controls[command.number] = command.name
        enums.push(command.name)
      }
      else {
        logger.error(`Duplicate control number (${command.number}), cannot create Command variable (${command.name})`)
      }
    }
    base.createVariable({
      name: 'Commands',
      type: 'enum',
      enums: enums,
      perform: {
        action: 'sendCommand',
        params: {
          ControlNumber: selector.number,
          Name: '$string',
          Index: '$value'
        }
      }
    })
  }

  function start() {
    initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    tcpClient && tcpClient.end()
    tcpClient = null
  }

  function tick() {
    if (!tcpClient) initTcpClient()
  }

  function initTcpClient() {
    if (tcpClient) return  // Return if tcpClient already exists

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
      frameParser.push(data.toString())
    })

    tcpClient.on('close', () => {
      logger.silly('TCPClient closed')
      base.getVar('Status').string = 'Disconnected'  // Triggered on timeout, this allows auto reconnect
    })

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`)
      stop()  // Throw out the tcpClient and get a fresh connection
    })
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(`${data}\r\n`)
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  function onFrame(data) {
    let match  // Used for regex matching below
    const pendingCommand = base.getPendingCommand()

    logger.silly(`onFrame: ${data}`)
    pendingCommand && logger.silly(`pendingCommand: ${pendingCommand.action}`)

    if (pendingCommand) {
      match = data.match(/POWR(\d+)/)
      if (match && pendingCommand.action == 'getPower') {
        base.getVar('Power').value = parseInt(match[1])  // 0 = off, 1 = on
        base.commandDone()
      }
      else if (match && pendingCommand.action == 'setPower') {
        base.getVar('Power').string = pendingCommand.params.Status
        base.commandDone()
      }
    }



    
    let match;  // Used for regex matching
    logger.silly(`onFrame: ${data}`);

    match = data.match(/<L&(\d+?)&(\d+?)>/)
    if (match) {
      base.commandDone();
      base.getVar( controls[match[1]] ).value = Math.floor( parseInt(match[2]) / 10 );
    }

    match = data.match(/<S&(\d+?)&(\d+?)>/)
    if (match) {
      base.commandDone();
      base.getVar( controls[match[1]] ).value = match[2];
    }

    match = data.match(/<T&(\d+?)&(\d+?)>/)
    if (match) {
      base.commandDone();
      base.getVar( controls[match[1]] ).value = match[2];
    }
  }


  // NO RESPONSE DATA WHEN SETTING/SENDING COMMANDS

  // ------------------------------ GET FUNCTIONS ------------------------------

  function getAll() {
    sendDefer('<?>')  // Request all current control variables
  }

  function getLevel(params) {
    sendDefer(`<L&${params.ControlNumber}>`)
  }

  function getSelector(params) {
    sendDefer(`<S&${params.ControlNumber}>`)
  }

  function getToggle(params) {
    sendDefer(`<T&${params.ControlNumber}>`)
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  const CHECK_DELAY = 1000  // How long to wait before checking value has changed

  function setLevel(params) {
    let val = Math.round(params.Level * 10)  // e.g. 83.9% = 839
    send(`<L&${params.ControlNumber}&${val}>`)
    setTimeout(function() {
      getLevel({ControlNumber: params.ControlNumber})
    }, CHECK_DELAY)  // Verify level change after 1 sec
  }

  function setSelector(params) {
    send(`<S&${params.ControlNumber}&${params.Index}>`)
    setTimeout(function() {
      getSelector({ControlNumber: params.ControlNumber})
    }, CHECK_DELAY)  // Verify selector change after 1 sec
  }

  function setToggle(params) {
    send(`<T&${params.ControlNumber}&${params.Status}>`)
    setTimeout(function() {
      getToggle({ControlNumber: params.ControlNumber})
    }, CHECK_DELAY)  // Verify toggle change after 1 sec
  }

  function sendCommand(params) {
    send(`<C&${params.ControlNumber}&1>`)
    base.getVar('Commands').value = params.Index
    base.getVar('Commands').value = 0  // Set back to Idle
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getAll, getLevel, getSelector, getToggle,
    setLevel, setSelector, setToggle, sendCommand
  }
}