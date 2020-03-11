let host;
let request;

const HTTP_TIMEOUT = 10000;
const GET = 'GET';
const BASE_API_URI = '/YamahaExtendedControl/v1';

const ERROR_RESPONSES = {
  1: "Initializing",
  2: "Internal Error",
  3: "Invalid Request",
  4: "Invalid Parameter",
  5: "Guarded",
  6: "Time Out",
  99: "Firmware Updating",
  100: "Access Error",
  999: "Unknown"
};


// exported init function
exports.init = function (_host) {
  host = _host;
  request = host.request;
}

// exported createDevice function
exports.createDevice = function (base) {
  return new DriverDevice(base)
}

// driver device implementation
class DriverDevice {

  constructor(base) {
    this.logger = base.logger || host.logger
    this.base = base;
    
    this.base.setPoll('getStatus', 2000);
  }
    
  //BASE COMMANDS-------------------------------------------------------
  setup(config) {
    this.config = config;
  }

  start() {
    this.startPoll();
  }
  
  stop() {
    this.base.stopPolling();
    this.base.clearPendingCommands();
    this.base.getVar('Status').value = 0;
  }
  //END BASE COMMANDS-----------------------------------------------------------

  // DEVICE COMMANDS

  getFeatures() {
    this.sendCommand('/system/getFeatures', {}, (body)=>{
      if (body.system) {
        this.base.getVar('Sources').enums = body.system.input_list.map(input => input.id);
        
        let volumeFeature = body.system.range_step.find(st=> st.id == 'volume');
        if (volumeFeature) {
          this.base.getVar('AudioLevel').min = volumeFeature.min;
          this.base.getVar('AudioLevel').max = volumeFeature.max;
        } else {
          this.logger.error('Could not parse features for volume levels!!');
        }
        this.base.commandDone();
      } else {
        this.logger.error("Cannot fetch features!!");
        this.base.commandError("Command Failed");
      }
    });
  }

  getStatus() {
    this.sendCommand('/main/getStatus', {}, (body)=>{
      this.base.getVar('Power').value = Number( body.power == "on" );
      this.base.getVar('AudioLevel').value = scaleValueFromRange(body.volume, [0,160], [-80,0]);
      this.base.getVar('AudioMute').value = Number( body.mute );
      this.base.getVar('Sources').string = body.input;

      this.base.commandDone();
    });
  }

  setPower({Status}) {
    this.sendCommand('/main/setPower', {qs: {power: (Status == 'On' ? 'on' : 'standby') }});
  }

  setAudioLevel({Level}) {
    this.sendCommand('/main/setVolume', {qs: {volume: scaleValueFromRange(Level, [-80,0], [0,160])}});
  }

  setAudioMute({Status}) {
    this.sendCommand('/main/setMute', {qs: {enable: (Status == 'On' ? 'true' : 'false')}});
  }

  selectSource({Name}) {
    this.sendCommand('/main/setInput', {qs: {input: Name}});
  }

  // END DEVICE COMMANDS

  //UTIL COMMANDS---------------------------------

  startPoll(){
    this.base.perform('getFeatures');
    this.base.startPolling();
  }

  sendCommand(url, _options={}, successCB=null, errorCB=null) {
    let options = Object.assign({
      method: GET,
      uri: `http://${this.config.host}${BASE_API_URI}${url}`,
      json: true,
      timeout: HTTP_TIMEOUT
    }, _options);

    let requestPromise = request(options)
      .then( body => {
        if (body.response_code > 0) {
          let error = ERROR_RESPONSES[parseInt(body.response_code)];
          if (!error) error = ERROR_RESPONSES['999'];
          
          this.logger.error(`Server responded with an error: ${error}`);
          if (errorCB != null)
            errorCB(error);
          else
            this.base.commandError(error);
        
        } else if (successCB != null) {
          successCB(body);

        } else
          this.base.commandDone();
        
        this.base.getVar('Status').value = 1;
      })
      .catch( err => {
        this.logger.error('Response Error: ' + err);
        if (errorCB != null)
          errorCB(err);
        else
          this.base.commandError('Command Not Sent');

        this.base.getVar('Status').value = 0;
      });
    
    this.base.commandDefer(5000);
    return requestPromise;
  }
  
}

function scaleValueFromRange(val, startRange, targetRange) {
  return ( (val - startRange[0]) / (startRange[1] - startRange[0]) ) * (targetRange[1] - targetRange[0]) + targetRange[0];
}

