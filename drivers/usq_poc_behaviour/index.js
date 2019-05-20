'use strict';


let host;
exports.init = function init(_host) {
  host = _host;
};

/**
 * create a device
 */
exports.createDevice = function createDevice(base) {
  return new DriverDevice(base);
};


class DriverDevice {

  /**
     * @constructor Creates a device driver to control an Extron DXP Matrix Switcher.
     * @param {object} base - Passed in by Overture.
     * @ignore
     */
  constructor(base) {
    this.base = base;
    this.logger = base.logger || host.logger;
  }

  /**
   * Prepares the driver. Does not start communication with the device.
   * @param {object} config - Passed in by Overture.
   *
   */

  setup(config) {
    this.config = config;

    this.expOut = [];
    this.advOut = [];
    this.expIn = [];
    this.advIn = [];
    this.inputMap = {};
    this.outputMap = {};
    this.base.getVar('CurrentMode').string = 'initial';
    //CREATE VARIABLES BASED ON INPUTS
    this.inputs = this.config.Inputs;
    for (let input of this.inputs) {
      this.logger.debug('processing input - '+ input.name);
      this.inputMap[input.name] = input;
      if(input.expressMode.used) {
        // this input should appear in express Mode
        this.expIn.push(input.name);
      }
      if(input.advancedMode.used) {
        // this input should appear in advanced Mode
        this.advIn.push(input.name);
      }
    }
    //CREATE VARIABLES BASED ON OUTPUTS
    this.outputs = this.config.Outputs;
    for (let output of this.outputs) {
      this.outputMap[output.name] = output;
      if(output.expressMode.used) {
        // this output should appear in express Mode
        this.expOut.push(output.name);
      }
      if(output.advancedMode.used) {
        // this output should appear in advanced Mode
        this.advOut.push(output.name);
      }
    }


  }

  start() {
  }

  stop() {}

  /**
     * Set Current Mode
     * Toggle between different modes -
     * initial - system initial state when "off" button options for express setup and advance setup
     * express - express mode with auto turn on of projectors
     * advanced - advanced setup will all the buttons
     * @param {*} params
     */
  setCurrentMode(params) {
    if(params != null && params.Mode != null) {
      let vv = ['initial', 'express', 'advanced'];
      if (vv.indexOf(params.Mode) !== -1) {
        let oldMode = this.base.getVar('CurrentMode').string;
        // do the logic for each mode
        switch (params.Mode) {
        case 'initial': {
          if(oldMode !== 'initial') {
            // transitioning from on to off
            // turn off both projectors
            let dProjs = {'parent': this.base.name, 'subtype':'projector'};
            host.perform(dProjs,'Set power', {'Status':'Off'});
            //select initial sources
            let dSwitcher = {'parent': this.base.name, 'subtype':'matrix'};
            for(let count = 0; count < this.outputs.length; count++) {
              if(this.outputs[count].initialSource != '') {
                host.perform(dSwitcher,'Select Video Source', {'Source':this.inputMap[this.outputs[count].initialSource].xPoint,'Dest':this.outputs[count].xPoint});
                this.outputs[count].source = this.inputMap[this.outputs[count].initialSource].xPoint;
              }
            }
            let src = this.base.getVar('Source');
            src.enums = [];
            let dest = this.base.getVar('Dest');
            dest.enums = [];
          }
          break;
        }
        case 'express': {

          //load and select expressmode sources and dests
          let src = this.base.getVar('Source');
          src.enums = this.expIn;
          let dest = this.base.getVar('Dest');
          dest.enums = this.expOut;
          if(oldMode == 'initial') {
            // transitioning from off to express
            //do express routing
            let dSwitcher = {'parent': this.base.name, 'subtype':'matrix', 'variablename':'Switcher'};
            for (let out of this.expOut) {
              if(this.outputMap[out].expressMode.source !== '') {
                host.perform(dSwitcher,'Select Video Source', {'Source':this.inputMap[this.outputMap[out].expressMode.source].xPoint,'Dest':this.outputMap[out].xPoint});
                this.outputMap[out].source = this.inputMap[this.outputMap[out].expressMode.source].xPoint;
              }
            }
            // turn on all projectors
            let dProjs = {'parent': this.base.name, 'subtype':'projector', 'variablename':'Proj'};
            host.perform(dProjs,'Set power', {'Status':'On'});
            host.perform(dProjs,'Select Input', {'input':'hd1'});

          }
          break;
        }
        case 'advanced': {

          //load and select expressmode sources and dests
          let src = this.base.getVar('Source');
          src.enums = this.advIn;
          let dest = this.base.getVar('Dest');
          dest.enums = this.advOut;
          if(oldMode == 'initial') {
            // transitioning from off to advanced
            // do advanced routing
            let dSwitcher = {'parent': this.base.name, 'subtype':'matrix', 'variablename':'Switcher'};
            for (let out of this.advOut) {
              if(this.outputMap[out].advancedMode.source !== '') {
                host.perform(dSwitcher,'Select Video Source', {'Source':this.inputMap[this.outputMap[out].advancedMode.source].xPoint,'Dest':this.outputMap[out].xPoint});
                this.outputMap[out].source = this.inputMap[this.outputMap[out].advancedMode.source].xPoint;
              }
            }

          }
          break;
        }
        }
        this.base.getVar('CurrentMode').string = params.Mode;
        return true;
      }
    }
    this.logger.debug('invalid parameter - ' + params + ' given in setCurrentMode');
    return false;
  }

