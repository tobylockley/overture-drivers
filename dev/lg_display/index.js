'use strict';

const CMD_DEFER_TIME = 5000;
const POLL_PERIOD = 5000;
const TICK_PERIOD = 5000;
const TCP_TIMEOUT = 30000;
const TCP_RECONNECT_DELAY = 1000;

let host;
exports.init = _host => {
  host = _host;
}

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let tcpClient;
  let networkUtilities;
  let wol = require('wakeonlan');  // Used to turn display on

  const setID = '01'  // This is used for IP control, see http://www.proaudioinc.com/Dealer_Area/RS232.pdf
  const SOURCES = [
    { name: 'RGB', value: 0x60 },
    { name: 'HDMI1', value: 0x90 },
    { name: 'HDMI2', value: 0x91 },
    { name: 'DisplayPort', value: 0xD0 },
    { name: 'OPS/DVI', value: 0xA5 }
  ]

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('x');
  frameParser.on('data', data => onFrame(data));

  const setup = _config => {
    config = _config;
    networkUtilities = host.createNetworkUtilities();
    base.setTickPeriod(TICK_PERIOD);
    let poll_functions = [
      'Get Power',
      'Get Source',
      'Get Screen Mute',
      'Get Audio Mute',
      'Get Audio Level',
      'Get Brightness',
      'Get Contrast',
      'Get Temperature'
    ]
    poll_functions.forEach(fn => {
      logger.debug(`Initialising polling for: ${fn}`);
      base.setPoll({
        action: fn,
        period: POLL_PERIOD,
        enablePollFn: () => { return base.getVar('Status').string === 'Connected'; },
        startImmediately: true
      });
    });
  }

  const start = () => {
    initTcpClient();
  }

  const stop = () => {
    disconnect();
    if (tcpClient) {
      tcpClient.end();
      tcpClient = null;
    }
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected';
    base.getVar('Power').string = 'Off';
  }

  function tick() {
    // If no connection, send a wake on lan message.
    // if (base.getVar('Status').string === 'Disconnected') wol(config.mac).then( () => logger.silly(`[tick] WOL sent to ${config.mac}`) );
    !tcpClient && initTcpClient();
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient();
      tcpClient.setOptions({
        receiveTimeout: TCP_TIMEOUT,
        autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
      })
      tcpClient.connect(config.port, config.host);

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`);
        base.getVar('Status').string = 'Connected';
        base.startPolling();
      })

      tcpClient.on('data', data => {
        frameParser.push(data.toString());
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`);
        disconnect();
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`);
        stop();
      })
    }
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`);
    return tcpClient && tcpClient.write(data);
  }

  const sendDefer = data => {
    base.commandDefer(CMD_DEFER_TIME);
    if (!send(data)) base.commandError(`Data not sent`);
  }

  const onFrame = data => {
    logger.silly(`onFrame: ${data}`);
    let match = data.match(/(\w) \d+ OK([0-9a-fA-F]+)/);
    if (match) {
      base.commandDone();
      switch (match[1]) {
        case 'a':
          base.getVar('Power').string = (parseInt(match[2]) == 1) ? 'On' : 'Off';
          break;
        case 'b':
          base.getVar('Sources').string = SOURCES.find(x => x.value == parseInt(match[2], 16)).name;
          break;
        case 'd':
          base.getVar('ScreenMute').string = (parseInt(match[2]) == 1) ? 'On' : 'Off';
          break;
        case 'e':
          base.getVar('AudioMute').string = (parseInt(match[2]) == 1) ? 'Off' : 'On';
          break;
        case 'f':
          base.getVar('AudioLevel').value = parseInt(match[2], 16);
          break;
        case 'h':
          base.getVar('Brightness').value = parseInt(match[2], 16);
          break;
        case 'g':
          base.getVar('Contrast').value = parseInt(match[2], 16);
          break;
        case 'n':
          base.getVar('Temperature').value = parseInt(match[2], 16);
          break;
      }
    }
  }

  const getPower = () => sendDefer(Buffer.from(`ka ${setID} FF\r`));
  const getSource = () => sendDefer(Buffer.from(`xb ${setID} FF\r`));
  const getScreenMute = () => sendDefer(Buffer.from(`kd ${setID} FF\r`));
  const getAudioMute = () => sendDefer(Buffer.from(`ke ${setID} FF\r`));
  const getAudioLevel = () => sendDefer(Buffer.from(`kf ${setID} FF\r`));
  const getBrightness = () => sendDefer(Buffer.from(`kh ${setID} FF\r`));
  const getContrast = () => sendDefer(Buffer.from(`kg ${setID} FF\r`));
  const getTemperature = () => sendDefer(Buffer.from(`dn ${setID} FF\r`));

  const setPower = params => {
    if (params.Status == 'Off') {
      sendDefer(Buffer.from(`ka ${setID} 00\r`));
    }
    else if (params.Status == 'On') {
      wol(config.mac).then(() => logger.silly(`setPower: WOL sent to ${config.mac}`));
    }
  }

  const selectSource = params => {
    sendDefer(`xb ${setID} ${SOURCES.find(x => x.name === params.Name).value.toString(16)}\r`);
  }

  const setScreenMute = params => {
    if (params.Status == 'Off') sendDefer(Buffer.from(`kd ${setID} 00\r`));
    else if (params.Status == 'On') sendDefer(Buffer.from(`kd ${setID} 01\r`));
  }

  const setAudioMute = params => {
    if (params.Status == 'Off') sendDefer(`ke ${setID} 01\r`);
    else if (params.Status == 'On') sendDefer(`ke ${setID} 00\r`);
  }

  const setAudioLevel = params => {
    sendDefer(Buffer.from(`kf ${setID} ${params.Level.toString(16)}\r`));
  }

  const setBrightness = params => {
    sendDefer(Buffer.from(`kh ${setID} ${params.Level.toString(16)}\r`));
  }

  const setContrast = params => {
    sendDefer(Buffer.from(`kg ${setID} ${params.Level.toString(16)}\r`));
  }

  return {
    setup, start, stop, tick,
    setPower, selectSource, setScreenMute, setAudioMute, setAudioLevel, setBrightness, setContrast,
    getPower, getSource, getScreenMute, getAudioMute, getAudioLevel, getBrightness, getContrast, getTemperature
  }
}
