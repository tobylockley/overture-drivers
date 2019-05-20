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

  
  selectSourceTopLeft(params) {
    let msg = 'set SelInput 1,1 ' + params.Name;
    this.sendCommand(msg)
  }
  selectSourceTopRight(params) {
    let msg = 'set SelInput 2,1 ' + params.Name;
    this.sendCommand(msg)
  }
  selectSourceBottomLeft(params) {
    let msg = 'set SelInput 1,2 ' + params.Name;
    this.sendCommand(msg)
  }
  selectSourceBottomRight(params) {
    let msg = 'set SelInput 2,2 ' + params.Name;
    this.sendCommand(msg)
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
    return this.tcpClient.write(this.config.deviceID + " " + msg + "\r\n");
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


