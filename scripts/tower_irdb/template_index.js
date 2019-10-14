'use strict'

const POLL_PERIOD = 30000 // Continuous polling interval used for checkStatus
const TCP_TIMEOUT = 2000 // Will timeout after this length of inactivity

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  const ir_codes = require('./ir_codes.json')

  // ------------------------------ BASE FUNCTIONS ------------------------------
  function setup(_config) {
    config = _config
    // Register polling functions
    base.setPoll({
      action: 'checkStatus',
      period: POLL_PERIOD,
      startImmediately: false
    })
    base.getVar('IR_Commands').enums = ['Idle'].concat(Object.keys(ir_codes))
  }

  function start() {
    base.startPolling()
  }

  function stop() {
    base.clearPendingCommands()
    base.stopPolling()
    base.getVar('Status').string = 'Disconnected'
  }

  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function connectThenSend(data) {
    // Open a TCP connection, send data, and wait for response.
    // If connection fails, retry 3 times before admitting defeat.
    
    return new Promise((resolve, reject) => {
      let success = false
      let tcpClient = host.createTCPClient()
      tcpClient.setOptions({
        receiveTimeout: TCP_TIMEOUT
      })

      let frameParser = host.createFrameParser()
      frameParser.setSeparator('\r')
      // If we receive a complete frame, resolve the promise
      frameParser.on('data', data => {
        success = true
        tcpClient.end()
        resolve(data)
      })
      
      tcpClient.on('connect', () => {
        base.getVar('Status').string = 'Connected'
        logger.silly(`tcpClient connected. Writing... ${tcpClient.write(data)}`)
      })
      
      tcpClient.on('data', data => {
        frameParser.push(data.toString())
      })
      
      tcpClient.on('close', () => {
        logger.silly('tcpClient closed')
        if (!success) reject('TCP connection closed before frame received')
      })
      
      tcpClient.on('error', err => {
        logger.error(`tcpClient error: ${err}`)
        reject(err)
      })
      
      tcpClient.connect(config.port, config.host)
    })
  }

  function onFrame(data) {
    const pendingCommand = base.getPendingCommand()
    if (pendingCommand && pendingCommand.action === 'sendCommand') {
      const cmdName = base.getVar('IR_Commands').enums[
        pendingCommand.params.Index
      ]
      logger.silly(`pendingCommand: ${cmdName}  -  received: ${data}`)
      base.getVar('IR_Commands').value = 0 // Set back to idle
      base.commandDone()
    }
    if (pendingCommand && pendingCommand.action === 'keepAlive') {
      base.commandDone()
    }
  }

  function send(data) {
    base.commandDefer(CMD_DEFER_TIME)
    let success = false
    let attempts = 0
    while (attempts < 3 && !success) {
      connectThenSend(data)
        .then(res => {
          //
          success = true
          base.commandDone()
        })
        .catch(error => {
          base.getVar('Status').string = 'Disconnected'
          base.commandError(error)
        })
    }
  }

  // ------------------------------ DEVICE FUNCTIONS ------------------------------

  async function sendCommand(params) {
    let name = base.getVar('IR_Commands').enums[params.Index]
    let code = ir_codes[name]
    if (code) {
      base.getVar('IR_Commands').value = params.Index
      setTimeout(function() {
        base.getVar('IR_Commands').value = 0 // Set back to idle
      }, 10)
      base.commandDefer()
      let success = false
      let attempts = 0
      // Make 3 attempts to send data
      while (attempts < 3 && !success) {
        attempts += 1
        let response = await connectThenSend(`sendir,${config.module}:${config.ir_port},${code}\r`)
        if (response.includes(`completeir,${config.module}:${config.ir_port}`)) {
          success = true
          base.commandDone()
        }
      }
      if (!success) {
        base.getVar('Status').string = 'Disconnected'
        base.commandError('Could not send IR command')
      }
    }
    else {
      logger.error(
        `Invalid command index sent to function sendCommand: ${params.Index}`
      )
    }
  }

  function checkStatus() {
    // sendDefer('getversion\r')
    base.commandDefer()
    let success = false
    let attempts = 0
    // Make 3 attempts to send data
    while (attempts < 3 && !success) {
      attempts += 1
      let response = await connectThenSend(`sendir,${config.module}:${config.ir_port},${code}\r`)
      if (response.includes(`completeir,${config.module}:${config.ir_port}`)) {
        success = true
        base.commandDone()
      }
    }
    if (!success) {
      base.getVar('Status').string = 'Disconnected'
      base.commandError('Could not send IR command')
    }
  }

  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop,
    sendCommand, checkStatus
  }
}
