'use strict'

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let device  // Appropriate functions will be imported based on config.interface

  const setup = _config => {
    logger.info(`Loading dynamic driver based on configured interface device: ${_config.interface}`)
    device = require(`./lib/${_config.interface}`).createDevice(host, base, _config)
    device.setup()  // Call setup for imported device
  }

  return {
    ...device,  // Spread syntax. Returns all appropriate functions that device exports
    setup       // setup from this file overwrites device setup, which is called manually above
  }
}