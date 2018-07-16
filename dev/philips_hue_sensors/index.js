'use strict';

const hueTimeout = 10000

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let huejay = require('huejay')
  let hueClient

  const isConnected = () => { return base.getVar('Status').string === 'Connected' }
  const isNotConnected = () => { return base.getVar('Status').string === 'Disconnected' }

  const setup = _config => {
    config = _config

    config.sensors.forEach(sensor => {
      let varname = `${sensor.name}_${sensor.identifier}`
      if (sensor.type === 'Motion Sensor') {
        base.createEnumVariable(varname, ['Off', 'On'])
        base.setPoll({
          action: 'getMotionSensor',
          period: 500,
          params: { Id: sensor.identifier, VarName: varname },
          enablePollFn: isConnected
        });
      }
      else if (sensor.type === 'Dimmer Switch') {
        base.createVariable({
          name: varname,
          type: 'integer',
          min: 1,
          max: 4
        })
        base.setPoll({
          action: 'getDimmerSwitch',
          period: 500,
          params: { Id: sensor.identifier, VarName: varname },
          enablePollFn: isConnected
        });
      }
    });

    base.setPoll('checkConnection', 5000);
    base.setPoll({
      action: 'checkConnection',
      period: 5000,
      enablePollFn: isNotConnected,
      startImmediately: true
    });
  }

  const start = () => {
    hueClient = new huejay.Client({
      host: config.host,
      username: config.username,
      timeout: hueTimeout
    });
    base.startPolling()
  }

  const stop = () => {
    disconnect()
  }

  const checkConnection = () => {
    hueClient.bridge.ping()
    .then(() => {
      if (base.getVar('Status').string === 'Disconnected') {
        base.getVar('Status').string = 'Connected';
      }
    })
    .catch(error => {
      logger.error(`checkConnection: ${error}`);
      disconnect()
    });
  }

  const getDimmerSwitch = params => {
    base.commandDefer(hueTimeout + 1000)
    hueClient.sensors.getById(params.Id)
    .then(sensor => {
      logger.silly(`getDimmerSwitch: [${sensor.id}] buttonevent = ${sensor.state.buttonEvent}`)
      /*
        Button	Action	          Dimmer Button
        1000	  INITIAL_PRESS	    Button 1 (ON)
        1001	  HOLD
        1002	  SHORT_RELEASED
        1003	  LONG_RELEASED
        2000	  INITIAL_PRESS	    Button 2 (DIM UP)
        2001	  HOLD
        2002	  SHORT_RELEASED
        2003	  LONG_RELEASED
        3000	  INITIAL_PRESS	    Button 3 (DIM DOWN)
        3001	  HOLD
        3002	  SHORT_RELEASED
        3003	  LONG_RELEASED
        4000	  INITIAL_PRESS	    Button 4 (OFF)
        4001	  HOLD
        4002	  SHORT_RELEASED
        4003	  LONG_RELEASED
      */
      let button = sensor.state.buttonEvent / 1000
      base.getVar(params.VarName).value = button  // Ignore button states, focus on which button

      switch (button) {  // HACK
        case 1:
          host.perform('toby_kogan', 'Send Command', {Name: 'Power Toggle'})
          break;
        case 2:
          host.perform('toby_kogan', 'Send Command', {Name: 'Volume Up'})
          break;
        case 3:
          host.perform('toby_kogan', 'Send Command', {Name: 'Volume Down'})
          break;
      }
      // switch(sensor.state.buttonEvent) {
      //   case 1000:
      //     state = 1
      //     break;
      //   case 2000:
      //     state = 2
      //     break;
      //   case 3000:
      //     state = 3
      //     break;
      //   case 4000:
      //     state = 4
      //     break;
      // }
      base.commandDone()
    })
    .catch(error => {
      logger.error(`getDimmerSwitch: Could not find sensor [${params.Id}]`);
      base.commandError()
      disconnect()
      throw error;
    });
  }

  const getMotionSensor = params => {
    base.commandDefer(hueTimeout + 1000)
    hueClient.sensors.getById(params.Id)
    .then(sensor => {
      logger.silly(`getMotionSensor: [${sensor.id}] presence = ${sensor.state.presence}`)
      let actual_state = sensor.state.presence ? 'On' : 'Off'
      if (base.getVar(params.VarName).string != actual_state) {
        base.getVar(params.VarName).string = actual_state
      }
      if (sensor.state.presence) host.perform('toby_kogan', 'Send Command', {Name: 'Power Toggle'})  // HACK
      base.commandDone()
    })
    .catch(error => {
      logger.error(`getMotionSensor: Could not find sensor [${params.Id}]`);
      base.commandError()
      disconnect()
      throw error;
    });
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  return {
    setup, start, stop,
    checkConnection, getDimmerSwitch, getMotionSensor
  }
}
