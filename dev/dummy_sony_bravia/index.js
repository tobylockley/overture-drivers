let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config

  function isConnected() { return base.getVar('Status').string === 'Connected' };

  function setup(_config) {
    config = _config

    base.setTickPeriod(6000);
    base.setPoll('pollTest', 3000, {}, isConnected, false);

    base.createVariable({
      name: 'ForceConnection',
      type: 'enum',
      enums: ['Off', 'On'],
      perform: {
        action: 'forceConnection',
        params: { Value: '$value' }
      }
    });
  }

  function tick() {
    logger.debug('>>> TICK <<<')
    // base.startPolling()
    // if (base.getVar('Status').value == 0) base.stopPolling()
  }

  function pollTest() {
    logger.info('====== poll test =====')
  }

  function forceConnection(params) {
    let val = parseInt(params.Value)
    base.getVar('Status').value = val;
    base.getVar('ForceConnection').value = val;
  }

  const start = () => {
    base.getVar('Status').string = 'Connected';
    base.startPolling()
  }

  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
    // base.stopPolling()
  }

  const setPower = params => {
    base.getVar('Power').string = params.Status;
  }

  const selectSource = params => {
    base.getVar('Sources').string = params.Name;
  }

  const setAudioLevel = params => {
    base.getVar('AudioLevel').value = params.Level;
  }

  const setAudioMute = params => {
    base.getVar('AudioMute').string = params.Status;
  }

  const setChannel = params => {
    if (base.getVar('Sources').string == 'DTV') {
      base.getVar('Channel').value = params.Name;
    }
  }

  const shiftChannel = params => {
    if (base.getVar('Sources').string == 'DTV') {
      base.getVar('Channel').value += params.Name == 'Up' ? 1 : -1;
    }
  }

  return {
    setup, start, stop, tick,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel, shiftChannel, pollTest, forceConnection
  }
}