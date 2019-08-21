'use strict'

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let networkUtilities = host.createNetworkUtilities()



  // ------------------------------ BASE FUNCTIONS ------------------------------
  function setup(_config) {
    config = _config

    // Initialise variables for each device
    for (let device of config.devices) {
      device.varname = `${device.name.replace(/[^A-Za-z0-9_]/g, '')}_Status`  // Make sure variable name contains only accepted characters
      base.createVariable({
        name: device.varname,
        type: 'enum',
        enums: ['Disconnected', 'Connected']
      })
      device.failcount = 0  // This will be used to keep track of failed pings
    }
    
    base.setPoll({
      action: 'pingDevices',
      period: config.frequency,
      startImmediately: true,
      params: {}
    })
  }

  function start() {
    base.startPolling()
  }

  function stop() {
    base.clearPendingCommands()
    base.stopPolling()
  }

  function pingDevices() {
    for (let device of config.devices) {
      networkUtilities.ping(device.host, {timeout: config.timeout})
        .then(result => {
          if (result == true) {
            device.failcount = 0  // Reset the fail counter
            base.getVar(device.varname).value = 1  // Set to connected
            logger.debug(`Pinged ${device.name} (${device.host}): Success`)
          }
          else {
            device.failcount += 1
            if (device.failcount >= config.debounce) {
              base.getVar(device.varname).value = 0  // Set to disconnected after configured number of fails in a row
            }
            logger.debug(`Pinged ${device.name} (${device.host}): Failed (${device.failcount})`)
          }
        })
        .catch(error => {
          logger.error('Ping Error:', error)
        })
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, pingDevices
  }
}