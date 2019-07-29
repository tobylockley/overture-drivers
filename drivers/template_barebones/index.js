'use strict'

let host
exports.init = _host => {
  host = _host
}


exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config


  // ------------------------------ BASE FUNCTIONS ------------------------------

  function setup(_config) {
    config = _config
    logger.silly(config)  // To remove eslint errors. Should be removed.
  }


  function start() {
  }


  function stop() {
  }


  function tick() {
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick
  }
}