let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config 

  const setup = _config => {
    logger.debug('Setup')
    config = _config
  }

  const start = () => {
    logger.debug('Starting')
  }

  const stop = () => {
    logger.debug('Stoping')
  }

  const setPower = params => {
    logger.debug(`setPower ${params.Status}`)
    base.getVar('Power').string = params.Status
  }

  const selectSource = params => {
    logger.debug(`selectSource ${params.Name}`)
    base.getVar('Sources').string = params.Name
  }

  const setAudioLevel = params => {
    logger.debug(`setAudioLevel ${params.Level}`)
    base.getVar('AudioLevel').value = params.Level
  }

  return {
    setup, start, stop,
    setPower, selectSource, setAudioLevel,
  }
}