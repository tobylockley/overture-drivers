let host
exports.init = (_host) => {
  host = _host
}

exports.createDevice = (base) => {
  const logger = base.logger || host.logger
  let config 

  const setup = (_config) => {
    logger.debug('Setup')
    config = _config
  }

  const start = () => {
    logger.debug('Starting')
    
  }

  const stop = () => {
    logger.debug('Stoping')
  }

  return {
    setup, start, stop
  }
}
