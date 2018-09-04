'use strict';

const POLL_PERIOD = 5000;
const HTTP_TIMEOUT = 3000;

let request;
let host;
exports.init = _host => {
  host = _host;
  request = host.request;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;

  function setup(_config) {
    config = _config;
    base.getVar('Channel').enums = config.channels.map(x => x.name);  // Update channel list from config

    base.setPoll({
      action: 'getChannel',
      period: POLL_PERIOD,
      startImmediately: true
    });
  }

  function start() {
    if (config.simulation) base.getVar('Status').string = 'Connected';
    else base.startPolling();  // Connection status is checked implicitly during getChannel
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected';
    base.stopPolling();
  }

  function getChannel() {
    sendRequest();  // Query the device for it's current channel
  }

  function setChannel(params) {
    if (config.simulation) {
      base.getVar('Channel').string = params.Name;
      return;
    }

    // Get channel number from config
    let result = config.channels.filter(x => x.name === params.Name);
    if (result.length > 1) logger.error('setChannel: WARNING! Multiple channels are configured with the same channel name!');
    base.commandDefer(HTTP_TIMEOUT);
    sendRequest(`/channel=${result[0].number}`);
  }

  function shiftChannel(params) {
    let channels = base.getVar('Channel').enums;
    let channel_value = base.getVar('Channel').value;

    // Convert direction string into positive/negative integer
    let direction;
    if (params.Direction == 'Down') direction = -1;
    else if (params.Direction == 'Up') direction = 1;

    // Adjust channel, then check for overflow
    channel_value = channel_value + direction;
    if (channel_value < 0) {
      channel_value = channels.length - 1;
    }
    else if (channel_value >= channels.length) {
      channel_value = 0;
    }

    // Finally, set the channel
    setChannel({Name: channels[channel_value]});
  }

  function sendRequest(path) {
    // Send a HTTP GET request to the decoder, using the provided 'path' (optional)
    if (path === undefined) path = '/';
    logger.debug(`Sending GET request to http://${config.host}:${config.port}${path}`);

    const options = {
      method: 'GET',
      uri: `http://${config.host}:${config.port}${path}`,
      timeout: HTTP_TIMEOUT
    };

    request(options).then( response => {
      base.getVar('Status').string = 'Connected';  // Connection OK, update status
      logger.silly(`HTTP Response Data: ${response}`);
      if (response.includes('Invalid Channel Number')) {
        const pendingCommand = base.getPendingCommand();
        if (pendingCommand) {
          base.commandError('Invalid Channel Number');
          logger.error(`setChannel: Could not set channel to "${pendingCommand.params.Name}", please ensure driver configuration matches ZeeVee modulator settings.`);
        }
      }
      else {
        // Parse response for channel information
        let match = response.match(/\*.+?(\d+)/);  // Look for the line with * character
        if (match) {
          base.commandDone();
          let result = config.channels.filter(x => x.number === parseInt(match[1]));
          // Warn if multiple results, continue anyway
          result.length > 1 && logger.error('httpRequest: WARNING! Multiple channels are configured with the same channel number!');
          base.getVar('Channel').string = result[0].name;
          logger.debug(`HTTP request complete. Current channel = [${result[0].number}] ${result[0].name}`);
        }
      }
    }).catch(err => {
      logger.error(`${err.name} ... ${err.message}`);
      base.getVar('Status').string = 'Disconnected';
    });
  }

  return {
    setup, start, stop,
    setChannel, getChannel, shiftChannel
  };
};