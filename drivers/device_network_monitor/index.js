'use strict';

let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let networkUtilities = host.createNetworkUtilities();



  // ------------------------------ BASE FUNCTIONS ------------------------------
  function setup(_config) {
    config = _config;

    base.setTickPeriod(config.frequency);  // Set the tick frequency to the configured ping frequency

    // Initialise variables for each device
    for (let device of config.devices) {
      device.name = device.name.replace(/[^A-Za-z0-9_]/g, '');  // Make sure variable name contains only accepted characters
      base.createVariable({
        name: device.name,
        type: 'enum',
        enums: ['Disconnected', 'Connected']
      });
      device.failcount = 0;  // This will be used to keep track of failed pings
    }
  }

  function start() {
  }

  function stop() {
  }

  function tick() {
    for (let device of config.devices) {
      networkUtilities.ping(device.host, {timeout: config.timeout})
        .then(result => {
          if (result == true) {
            device.failcount = 0;  // Reset the fail counter
            base.getVar(device.name).value = 1;  // Set to connected
            logger.silly(`Pinged ${device.name} (${device.host}): Success`);
          }
          else {
            device.failcount += 1;
            if (device.failcount >= config.debounce) {
              base.getVar(device.name).value = 0;  // Set to disconnected after configured number of fails in a row
            }
            logger.silly(`Pinged ${device.name} (${device.host}): Failed (${device.failcount})`);
          }
        })
        .catch(error => {
          logger.error('Ping Error:', error);
        });
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick
  };
};