  getCurrentMode() {
    return this.base.getVar('CurrentMode').string;
  }



  setAudioSource(params) {
    if(params != null && params.Source != null) {
      let vv = ['mute', 'projLeft', 'projRight'];
      if (vv.indexOf(params.Mode) !== -1) {
        this.base.getVar('Audio Source').string = params.Source;
        return true;
      }
    }
    this.logger.debug('invalid parameter - ' + params + ' given in setAudioSource');
    return false;
  }

  getAudioSource() {
    return this.base.getVar('Audio Source').string;
  }


  setSource(params) {
    if(params != null && params.Source != null) {
      let src = this.inputMap[params.Source];
      let dest = this.outputMap[this.getDest().string];
      if(!src) {
        this.logger.error('invalid parameter - ' + params.Source + ' given in setSource - src = ' + src);
        return false;
      }
      if(!dest) {
        this.logger.error('no valid destination set in setSource');
        return false;
      }
      // make sure destination device is turned on
      if (dest.deviceName !== '') {
        let destDev = {'parent': this.base.name, 'type':'device', 'variablename': dest.deviceName};
        // would like to check if power is on ???  something like ... host.getVariable(destDev,'Power') .
        // looks like getVariable only takes a string and not a point filter
        host.perform(destDev, 'Set Power', {'Status':'On'});
        host.perform(destDev, 'Select Source', {'Name':'HD1'});

      }
      let dMatrix = {'parent': this.base.name, 'subtype':'matrix', 'variablename': 'Switcher'};
      host.perform(dMatrix, 'Set Dest', {'Dest' : dest.xPoint});
      host.perform(dMatrix, 'Set Source', {'Source' : src.xPoint});

      this.base.getVar('Source').string = params.Source;
      dest.source = params.Source;
    } else {
      this.logger.debug('invalid parameter - ' + params.Source + ' given in setSource');
      return false;
    }
  }

  getDest() {
    return this.base.getVar('Dest');
  }

  setDest(params) {
    if(params != null && params.Output != null) {
      this.base.getVar('Dest').string = params.Output;
      this.base.getVar('Source').string =  this.outputMap[params.Output].source;
    } else {
      this.logger.debug('invalid parameter - ' + params.Source + ' given in setDest');
      return false;
    }
  }



  /**
     *
     * Utility methods
     *
     */



}
