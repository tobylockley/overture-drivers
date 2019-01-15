'use strict';

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 3000;           // In-built tick interval
const POLL_PERIOD = 30000;           // Continuous polling function interval
const TCP_TIMEOUT = 30000;          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000;   // How long to wait before attempting to reconnect

let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let tcpClient;
  let updatingSources = false;

  // Object variables to store all MP data
  let encoders = {};
  let decoders = {};
  let multiviews = {};
  let videowalls = {};

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('Zyper$');
  frameParser.on('data', data => onFrame(data));


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    base.setPoll({ action: 'getConfigDecoders', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });

    // Initialise variables for each decoder
    // logger.silly(config);
    config.decoders.forEach( decoder => {
      let var_name = `Sources_${decoder.name.replace(/[^A-Za-z0-9_]/g, '')}`;  // Make legal variable name
      base.createVariable({
        name: var_name,
        type: 'enum',
        enums: ['None'],
        perform: {
          action: 'selectSource',
          params: {Channel: decoder.name, Name: '$string'}
        }
      });
      decoders[decoder.name] = {};
      decoders[decoder.name].var_name = var_name;  // Store overture variable name for updating purposes
    });
  }

  function start() {
    initTcpClient();
  }

  function tick() {
    if (!tcpClient) initTcpClient();
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected';
    tcpClient && tcpClient.end();
    tcpClient = null;
    base.clearPendingCommands();
  }

  function initTcpClient() {
    if (tcpClient) return;  // Return if tcpClient already exists

    tcpClient = host.createTCPClient();
    tcpClient.setOptions({
      receiveTimeout: TCP_TIMEOUT,
      autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
    });
    tcpClient.connect(config.port, config.host);

    tcpClient.on('connect', () => {
      logger.silly('TCPClient connected');
      base.getVar('Status').string = 'Connected';
      updateSources();
    });

    tcpClient.on('data', data => {
      frameParser.push(data.toString());
    });

    tcpClient.on('close', () => {
      logger.silly('TCPClient closed');
      base.getVar('Status').string = 'Disconnected';  // Triggered on timeout, this allows auto reconnect
    });

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`);
      stop();  // Throw out the tcpClient and get a fresh connection
    });
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`TCPClient send: ${data}`);
    return tcpClient && tcpClient.write(data);
  }

  function sendDefer(data) {
    if (send(data)) base.commandDefer(CMD_DEFER_TIME);
    else base.commandError('Data not sent');
    logger.silly('test');
  }

  function onFrame(data) {
    let match, regex;  // Used for regex below
    // logger.silly(`onFrame: ${data}`);
    const pendingCommand = base.getPendingCommand();
    pendingCommand && logger.debug(`pendingCommand: ${pendingCommand.action}`);

    if (updatingSources) {
      logger.silly(`onFrame/updateSources: ${data}`);
      // initialUpdate = false;
      // base.startPolling();
      let imported;  // Decypher the data received, import to object variables
      if (data.includes('show device config decoders')) importZyperData(data, 'device');
      else if (data.includes('show device config encoders')) importZyperData(data, 'device');
      sendDefer('show device config encoders\n');
      sendDefer('show multiviews config\n');
      sendDefer('show video-walls\n');
      let imported = importZyperData(match[0], 'device');  // Decypher the data received, import to object variables
      if (imported.gen.name) {
        decoders[imported.gen.name] = decoders[imported.gen.name] || {};  // Init the device if it doesn't exist
        Object.assign(decoders[imported.gen.name], imported);
      }
      else {
        logger.error(`onFrame/getConfigDecoders: Unable to parse config data, device name not found: ${imported.toString()}`);
      }
    }

    else if (pendingCommand && pendingCommand.action === 'getConfigDecoders') {
      regex = /device\([\s\S]*?^(?=device\(|lastChange)/gm;  // Capture each device one at a time
      let count = 0;
      while ((match = regex.exec(data)) != null) {
        count++;
        let imported = importZyperData(match[0], 'device');  // Decypher the data received, import to object variables
        if (imported.gen.name) {
          decoders[imported.gen.name] = decoders[imported.gen.name] || {};  // Init the device if it doesn't exist
          Object.assign(decoders[imported.gen.name], imported);
        }
        else {
          logger.error(`onFrame/getConfigDecoders: Unable to parse config data, device name not found: ${imported.toString()}`);
        }
      }
      updateAllVars();
      logger.silly(`onFrame/getConfigDecoders: Finished parsing ${count} devices`);
      base.commandDone();
    }

    else if (pendingCommand && pendingCommand.action === 'updateSources') {
      logger.silly(`onFrame/updateSources: ${data}`);
      base.commandDone();
    }

  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function updateSources() {
    // base.commandDefer(CMD_DEFER_TIME);
    // tcpClient && tcpClient.write('show multiviews config\n');
    updatingSources = true;  // Set a flag for onFrame
    sendDefer('show device config decoders\n');
    sendDefer('show device config encoders\n');
    sendDefer('show multiviews config\n');
    sendDefer('show video-walls\n');
  }

  function getConfigDecoders() {
    sendDefer('show device config decoders\n');
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function selectSource(params) {
    logger.silly(`selectSource: ${params.Channel} = ${params.Name}`);
  }


  // ----------------------------- HELPER FUNCTIONS ----------------------------

  function importZyperData(data, keyword) {
    let imported = {};  // Store all imported data here
    let regex_segment = new RegExp(`${keyword}\\((.+)\\)`);
    let match = data.match(regex_segment);  // Get the mac address, or id of the multiview etc
    if (match) {
      imported['id'] = match[1];
    }
    else {
      logger.error(`importZyperData: Unexpected input: ${data}`);
      return;
    }

    let regex_line = new RegExp(`${keyword}\\.(.+); (.*$)`, 'gm');
    // let regex_line = /device\.(.+); (.*$)/gm;
    while ((match = regex_line.exec(data)) != null) {
      let category = match[1];
      imported[category] = imported[category] || {};  // If category key doesn't exist, init with empty object
      let vals = match[2].split(/, /);  // Split  into key=value pairs
      vals.forEach( val => {
        let val_split = val.split(/=/);
        if (val_split.length == 2) imported[category][val_split[0]] = val_split[1];
        else logger.error(`importZyperData: Unexpected data format. Expected: key=value, Received: ${val}`);
      });
    }

    return imported;
  }

  function updateAllVars() {
    // Update all overture variables from devices object (call this after receiving all config data)
    for (let name in decoders) {
      let data = decoders[name];
      // if (data.gen.model && data.gen.type == 'decoder')
      logger.silly(`updateAllVars: ${name}`)
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getConfigDecoders, updateSources,
    selectSource
  };
};