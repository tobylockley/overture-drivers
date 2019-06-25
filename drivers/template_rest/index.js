'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 10000          // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const REQUEST_TIMEOUT = 2000       // Timeout for AJAX requests

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    // Register polling functions
    base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
  }

  function start() {
    base.startPolling()
    tick()  // Get the connection state straight away
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
    base.clearPendingCommands()
  }

  async function tick() {
    try {
      let response = await req('info')  // If no error is thrown, connection is valid
      if (base.getVar('Status').string === 'Disconnected') {
        base.getVar('Status').string = 'Connected'
      }
    }
    catch (error) {
      base.getVar('Status').string === 'Disconnected'
      logger.error(`tick > ${error.message}`)
    }
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  async function req(cmdString) {
    base.commandDefer(CMD_DEFER_TIME)
    try {
      logger.silly(`Running REST request > ${cmdString}`)
      const options = {
        method: 'POST',
        uri: `http://${config.host}/rcCmd.php`,
        timeout: REQUEST_TIMEOUT,
        form: {
          commands: cmdString
        }
      }
      let response = await host.request(options)
      response = JSON.parse(response)
      let zyperResponse = response.responses[0]
      for (let warning of zyperResponse.warnings) logger.warn(`zyperCmd warning > ${warning}`)
      if (zyperResponse.errors.length > 0) throw new Error(zyperResponse.errors[0])
      base.commandDone()
      return zyperResponse
    }
    catch (error) {
      base.commandError(error.message)
      throw new Error(`zyperCmd failed > ${error.message}`)
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getPower() {
    sendDefer('*SEPOWR################\n')
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setPower(params) {
    if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n')
    else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n')
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getPower,
    setPower
  }
}