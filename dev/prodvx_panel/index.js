let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let sshExec = require('ssh-exec')

  const LED_BAR_GREEN = "/sys/class/leds/led-front-green/brightness";
  const LED_BAR_RED = "/sys/class/leds/led-front-red/brightness";

  const setup = _config => {
    config = _config

    base.setPoll({
      action: 'Check Connection',
      period: 5000
    })

    base.setPoll({
      action: 'Get Info',
      period: 5000,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected' }
    })
  }

  const start = () => {
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  const sshCommand = (command, callback) => {
    logger.silly(`sending SSH command: "${command}"`)
    sshExec(command, {
      host: config.host,
      port: config.port,
      user: 'root',
      password: config.password
    }, function (err, stdout, stderr) {
      if (err) {
        logger.error(`sshCommand err: ${err}`)
        throw err;
      }
      if (stderr) {
        logger.error(`sshCommand stderr: ${stderr}`)
        throw stderr;
      }
      if (stdout) {
        logger.silly(`sshCommand stdout: ${stdout}`)
        callback(stdout)
      }
    })
  }

  const setPower = params => {
    if (params.Status != base.getVar('Power').string) {
      // Only process if the status is being changed/toggled
      try {
        sshCommand(`input keyevent 26`, result => {
          base.getVar('Power').string = params.Status
        });
      } catch (error) {
        logger.error(`setPower: ${error}`)
        disconnect()
      }
    }
  }

  const checkConnection = () => {
    try {
      // Get connection status
      sshCommand(`echo connection test`, result => {
        if (result.includes('connection test')) base.getVar('Status').string = 'Connected'
        else base.getVar('Status').string = 'Disconnected'
      });
    } catch (error) {
      logger.error(`isConnected: ${error}`)
      disconnect()
    }
  }

  const getInfo = () => {
    try {
      // Get green led strip status
      sshCommand(`cat ${LED_BAR_GREEN}`, result => {
        if (parseInt(result) > 0) base.getVar('GreenLedStrip').string = 'On'
        else base.getVar('GreenLedStrip').string = 'Off'
      });
      // Get red led strip status
      sshCommand(`cat ${LED_BAR_RED}`, result => {
        if (parseInt(result) > 0) base.getVar('RedLedStrip').string = 'On'
        else base.getVar('RedLedStrip').string = 'Off'
      });
      // Get screen state (power)
      sshCommand(`dumpsys display | grep mScreenState`, result => {
        if (result.includes('ON')) base.getVar('Power').string = 'On'
        else base.getVar('Power').string = 'Off'
      });
    } catch (error) {
      logger.error(`getInfo: ${error}`)
      disconnect()
    }
  }

  const setRedLed = params => {
    let value = params.Status == 'On' ? 255 : 0
    try {
      sshCommand(`echo ${value} > ${LED_BAR_RED}`, result => {
        base.getVar('RedLedStrip').string = params.Status;
      });
    } catch (error) {
      logger.error(`setRedLed: ${error}`)
      disconnect()
    }
  }

  const setGreenLed = params => {
    let value = params.Status == 'On' ? 255 : 0
    try {
      sshCommand(`echo ${value} > ${LED_BAR_GREEN}`, result => {
        base.getVar('GreenLedStrip').string = params.Status;
      });
    } catch (error) {
      logger.error(`setGreenLed: ${error}`)
      disconnect()
    }
  }

  return {
    setup, start, stop,
    setPower, checkConnection, getInfo, setRedLed, setGreenLed
  }
}