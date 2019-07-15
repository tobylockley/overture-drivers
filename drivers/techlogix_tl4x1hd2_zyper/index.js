// TODO
// Add human names for input sources
// Switch to AJAX

'use strict';

const CMD_DEFER_TIME = 2000;
const TICK_PERIOD = 3000;
const POLL_PERIOD = 10000;
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
  frameParser.setSeparator('Zyper$');
  frameParser.on('data', data => onFrame(data));

  let frameParser_rs232 = host.createFrameParser();
  frameParser_rs232.setSeparator('\\r\\n');  // Separator for zyper rs232 data
  // frameParser_rs232.on('data', data => onFrame(data));


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // base.setPoll({ action: 'keepAlive', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
    // base.setPoll({ action: 'getSerialResponses', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });

    config.switchers.forEach(switcher => {
      base.createVariable({
        name: `Sources_${switcher.name}`,
        type: 'enum',
        enums: ['HDMI1', 'HDMI2', 'HDMI3', 'HDMI4'],
        perform: {
          action: 'selectSource',
          params: {
            Channel: switcher.zyper_device,
            Name: '$string'
          }
        }
      });
      switcher.lastChangeId = 0;  // Used to track rs232 responses
    });

    base.createVariable({
      name: 'TestString',
      type: 'string',
      perform: {
        action: 'testCommand',
        params: {
          Command: '$string'
        }
      }
    });
  }


  function start() {
    initTcpClient();
  }


  function stop() {
    base.getVar('Status').string = 'Disconnected';
    tcpClient && tcpClient.end();
    tcpClient = null;
    base.clearPendingCommands();
  }

  function tick() {
    if (!tcpClient) initTcpClient();
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
  }

  function onFrame(data) {
    const pendingCommand = base.getPendingCommand();
    pendingCommand && logger.silly(`onFrame pendingCommand: ${pendingCommand.action}`);
    logger.debug(`onFrame: ${data}`);

    if (pendingCommand && pendingCommand.action == 'keepAlive') {
      base.commandDone();
    }
    else if (pendingCommand && pendingCommand.action == 'selectSource') {
      base.commandDone();
      getSerialResponses(pendingCommand.params.Channel);
    }
    else if (pendingCommand && pendingCommand.action == 'getSerialResponses') {
      base.commandDone();
    }

    // Not currently in use - not able to poll switchers for current output
    // let match = data.match(/switch to (HDMI\d)/);
    // if (match) {
      // base.getVar('Sources').string = match[1];
      // base.commandDone();  // Handled in sendDefer
    // }

    // base.commandDone();

  }

  // TODO
  // Adjust lastChangeId on frame
  // LG screen mute


  // ------------------------------ GET FUNCTIONS ------------------------------

  function keepAlive() {
    sendDefer('\n');  // Send rubbish to keep the tcp connection alive
  }

  function getSerialResponses(device) {
    let switcher = config.switchers.filter(switcher => switcher.zyper_device == device);
    if (switcher.length != 1) {
      logger.error(`getSerialResponses: Could not find single entry for zyper device named "${device}"`);
      return;
    }
    switcher = switcher[0];  // If we got here, there is only 1 result, so extract from array
    sendDefer(`show responses ${switcher.zyper_device} rs232 since ${switcher.lastChangeId}\n`);
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function selectSource(params) {
    // params.Channel = name/mac of zyper device, e.g. "4k_dec1"
    // params.Name = source, e.g. "HDMI1"
    sendDefer(`send ${params.Channel} rs232 ${params.Name}%\n`);
  }


  function testCommand(params) {
    // send the string to rs232 device 1
    sendDefer(`send uhd_enc1 rs232 ${params.Command}\n`);
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------

  return {
    setup, start, stop, tick,
    keepAlive, getSerialResponses,
    selectSource,
    testCommand
  };
};