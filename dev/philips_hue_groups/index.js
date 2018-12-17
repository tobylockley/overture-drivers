'use strict';   // Must declare variables before use

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 1000;           // In-built tick interval
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
  var saved_groups = {};  // Save group info for updating purposes

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  async function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    base.setPoll({ action: 'getAll', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });

    // Init Hue group variables
    for (let group of config.groups) {
      group = group.replace(/\W/g, '');  // Remove any illegal characters

      // Power
      base.createVariable({
        name: `${group}_Power`,
        type: 'enum',
        enums: ['Off', 'On'],
        perform: {
          action: 'setPower',
          params: { Group: group, Status: '$string'}
        }
      });

      // Level
      base.createVariable({
        name: `${group}_Level`,
        type: 'integer',
        min: 0,
        max: 254,
        perform: {
          action: 'setLevel',
          params: { Group: group, Level: '$value'}
        }
      });

      // Color Temperature
      base.createVariable({
        name: `${group}_ColorTemperature`,
        type: 'integer',
        min: 2000,
        max: 6500,
        perform: {
          action: 'setColorTemperature',
          params: { Group: group, Level: '$value'}
        }
      });
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
    disconnect();
  }


  function disconnect() {
    base.getVar('Status').string = 'Disconnected';
  }


  function tick() {
    if (base.getVar('Status').string == 'Disconnected') {
      hueClient.bridge.ping()
        .then(() => {
          return hueClient.bridge.isAuthenticated();
        })
        .then(() => {
          base.getVar('Status').string = 'Connected';
        })
        .catch(error => {
          disconnect();
          logger.error('tick(): ' + error.message);
        });
    }
  }


  function getAll() {
    logger.silly('getAll()');
    base.commandDefer(CMD_DEFER_TIME);
    hueClient.groups.getAll()
      .then(groups => {
        for (let group of groups) {
          // logger.silly(`Group [${group.id}]: ${group.name}`);
          // logger.silly(`..Type: ${group.type}`);
          // logger.silly(`..Class: ${group.class}`);
          // logger.silly('..Light Ids: ' + group.lightIds.join(', '));
          // logger.silly('..State:');
          // logger.silly(`....Any on:     ${group.anyOn}`);
          // logger.silly(`....All on:     ${group.allOn}`);
          // logger.silly('..Action:');
          // logger.silly(`....On:         ${group.on}`);
          // logger.silly(`....Brightness: ${group.brightness}`);
          // logger.silly(`....Color mode: ${group.colorMode}`);
          // logger.silly(`....Hue:        ${group.hue}`);
          // logger.silly(`....Saturation: ${group.saturation}`);
          // group.xy && logger.silly(`....X/Y:        ${group.xy[0]}, ${group.xy[1]}`);
          // logger.silly(`....Color Temp: ${group.colorTemp}`);
          // logger.silly(`....Alert:      ${group.alert}`);
          // logger.silly(`....Effect:     ${group.effect}`);

          if (config.groups.includes(group.name)) {
            let groupname = group.name.replace(/\W/g, '');  // Remove any illegal characters
            saved_groups[groupname] = group;  // Save group info

            if (group.anyOn) base.getVar(`${groupname}_Power`).string = 'On';
            else base.getVar(`${groupname}_Power`).string = 'Off';

            base.getVar(`${groupname}_Level`).value = group.brightness;

            let kelvin = Math.round(1000000 / group.colorTemp);  // Convert from Mired to Kelvin
            if (kelvin > 6500) kelvin = 6500;  // Cap value
            base.getVar(`${groupname}_ColorTemperature`).value = kelvin;

            logger.silly(`${group.name}: [Power] ${group.anyOn ? 'On' : 'Off'}, [Level] ${group.brightness}, [ColorTemp] ${kelvin}`);
          }
        }
        base.commandDone();
      })
      .catch(error => {
        base.commandError(`getAll(): ${error.message}`);
        disconnect();
        throw error;
      });
  }


  function setPower(params) {
    let group = saved_groups[params.Group];

    if (params.Status === 'On') group.on = true;
    else group.on = false;

    base.commandDefer(CMD_DEFER_TIME);
    hueClient.groups.save(group)
      .then(res => {
        logger.silly(`setPower(): success, [${res.id}] ${res.name} = ${params.Status}`);
        base.getVar(`${params.Group}_Power`).string = params.Status;
        base.commandDone();
      })
      .catch(error => {
        base.commandError(`setPower(): ${error.message}`);
        disconnect();
        throw error;
      });
  }


  function setLevel(params) {
    let group = saved_groups[params.Group];

    group.brightness = params.Level;

    base.commandDefer(CMD_DEFER_TIME);
    hueClient.groups.save(group)
      .then(res => {
        logger.silly(`setLevel(): success, [${res.id}] ${res.name} = ${params.Level}`);
        base.getVar(`${params.Group}_Level`).value = params.Level;
        base.commandDone();
      })
      .catch(error => {
        base.commandError(`setLevel(): ${error.message}`);
        disconnect();
        throw error;
      });
  }


  function setColorTemperature(params) {
    let group = saved_groups[params.Group];

    let mired = Math.floor(1000000 / params.Level);  // Convert from Kelvin to Mired
    group.colorTemp = mired;

    base.commandDefer(CMD_DEFER_TIME);
    hueClient.groups.save(group)
      .then(res => {
        logger.silly(`setColorTemperature(): success, [${res.id}] ${res.name} = ${params.Level}`);
        base.getVar(`${params.Group}_ColorTemperature`).value = params.Level;
        base.commandDone();
      })
      .catch(error => {
        base.commandError(`setColorTemperature(): ${error.message}`);
        disconnect();
        throw error;
      });
  }


  return {
    setup, start, stop, tick,
    getAll, setPower, setLevel, setColorTemperature
  };
};