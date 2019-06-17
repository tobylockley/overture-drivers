'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const POLL_PERIOD = 5000           // Continuous polling function interval
const REQUEST_TIMEOUT = 2000       // Timeout for AJAX requests

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let ports = []  // Used to store overture variable references


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function setup(_config) {
    config = _config

    // Register polling function
    base.setPoll({ action: 'getAll', period: POLL_PERIOD, startImmediately: true })

    // Create variables for Power on/off
    for (let i = 1; i <= 12; i++) {
      ports[i] = {}  // Initialise array index with empty object
      let nickname = config[`name${i}`].replace(/[^A-Za-z0-9_]/g, '')  // Make legal variable name
      let varname = nickname ? `Power${i}_${nickname}` : `Power${i}`
      base.createVariable({
        name: varname,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'setPower',
          params: { Channel: i, Status: '$string' }
        }
      })
      ports[i].power = base.getVar(varname)  // Save reference to overture variable
    }

    // Create variables for voltage selection
    for (let i = 1; i <= 12; i++) {
      let nickname = config[`name${i}`].replace(/[^A-Za-z0-9_]/g, '')  // Make legal variable name
      let varname = nickname ? `Voltage${i}_${nickname}` : `Voltage${i}`
      base.createVariable({
        name: varname,
        type: 'enum',
        enums: ['5V', '12V', '24V'],
        perform: {
          action: 'setVoltage',
          params: { Channel: i, Status: '$string' }
        }
      })
      ports[i].voltage = base.getVar(varname)  // Save reference to overture variable
    }
  }

  function start() {
    base.startPolling()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
    base.clearPendingCommands()
  }

  function tick() {
    // Connection status is checked in getAll
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  async function ajaxCmd(cmdString) {
    base.commandDefer(CMD_DEFER_TIME)
    try {
      logger.silly(`Running ajaxCmd > ${cmdString}`)
      const options = {
        method: 'POST',
        uri: `http://${config.host}/cgi-bin/MMX32_Keyvalue.cgi`,
        timeout: REQUEST_TIMEOUT,
        body: `{Input01CMD=${cmdString}}`
      }
      let response = await host.request(options)
      logger.debug(response)
      if (response !== 'result:1') throw new Error(response)
      base.commandDone()
    }
    catch (error) {
      base.commandError(error.message)
      throw new Error(`ajaxCmd failed > ${error.message}`)
    }
  }

  async function ajaxInfo() {
    base.commandDefer(CMD_DEFER_TIME)
    try {
      const options = {
        method: 'POST',
        uri: `http://${config.host}/cgi-bin/MUH44TP_getsetparams.cgi/`,
        timeout: REQUEST_TIMEOUT,
        body: '{tag:ptn}'
      }
      let response = await host.request(options)
      let match = response.match(/\((.*?)\)/)  // Get everything inside the brackets
      if (!match) throw new Error(`Unexpected response data: ${response}`)
      base.commandDone()
      return JSON.parse(match[1].replace(/'/g, '"'))  // Make sure all quotes are "double quotes", then parse JSON and return
    }
    catch (error) {
      base.commandError(error.message)
      throw new Error(`ajaxInfo failed > ${error.message}`)
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  async function getAll() {
    try {
      let data = await ajaxInfo()
      logger.silly(`getAll response: \n${JSON.stringify(data, null, 2)}`)
      base.getVar('Status').string = 'Connected'
      // Process data
      for (let i = 1; i <= 12; i++) {
        // switchNstatu 0/1 = Off/On
        // voltagsN 1/2/3 = 5V/12V/24V
        ports[i].power.value = parseInt(data[`switch${i}statu`])
        ports[i].voltage.value = parseInt(data[`voltags${i}`]) - 1
      }
    }
    catch (error) {
      logger.error(`getAll polling failed > ${error.message}`)
      base.getVar('Status').string = 'Disconnected'
    }
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setPower(params) {
    // Channel (1-12), Status (Off/On)
    if (params.Status === 'Off') {
      ajaxCmd(`${params.Channel}$!`)
    }
    else if (params.Status === 'On') {
      ajaxCmd(`${params.Channel}@!`)
    }
  }

  function setVoltage(params) {
    // Channel (1-12), Status (5V,12V,24V)
    ajaxCmd(`Output/${params.Status}/${params.Channel}!`)
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getAll,
    setPower, setVoltage
  }
}