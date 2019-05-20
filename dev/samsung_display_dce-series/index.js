const {MDCDevice} = require( "./mdc" )
let host;

// exported init function
exports.init = function (_host) {
  host = _host
}

// exported createDevice function
exports.createDevice = function (base) {
  return new DriverDevice(base)
}

// driver device implementation
class DriverDevice extends MDCDevice {

  constructor(base) {
    super(host, base)
    this.logger = base.logger || host.logger
    this.base = base;
    this.setupFrameParser();
    
    //SET POLLING COMMANDS
    this.base.setPoll('getPower', 5000, {}, ()=> this.isConnected() );

    this.base.setPoll('getModelName', 10000, {}, ()=>{ return this.isPoweredOn() && !this.base.getVar('Model').value });
    this.base.setPoll('getSerial', 10000, {}, ()=>{ return this.isPoweredOn() && !this.base.getVar('Serial').value });
    this.base.setPoll('getSWVersion', 10000, {}, ()=>{ return this.isPoweredOn() && !this.base.getVar('SWVersion').value });
    this.base.setPoll('getDeviceName', 10000, {}, ()=>{ return this.isPoweredOn() && !this.base.getVar('DeviceName').value })
    this.base.setPoll('getMDCConnectionType', 10000, {}, ()=>{ return this.isPoweredOn() && ![0,1].includes(this.base.getVar('MDCConnectionType').value) });

    this.base.setPoll('getAudioMute', 5000, {}, ()=> this.isPoweredOn() );
    this.base.setPoll('getNetworkStandby', 5000, {}, ()=> this.isPoweredOn() );
    this.base.setPoll('getAudioLevel', 5000, {},()=> this.isPoweredOn() );
    this.base.setPoll('getSource', 5000, {}, ()=> this.isPoweredOn() );
    this.base.setPoll('getContrast', 5000, {}, ()=> this.isPoweredOn() );
    this.base.setPoll('getBrightness', 5000, {}, ()=> this.isPoweredOn() );
    this.base.setPoll('getSharpness', 5000, {}, ()=> this.isPoweredOn() );
    this.base.setPoll('getDisplayStatus', 10000, {}, ()=> this.isPoweredOn() );
  }
    
  //BASE COMMANDS-------------------------------------------------------
  setup(config) {
    this.config = config;
    this.base.getVar('MDCConnectionType').value = 2;
  }

  start() {
    this.base.perform('connect');
  }
  
  stop() {
    this.disconnect();
  }
  //END BASE COMMANDS-----------------------------------------------------------

  //UTIL COMMANDS---------------------------------

  startPoll(){
    this.base.perform('getPower');
    this.base.startPolling();
  }

}


