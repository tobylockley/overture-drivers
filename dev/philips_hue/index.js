'use strict';   // Must declare variables before use

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 5000;           // Continuous polling function interval
const HUE_TIMEOUT = 5000;           // Timeout for hue bridge communication

var host;
exports.init = _host => {
  host = _host;
};


exports.createDevice = base => {
  const logger = base.logger || host.logger;
  var config;
  var huejay;
  var hueClient;
  var all_lights;   // global array to store current light status/values
  var all_sensors;  // global array to store current sensor status/values


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  async function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // base.setPoll({ action: 'getLights', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
    // base.setPoll({ action: 'getSensors', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });

    base.createVariable({
      name: 'Test',
      type: 'enum',
      enums: ['Foo', 'Bar']
    });

    // initHue();

    try {
      // logger.info('awaiting');
      // let lights = await hueClient.lights.getAll();

      // logger.info('after await, light[0] = ' + lights[0].name);
      // all_lights = lights;
      // lights.sort( (a, b) => a.name.localeCompare(b.name) );  // Sort lights based on human name
      // for (let light of lights) {
      //   light.name = light.name.replace(/\W/g, '');  // Remove any illegal characters

      //   // Status
      //   base.createVariable({
      //     name: `${light.name}_Status`,
      //     type: 'enum',
      //     enums: ['Disconnected', 'Connected']
      //   });

      //   // Power
      //   base.createVariable({
      //     name: `${light.name}_Power`,
      //     type: 'enum',
      //     enums: ['Off', 'On'],
      //     perform: {
      //       action: 'setPower',
      //       params: { Channel: light.id, Status: '$string'}
      //     }
      //   });

      //   // Level
      //   base.createVariable({
      //     name: `${light.name}_Level`,
      //     type: 'integer',
      //     max: 254,
      //     perform: {
      //       action: 'setLevel',
      //       params: { Channel: light.id, Level: '$value'}
      //     }
      //   });

      //   // Color Temperature
      //   base.createVariable({
      //     name: `${light.name}_ColorTemperature`,
      //     type: 'integer',
      //     min: 153,
      //     max: 500,
      //     perform: {
      //       action: 'setColorTemperature',
      //       params: { Channel: light.id, Level: '$value'}
      //     }
      //   });
      // }

    } catch (error) {
      logger.error('setup():' + error.message);
    }
  }


  function start() {
    huejay = require('huejay');
    hueClient = new huejay.Client({
      host:     config.host,
      username: config.username,
      timeout:  HUE_TIMEOUT,
    });
    base.startPolling();
  }


  function stop() {
    base.stopPolling();
    base.clearPendingCommands();
    base.getVar('Status').string = 'Disconnected';
  }


  function tick() {
    hueClient.bridge.ping()
      .then(() => {
        return hueClient.bridge.isAuthenticated();
      })
      .then(() => {
        base.getVar('Status').string = 'Connected';
      })
      .catch(error => {
        base.getVar('Status').string = 'Disconnected';
        logger.error('tick(): ' + error.message);
      });

    // hueClient.groups.getAll()
    //   .then(groups => {
    //     for (let group of groups) {
    //       logger.silly(`Group [${group.id}]: ${group.name}`);
    //       logger.silly(`  Type: ${group.type}`);
    //       logger.silly(`  Class: ${group.class}`);
    //       logger.silly('  Light Ids: ' + group.lightIds.join(', '));
    //       logger.silly('  State:');
    //       logger.silly(`    Any on:     ${group.anyOn}`);
    //       logger.silly(`    All on:     ${group.allOn}`);
    //       logger.silly('  Action:');
    //       logger.silly(`    On:         ${group.on}`);
    //       logger.silly(`    Brightness: ${group.brightness}`);
    //       logger.silly(`    Color mode: ${group.colorMode}`);
    //       logger.silly(`    Hue:        ${group.hue}`);
    //       logger.silly(`    Saturation: ${group.saturation}`);
    //       logger.silly(`    X/Y:        ${group.xy[0]}, ${group.xy[1]}`);
    //       logger.silly(`    Color Temp: ${group.colorTemp}`);
    //       logger.silly(`    Alert:      ${group.alert}`);
    //       logger.silly(`    Effect:     ${group.effect}`);

    //       if (group.modelId !== undefined) {
    //         logger.silly(`  Model Id: ${group.modelId}`);
    //         logger.silly(`  Unique Id: ${group.uniqueId}`);
    //         logger.silly('  Model:');
    //         logger.silly(`    Id:           ${group.model.id}`);
    //         logger.silly(`    Manufacturer: ${group.model.manufacturer}`);
    //         logger.silly(`    Name:         ${group.model.name}`);
    //         logger.silly(`    Type:         ${group.model.type}`);
    //       }

    //       logger.silly();
    //     }
    //   });
  }


  async function initHue() {

    // Get all light and sensor information from Hue Bridge and create dynamic variables

    try {
      logger.debug('awaiting');
      let lights = await hueClient.lights.getAll();

      logger.debug('after await, light[0] = ' + lights[0].name);
      all_lights = lights;
      lights.sort( (a, b) => a.name.localeCompare(b.name) );  // Sort lights based on human name
      for (let light of lights) {
        light.name = light.name.replace(/\W/g, '');  // Remove any illegal characters

        // Status
        base.createVariable({
          name: `${light.name}_Status`,
          type: 'enum',
          enums: ['Disconnected', 'Connected']
        });

        // Power
        base.createVariable({
          name: `${light.name}_Power`,
          type: 'enum',
          enums: ['Off', 'On'],
          perform: {
            action: 'setPower',
            params: { Channel: light.id, Status: '$string'}
          }
        });

        // Level
        base.createVariable({
          name: `${light.name}_Level`,
          type: 'integer',
          max: 254,
          perform: {
            action: 'setLevel',
            params: { Channel: light.id, Level: '$value'}
          }
        });

        // Color Temperature
        base.createVariable({
          name: `${light.name}_ColorTemperature`,
          type: 'integer',
          min: 153,
          max: 500,
          perform: {
            action: 'setColorTemperature',
            params: { Channel: light.id, Level: '$value'}
          }
        });
      }

    } catch (error) {
      logger.error('setup():' + error.message);
    }
    // hueClient.lights.getAll()
    //   .then(lights => {
    //     all_lights = lights;
    //     lights.sort( (a, b) => a.name.localeCompare(b.name) );  // Sort lights based on human name
    //     for (let light of lights) {
    //       light.name = light.name.replace(/\W/g, '');  // Remove and illegal characters

    //       // Status
    //       base.createVariable({
    //         name: `${light.name}_Status`,
    //         type: 'enum',
    //         enums: ['Disconnected', 'Connected']
    //       });

    //       // Power
    //       base.createVariable({
    //         name: `${light.name}_Power`,
    //         type: 'enum',
    //         enums: ['Off', 'On'],
    //         perform: {
    //           action: 'setPower',
    //           params: { Channel: light.id, Status: '$string'}
    //         }
    //       });

    //       // Level
    //       base.createVariable({
    //         name: `${light.name}_Level`,
    //         type: 'integer',
    //         max: 254,
    //         perform: {
    //           action: 'setLevel',
    //           params: { Channel: light.id, Level: '$value'}
    //         }
    //       });

    //       // Color Temperature
    //       base.createVariable({
    //         name: `${light.name}_ColorTemperature`,
    //         type: 'integer',
    //         min: 153,
    //         max: 500,
    //         perform: {
    //           action: 'setColorTemperature',
    //           params: { Channel: light.id, Level: '$value'}
    //         }
    //       });
    //     }
    //   })
    //   .catch(error => {
    //     base.getVar('Status').string = 'Disconnected';
    //     logger.error('setup():' + error.message);
    //   });
  }


  function getLights() {
    logger.silly('getLights');
    hueClient.lights.getAll()
      .then(lights => {
        all_lights = lights;

        let light = lights.filter(light => light.name === 'Test Strip Light')[0];
        logger.silly(`    On:         ${light.on}`);
        logger.silly(`    Reachable:  ${light.reachable}`);
        logger.silly(`    Brightness: ${light.brightness}`);
        logger.silly(`    Color mode: ${light.colorMode}`);
        logger.silly(`    Hue:        ${light.hue}`);
        logger.silly(`    Saturation: ${light.saturation}`);
        logger.silly(`    X/Y:        ${light.xy[0]}, ${light.xy[1]}`);
        logger.silly(`    Color Temp: ${light.colorTemp}`);
        logger.silly(`    Alert:      ${light.alert}`);
        logger.silly(`    Effect:     ${light.effect}`);
        logger.silly();
      })
      .catch(error => {
        logger.error('getLights():' + error.message);
      });
  }


  function getSensors() {
    logger.silly('getSensors');
    hueClient.sensors.getAll()
      .then(sensors => {
        all_sensors = sensors;
      })
      .catch(error => {
        logger.error('getSensors():' + error.message);
      });
  }


  function setPower(params) {
    let light = all_lights.filter(light => light.id === params.Channel)[0];  // Get the light object using this lights id
    if (params.Status === 'On') light.on = true;
    else light.on = false;

    hueClient.lights.save(light)
      .then(light => {
        logger.silly(`setPower(): success, [${light.id}] = ${params.Status}`);
      })
      .catch(error => {
        logger.error('setPower(): ' + error.message);
      });
  }


  function setLevel(params) {
    let light = all_lights.filter(light => light.id === params.Channel)[0];  // Get the light object using this lights id
    light.brightness = params.Level;

    hueClient.lights.save(light)
      .then(light => {
        logger.silly(`setLevel(): success, [${light.id}] = ${params.Level}`);
      })
      .catch(error => {
        logger.error('setLevel(): ' + error.message);
      });
  }


  function setColorTemperature(params) {
    let light = all_lights.filter(light => light.id === params.Channel)[0];  // Get the light object using this lights id
    light.colorTemp = params.Level;

    hueClient.lights.save(light)
      .then(light => {
        logger.silly(`setColorTemperature(): success, [${light.id}] = ${params.Level}`);
      })
      .catch(error => {
        logger.error('setColorTemperature(): ' + error.message);
      });
  }


  return {
    setup, start, stop, tick,
    getLights, getSensors,
    setPower, setLevel, setColorTemperature
  };
};