'use strict';

const CMD_DEFER_TIME = 2000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD = 7000;           // Continuous polling function interval
const TELNET_TIMEOUT = 10000;       // Socket will timeout after specified milliseconds of inactivity
const SEND_TIMEOUT = 1000;          // Timeout when using telnet send function


let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;

  let Telnet = require('telnet-client');
  let telnetClient;

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\n');
  frameParser.on('data', data => onFrame(data));

  const isConnected = () => { return base.getVar('Status').string === 'Connected'; };

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    base.setPoll({ action: 'getAudioLevelAV1', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: false });
    base.setPoll({ action: 'getAudioLevelMic1', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: false });
    base.setPoll({ action: 'getAudioMuteAV1', period:POLL_PERIOD, enablePollFn: isConnected, startImmediately: false });
    base.setPoll({ action: 'getAudioMuteMic1', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: false });
  }

  function start() {
    initTelnetClient();
  }

  function stop() {
    disconnect();
    if (telnetClient) {
      telnetClient.end();
      telnetClient = null;
    }
  }




  function recallPreset(params) {
    logger.debug(`DEVICE recallPreset ${params.Status}`);
    base.getVar('Preset').string = params.Status;
    sendDefer(`DEVICE recallPresetByName ${params.Status}\n`);
  }

  function setAudioLevelAV1(params) {
    logger.debug(`LevelAV1 set level 1  ${params.Level}`);
    base.getVar('AudioLevelAV1').value = params.Level;
    sendDefer(`LevelAV1 set level 1  ${params.Level}\n`);
  }

  function setAudioLevelMic1(params) {
    logger.debug(`LevelMIC1 set level 1 ${params.Level}\n`);
    base.getVar('AudioLevelMic1').value = params.Level;
    sendDefer(`LevelMIC1 set level 1 ${params.Level}\n`);
  }

  function setAudioMuteAV1(params) {
    logger.debug(`LevelAV1 set mute 1  ${params.Level}`);
    base.getVar('AudioMuteAV1').string = params.Status;
    sendDefer(`LevelAV1 set mute 1 ${params.Status}\n`);
  }

  function setAudioMuteMic1(params) {
    logger.debug(`LevelMIC1 set mute 1 ${params.Status}\n`);
    base.getVar('AudioMuteMic1').string = params.Status;
    sendDefer(`LevelMIC1 set mute 1 ${params.Status}\n`);
  }


  const getAudioLevelAV1 = () => sendDefer('LevelAV1 get level 1\n');
  const getAudioLevelMic1 = () => sendDefer('LevelMIC1 get level 1\n');
  const getAudioMuteAV1 = () => sendDefer('LevelAV1 get mute 1\n');
  const getAudioMuteMic1 = () => sendDefer('LevelMIC1 get mute 1\n');




  function tick() {
    !telnetClient && initTelnetClient();
  }

  function disconnect() {
    base.getVar('Status').string = 'Disconnected';
  }

  function initTelnetClient() {
    if (!telnetClient) {
      telnetClient = new Telnet();
      logger.silly(`Attempting telnet connection to: ${config.host}:${config.port}`);

      telnetClient.connect({
        host: config.host,
        port: config.port,
        timeout: TELNET_TIMEOUT,
        initialLFCR: true,
        sendTimeout: SEND_TIMEOUT
      });

      telnetClient.on('connect', function () {
        logger.silly('Telnet connected!');
        base.getVar('Status').string = 'Connected';
        base.startPolling();
      });

      telnetClient.on('data', (chunk) => {
        frameParser.push(chunk);
      });

      telnetClient.on('close', function () {
        logger.silly('telnet closed');
        stop();
      });

      telnetClient.on('error', err => {
        logger.error(`telnetClient: ${err}`);
        stop();
      });
    }
  }


  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME);
    telnetClient.send(data).then(() => {
      // Handled in onFrame
      logger.silly(`Telnet send OK (${data})`);
    }, err => {
      base.commandError(`Telnet send error: ${err}`);
    });
  }

  function onFrame(data) {
    let match;  // Used for regex matching below
    const pendingCommand = base.getPendingCommand();

    logger.silly(`onFrame: ${data}`);
    pendingCommand && logger.debug(`pendingCommand: ${pendingCommand.action}`);

    // Response from polling command


    if (pendingCommand && pendingCommand.action == 'getAudioLevelAV1') {
      // Parse response after issueing a SET function

      match = data.match(/\+OK "value":(-\d+|\d+).000000/);
      if (match) {
        base.getVar('AudioLevelAV1').value = match[1];
        base.commandDone();
      }
    }
    else if (pendingCommand && pendingCommand.action == 'getAudioLevelMic1') {
      // Parse response after issueing a SET function


      match = data.match(/\+OK "value":(-\d+|\d+).000000/);
      if (match) {
        base.getVar('AudioLevelMic1').value = match[1];
        base.commandDone();
      }
    }
    else if (pendingCommand && pendingCommand.action == 'getAudioMuteAV1') {
      // Parse response after issueing a SET function


      match = data.match(/\+OK "value":([a-z]+)/);
      if (match) {
        base.getVar('AudioMuteAV1').string = match[1];
        base.commandDone();
      }
    }

    else if (pendingCommand && pendingCommand.action == 'getAudioMuteMic1') {
      // Parse response after issueing a SET function


      match = data.match(/\+OK "value":([a-z]+)/);
      if (match) {
        base.getVar('AudioMuteMic1').string = match[1];
        base.commandDone();
      }
    }
    else {
      match = data.match(/\+OK/);
      if (match) {
        base.commandDone();
      }
    }
  }


  return {
    setup, start, stop,
    setAudioLevelAV1, getAudioLevelAV1,
    setAudioLevelMic1, getAudioLevelMic1,
    setAudioMuteAV1, getAudioMuteAV1,
    setAudioMuteMic1, getAudioMuteMic1,
    recallPreset,
  };
};