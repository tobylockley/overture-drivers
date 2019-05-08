'use strict';

const CMD_DEFER_TIME = 1000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 5000;           // Continuous polling function interval
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
  frameParser.setSeparator('\r');
  frameParser.on('data', data => onFrame(data));


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    base.setPoll({ action: 'getSource', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
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
    // Check for errors, otherwise process as normal
    let err = /ERR/;
    if (err.test(data)) {
      base.commandError('Error from module, check Error variable');
      if (data == 'ERR 001\r') base.getVar('Error').value = 'Invalid request. Command not found.';
      else if (data == 'ERR 002\r') base.getVar('Error').value = 'Bad request syntax used with a known command.';
      else if (data == 'ERR 003\r') base.getVar('Error').value = 'Invalid or missing module and/or connector address.';
      else if (data == 'ERR 004\r') base.getVar('Error').value = 'No carriage return found.';
      else if (data == 'ERR 005\r') base.getVar('Error').value = 'Command not supported by current port setting.';
      else if (data == 'ERR 006\r') base.getVar('Error').value = 'Settings are locked.';
      else base.getVar('Error').value = 'General Error';
    }
    else {
      base.getVar('Error').value = '';

      let match = data.match(/OUT.*1,(\w+).*IN.*1,(\w+).*2,(\w+).*3,(\w+)/);
      if (match) {
        logger.debug(`match: ${match[0]} ... [1] ${match[1]}, [2] ${match[2]}, [3] ${match[3]}, [4] ${match[4]}`);

        if (match[1] == 'false') {
          base.getVar('Sources').string = 'None';
        }
        else {
          if (match[2] == 'true') base.getVar('Sources').string = 'HDMI1';
          else if (match[3] == 'true') base.getVar('Sources').string = 'HDMI2';
          else if (match[4] == 'true') base.getVar('Sources').string = 'HDMI3';
        }
        base.commandDone();
      }
    }
  }

  function getSource() {
    sendDefer('getactive,1\r');
  }

  function selectSource(params) {
    if (params.Name == 'None') {
      sendDefer('setstate,1:1,0\rsetstate,1:2,0\rsetstate,1:3,0\r');  // Set all off in one command
    }
    else {
      let match = params.Name.match(/HDMI(\d)/);
      match && sendDefer(`setstate,1:${match[1]},1\r`);
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getSource, selectSource
  };
};