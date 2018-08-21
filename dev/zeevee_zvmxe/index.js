'use strict';

const POLL_PERIOD = 5000;
const HTTP_TIMEOUT = 3000;

let host
exports.init = _host => {
  host = _host;
}

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let http = require('http');

  const setup = _config => {
    config = _config

    base.getVar('Channel').enums = config.channels.map(x => x.name);  // Update channel list

    base.setPoll({
      action: 'getChannel',
      period: POLL_PERIOD,
      startImmediately: true
    });
  }

  const start = () => {
    base.startPolling();  // Connection status is checked implicitly during getChannel
  }

  const stop = () => {
    base.getVar('Status').string = 'Disconnected';
  }

  const getChannel = () => {
    httpRequest();  // Query the device for it's current channel
  }

  const setChannel = params => {
    // Get channel number from config
    let result = config.channels.filter(x => x.name === params.Name);
    result.length > 1 && logger.error('setChannel: WARNING! Multiple channels are configured with the same channel name!');
    base.commandDefer(HTTP_TIMEOUT);
    httpRequest(`/channel=${result[0].number}`);
  }

  function httpRequest(path) {
    // Send a HTTP GET request to the decoder, using the provided 'path' (optional)
    if (path === undefined) path = '/';

    const options = {
      hostname: config.host,
      port: config.port,
      path: path,
      timeout: HTTP_TIMEOUT
    }

    logger.debug(`Sending GET request to http://${config.host}:${config.port}${path}`);

    const req = http.get(options, res => {
      logger.silly(`HTTP Response - Status Code: ${res.statusCode}`);

      if (res.statusCode != 200) {
        res.destroy(new Error(`Request Failed. Status Code: ${res.statusCode}`));
        return;
      }

      base.getVar('Status').string = 'Connected';  // Connection OK, update status

      let data = '';
      res.setEncoding('utf8');

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        logger.silly(`HTTP Response Data:`);
        logger.silly(data);

        if (data.includes('Invalid Channel Number')) {
          const pendingCommand = base.getPendingCommand();
          if (pendingCommand) {
            logger.error(`setChannel: Could not set channel to "${pendingCommand.params.Name}", please check overture configuration AND ZeeVee modulator settings.`);
            base.commandError('Invalid Channel Number');
          }
        }
        else {
          // Parse response for channel information
          let match = data.match(/\*.+?(\d+)/);  // Look for the line with * character
          if (match) {
            base.commandDone();
            let result = config.channels.filter(x => x.number === parseInt(match[1]));
            // Warn if multiple results, continue anyway
            result.length > 1 && logger.error('httpRequest: WARNING! Multiple channels are configured with the same channel number!');
            base.getVar('Channel').string = result[0].name;
            logger.debug(`HTTP request complete. Current channel = [${result[0].number}] ${result[0].name}`);
          }
        }

      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('HTTP request timed out'));  // Will trigger error event below
    });

    req.on('error', err => {
      logger.error(`HTTP error: ${err.message}`);
      base.getVar('Status').string = 'Disconnected';
    });
  }

  return {
    setup, start, stop,
    setChannel, getChannel
  }
}