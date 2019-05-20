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
  frameParser.setSeparator('\r\n');
  frameParser.on('data', data => onFrame(data));

  let wall_modules = [];  // This will store BCM wall modules (1,1 2,1 etc)

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }
  function isPoweredOn() { return isConnected() && base.getVar('Power').string === 'On'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Register polling functions
    base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true });
    base.setPoll({ action: 'getAllSources', period: POLL_PERIOD, enablePollFn: isPoweredOn, startImmediately: true });
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
    base.stopPolling();
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
      sendDefer(`${config.device_id} get WallModules`);  // On connection, get wall modules (e.g. 1,1 1,2 etc)
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
    return tcpClient && tcpClient.write(data + '\r\n');  // Append with newline
  }

  function sendDefer(data) {
    if (send(data)) base.commandDefer(CMD_DEFER_TIME);
    else base.commandError('Data not sent');
  }

  function onFrame(data) {
    let match;  // Used for regex matching below
    const pendingCommand = base.getPendingCommand();

    logger.silly(`onFrame: ${data}`);
    pendingCommand && logger.debug(`pendingCommand: ${pendingCommand.action}`);

    match = data.match(/get WallModules \{(.*?)\}/i);
    if (match) {
      wall_modules = match[1].split(' ');  // Split modules into an array
      base.commandDone();
    }

    match = data.match(/get SelInputs .+?\} (.+)/i);
    if (match) {
      let inputs = match[1];  // This should be similar to "HDMI1 {2,2 2,1 1,2} HDMI2 {1,1}"
      let regex_inputs = /(\w+?) \{(.+?)\}/g;
      let input_match;
      while ((input_match = regex_inputs.exec(inputs)) != null) {
        let source = input_match[1];
        let modules = input_match[2].split(' ');
        for (let module of modules) {
          base.getVar(`Sources_${module.replace()}`)
        }
      }

      base.getVar('ChannelShift').value = 0;  // Reset to 'idle'
      base.commandDone();
    }

  }


  // ------------------------------ GET FUNCTIONS ------------------------------
  function getPower() {
    sendDefer('get OpState wall');
  }

  function getAllSources() {
    sendDefer('get SelInput wall');
  }




//DEVICE COMMANDS-----------------------------------------------------------

//END DEVICE COMMANDS------------------------------------------------
// tick() {} // Using own setInterval instead

//POLL COMMANDS--------------------------------------------





  // ------------------------------ SET FUNCTIONS ------------------------------
setPower(params) {
  let power = params.Status === 'On'? "on" : "idle";
  let msg = 'set OpState wall ' + power;
  if(this.sendCommand(msg)) this.base.commandDefer(2000);
  else this.base.commandError('Not Sent');
}
selectSource(params) {
  let msg = 'set SelInput wall ' + params.Name;
  if(this.sendCommand(msg)) this.base.commandDefer(2000);
  else this.base.commandError('Not Sent');
}




  function setPower(params) {
    if (config.simulation) {
      base.getVar('Power').string = params.Status;
      return;
    }

    if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n');
  }

  function selectSource(params) {
    if (config.simulation) {
      base.getVar('Sources').string = params.Name;
      return;
    }

    if (params.Name == 'DTV') sendDefer('*SCINPT0000000000000000\n');
    else {
      let match = params.Name.match(/HDMI(\d)/);
      match && sendDefer(`*SCINPT000000010000000${match[1]}\n`);
    }
  }

  function setAudioLevel(params) {
    if (config.simulation) {
      base.getVar('AudioLevel').value = params.Level;
      return;
    }

    let vol = params.Level.toString().padStart(3, '0');  // Formats the integer with leading zeroes, e.g. 53 = '053'
    sendDefer(`*SCVOLU0000000000000${vol}\n`);
  }

  function setAudioMute(params) {
    if (config.simulation) {
      base.getVar('AudioMute').string = params.Status;
      return;
    }

    if (params.Status == 'Off') sendDefer('*SCAMUT0000000000000000\n');
    else if (params.Status == 'On') sendDefer('*SCAMUT0000000000000001\n');
  }

  function setChannel(params) {
    if (isDTVMode()) {
      if (config.simulation) {
        base.getVar('Channel').value = params.Name;
        return;
      }
      let channel = params.Name.toString().padStart(8, '0');
      sendDefer(`*SCCHNN${channel}.0000000\n`);
    }
    else {
      logger.error('Cannot change channel unless set to DTV mode');
    }
  }

  function shiftChannel(params) {
    if (isDTVMode()) {
      if (config.simulation) {
        let delta = { 'Up': 1, 'Down': -1 };
        base.getVar('Channel').value += delta[params.Name];
        return;
      }
      if (params.Name == 'Up') sendDefer('*SCIRCC0000000000000033\n');
      else if (params.Name == 'Down') sendDefer('*SCIRCC0000000000000034\n');
      base.getVar('ChannelShift').string = params.Name;
    }
    else {
      logger.error('Cannot change channel unless set to DTV mode');
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getPower, getSource, getAudioLevel, getAudioMute, getChannel,
    setPower, selectSource, setAudioLevel, setAudioMute, setChannel, shiftChannel
  };
};

















