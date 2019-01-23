'use strict';

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 10000;           // Continuous polling function interval
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

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\r\n');
  frameParser.on('data', data => onFrame(data));


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);
    base.setPoll({ action: 'Get All Outputs', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });

    // First, build enum list of input names
    let input_list = [];
    for (let input in config.model.input_names) {
      let input_name = config.model.input_names[input];
      // Check for duplicates
      if (input_list.includes(input_name)) {
        logger.error(`setup(): WARNING! Duplicate input name (${input_name}). Reverting to default (Input${input})`);
        input_name = `Input${input}`;
      }
      if (input_name == '') input_name = `Input${input}`;  // If blank, use default 'InputX'
      input_list.push(input_name);

      // Finally, update the input name in the config data for reference later
      config.model.input_names[input] = input_name;
    }

    // Now create enum variable for each output, checking for duplicates
    let output_list = [];
    for (let output in config.model.output_names) {
      let output_name = config.model.output_names[output];
      // Check for duplicates
      if (output_list.includes(output_name)) {
        logger.error(`setup(): WARNING! Duplicate output name (${output_name}). Reverting to default (Output${output})`);
        output_name = `Output${output}`;
      }
      if (output_name == '') output_name = `Output${output}`;  // If blank, use default 'OutputX'
      output_list.push(output_name);

      // Create enum variable for this output
      base.createVariable({
        name: `Sources_${output_name}`,
        type: 'enum',
        enums: input_list,
        perform: {
          action: 'Set Output',
          params: {
            Channel: parseInt(output),
            Name: '$string'
          }
        }
      });

      // Finally, update the output name in the config data for reference later
      config.model.output_names[output] = output_name;
    }
  }

  function start() {
    if (config.simulation) base.getVar('Status').string = 'Connected';
    else initTcpClient();
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected';
    tcpClient && tcpClient.end();
    tcpClient = null;
  }

  function tick() {
    if (!config.simulation && !tcpClient) initTcpClient();
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
      base.startPolling();
    });

    tcpClient.on('data', data => {
      frameParser.push( data.toString() );
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
  }

  function onFrame(data) {
    let match;  // Used for regex matching below
    logger.silly(`onFrame: ${data}`);

    match = data.match(/OUT(\d).*IN(\d)/i);
    if (match) {
      // Retrieve input and output names
      let input_name = config.model.input_names[match[2]];
      let output_name = config.model.output_names[match[1]];
      base.getVar(`Sources_${output_name}`).string = input_name;
      base.commandDone();
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getAllOutputs() {
    sendDefer('GET OUT0 VS\r\n');  // Get all outputs
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function selectSource(params) {
    let output_name = config.model.output_names[params.Channel];

    // Make sure params.Channel is in valid range
    if (params.Channel < 1 || params.Channel > config.model.output_names.length) {
      logger.error(`selectSource: params.Channel (${params.Channel}) is out of valid range (1-${config.model.output_names.length})`);
      return;
    }

    // If simulation mode, just set the variable
    if (config.simulation) {
      base.getVar(`Sources_${output_name}`).string = params.Name;
      return;
    }

    // Find input number based on name
    let input_number = 0;
    for (let input in config.model.input_names) {
      if (params.Name == config.model.input_names[input]) {
        input_number = parseInt(input);
      }
    }

    // Send join command, or error message if input not found
    if (input_number > 0) {
      logger.debug(`Connecting "${params.Name}" (Input${input_number}) to "${output_name}" (Output${params.Channel})`);
      sendDefer(`SET OUT${params.Channel} VS IN${input_number}\r\n`);
    }
    else {
      logger.error(`selectSource: Could not find an input matching "${params.Name}"`);
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------

  return {
    setup, start, stop, tick,
    getAllOutputs, selectSource
  };
};


