let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config

  const setup = _config => {
    config = _config
  }

  const start = () => {
    base.getVar('Status').string = 'Connected';
  }

  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
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
    setup, start, stop,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel, shiftChannel
  }
}