"use strict"

// exported init function
let logger
let host
exports.init = function (_host) {
  host = _host
  logger = host.logger
}

// exported createDevice function
exports.createDevice = function (base) {
  return new DriverDevice(base)
}

// driver device implementation
class DriverDevice {

  constructor(base) {
    this.base = base;

    //BUILD THE FRAME PARSER
    this.frameParser = host.createFrameParser();
    this.frameParser.setSeparator('\r\n');
    this.frameParser.on('data', (frame) => {
      this.parse(frame);
    });
    this.base.setPoll('getPower', 5000);
    this.base.setPoll('getSource', 5000);
    
  }
  //BASE COMMANDS-------------------------------------------------------
  setup(config) {
     this.config = config;
  }

  start() {
    this.initTcpClient();
    this.base.perform('connect');
  }
  stop() {
    this.tcpClient.end();
    this.disconnect();
  }
//END BASE COMMANDS-----------------------------------------------------------
//DEVICE COMMANDS-----------------------------------------------------------
  setPower(params) {
    let power = params.Status === 'On'? "on" : "idle";
    let msg = 'set OpState wall ' + power;
    if(this.sendCommand(msg)) this.base.commandDefer(2000);
    else this.base.commandError('Not Sent');
  }
  selectSource(params) {
    let msg = 'set SelInput wall ' + params.Name;
    if(this.sendCommand(msg)) this.base.commandDefer(2000);
    else this.base.commandError('Not Sent');
  }

//END DEVICE COMMANDS------------------------------------------------
// tick() {} // Using own setInterval instead

//POLL COMMANDS--------------------------------------------
getPower(params){
  let msg = 'get OpState wall'
  if(this.sendCommand(msg)) this.base.commandDefer(2000);
  else this.base.commandError('Not Sent');
}
getSource(params){
  let msg = 'get SelInput wall'
  if(this.sendCommand(msg)) this.base.commandDefer(2000);
  else this.base.commandError('Not Sent');
}


//END POLL COMMANDS----------------------------------------
//UTIL COMMANDS---------------------------------
  sendCommand(msg){
    return this.tcpClient.write(this.config.device_id + " " + msg + "\r\n");
  }
  startPoll(){
    this.base.perform('getPower');
    this.base.perform('getSource');
    this.base.startPolling();
  }
  connect(){
    this.tcpClient.connect(this.config.port, this.config.host);
  }
  disconnect(){
    this.base.stopPolling();
    this.base.clearPendingCommands();
  }

  // create a tcp client and handle events
  initTcpClient() {
    if(!this.tcpClient){
      logger.debug("TCP Client Created.");
        this.tcpClient = host.createTCPClient()    
        this.tcpClient.on('data', (data) => {
          let frame = data.toString();
          logger.debug("Incoming Frame: " + frame);
          this.frameParser.push(data);
        });

        this.tcpClient.on('connect', () => {
          logger.debug("TCP Connection Open"); 
          this.base.getVar('Status').value = 1
          this.startPoll();
        });

        this.tcpClient.on('close', () => {
          logger.debug("TCP Connection Closed"); 
          this.base.getVar('Status').value = 0;
          this.disconnect();
        });

        this.tcpClient.on('error', (err) => { 
          logger.debug("TCP Connection Error"); 
          this.base.getVar('Status').value = 0;
          this.disconnect();
        });
    }

  }

  parse(frame){
    let rPower = /OpState wall (\w+)/;
    let rSource = /SelInput wall (\w+)/;
    let rError= /not connected/;
    if(rError.test(frame)){
      this.base.getVar("Error").value = frame;
    }else{
      this.base.getVar("Error").value ="";
    }

    if(rPower.test(frame)){
      let power = rPower.exec(frame)[1];
      this.base.getVar("Power").value = power === 'on'? 1 : 0;  
    }
    if(rSource.test(frame)){
      this.base.getVar("Sources").string = rSource.exec(frame)[1];
    }

 
   this.base.commandDone();
  }

}


