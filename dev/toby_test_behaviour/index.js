'use strict';

let host;
exports.init = function init(_host) {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function setup(_config) {
    // config = _config;

    let left_proj = host.getVariable(`${base.name}_left_projector`);
    let right_proj = host.getVariable(`${base.name}_right_projector`);
    logger.debug(left_proj, right_proj);

    // expOut = [];
    // advOut = [];
    // expIn = [];
    // advIn = [];
    // inputMap = {};
    // outputMap = {};
    // base.getVar('CurrentMode').string = 'initial';

    // //CREATE VARIABLES BASED ON INPUTS
    // inputs = config.Inputs;
    // for (let input of inputs) {
    //   logger.debug('processing input - '+ input.name);
    //   inputMap[input.name] = input;
    //   if(input.expressMode) {
    //     // input should appear in express Mode
    //     expIn.push(input.name);
    //   }
    //   if(input.advancedMode) {
    //     // input should appear in advanced Mode
    //     advIn.push(input.name);
    //   }
    // }

    // //CREATE VARIABLES BASED ON OUTPUTS
    // for (let output of config.Outputs) {
    //   outputMap[output.name] = output;
    //   if(output.expressMode.used) {
    //     // output should appear in express Mode
    //     expOut.push(output.name);
    //   }
    //   if(output.advancedMode.used) {
    //     // output should appear in advanced Mode
    //     advOut.push(output.name);
    //   }
    // }
  }

  function start() {
    // Register variable listeners
  }

  function stop() {
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function setDest(params) {
    // base.getVar('Dest').string = params.Output;
    // base.getVar('Source').string = outputMap[params.Output].source;
  }

  function setSource(params) {
    // let src = inputMap[params.Source];
    // let dest = outputMap[getDest().string];
    // if(!src) {
    //   logger.error('invalid parameter - ' + params.Source + ' given in setSource - src = ' + src);
    //   return false;
    // }
    // if(!dest) {
    //   logger.error('no valid destination set in setSource');
    //   return false;
    // }
    // // make sure destination device is turned on
    // if (dest.deviceName !== '') {
    //   let destDev = {'parent': base.name, 'type':'device', 'variablename': dest.deviceName};
    //   // would like to check if power is on ???  something like ... host.getVariable(destDev,'Power') .
    //   // looks like getVariable only takes a string and not a point filter
    //   host.perform(destDev, 'Set Power', {'Status':'On'});
    //   host.perform(destDev, 'Select Source', {'Name':'HD1'});

    // }
    // let dMatrix = {'parent': base.name, 'subtype':'matrix', 'variablename': 'Switcher'};
    // host.perform(dMatrix, 'Set Dest', {'Dest' : dest.xPoint});
    // host.perform(dMatrix, 'Set Source', {'Source' : src.xPoint});

    // base.getVar('Source').string = params.Source;
    // dest.source = params.Source;
  }

  function setAudioSource(params) {
    // if(params != null && params.Source != null) {
    //   let vv = ['mute', 'projLeft', 'projRight'];
    //   if (vv.indexOf(params.Mode) !== -1) {
    //     base.getVar('Audio Source').string = params.Source;
    //     return true;
    //   }
    // }
    // logger.debug('invalid parameter - ' + params + ' given in setAudioSource');
    // return false;
  }

  function testCmd(params) {
    let filter = { parent: base.name, subtype: 'projector' };
    host.perform(filter, 'Set Power', {'Status': params.Status});
    base.getVar('proj_pwr').string = params.Status;
  }

  function setCurrentMode(params) {
    // let oldMode = base.getVar('CurrentMode').string;

    // if (params.Mode == 'initial') {
    //   // Transitioning from ON -> OFF
    //   base.getVar('projector_power').string = 'Off';

    //   //select initial sources
    //   let dSwitcher = {'parent': base.name, 'subtype':'matrix'};

    //   for(let count = 0; count < outputs.length; count++) {
    //     if(outputs[count].initialSource != '') {
    //       host.perform(dSwitcher,'Select Video Source', {'Source':inputMap[outputs[count].initialSource].xPoint,'Dest':outputs[count].xPoint});
    //       outputs[count].source = inputMap[outputs[count].initialSource].xPoint;
    //     }
    //   }
    //   base.getVar('Source').enums = [];
    //   base.getVar('Dest').enums = [];
    // }
    // else if (params.Mode == 'express') {
    //   //load and select expressmode sources and dests
    //   let src = base.getVar('Source');
    //   src.enums = expIn;
    //   let dest = base.getVar('Dest');
    //   dest.enums = expOut;
    //   if(oldMode == 'initial') {
    //     // transitioning from off to express
    //     //do express routing
    //     let dSwitcher = {'parent': base.name, 'subtype':'matrix', 'variablename':'Switcher'};
    //     for (let out of expOut) {
    //       if(outputMap[out].expressMode.source !== '') {
    //         host.perform(dSwitcher,'Select Video Source', {'Source':inputMap[outputMap[out].expressMode.source].xPoint,'Dest':outputMap[out].xPoint});
    //         outputMap[out].source = inputMap[outputMap[out].expressMode.source].xPoint;
    //       }
    //     }
    //     // turn on all projectors
    //     let dProjs = {'parent': base.name, 'subtype':'projector', 'variablename':'Proj'};
    //     host.perform(dProjs,'Set power', {'Status':'On'});
    //     host.perform(dProjs,'Select Input', {'input':'hd1'});

    //   }
    // }
    // else if (params.Mode == 'advanced') {
    //   //load and select expressmode sources and dests
    //   let src = base.getVar('Source');
    //   src.enums = advIn;
    //   let dest = base.getVar('Dest');
    //   dest.enums = advOut;
    //   if(oldMode == 'initial') {
    //     // transitioning from off to advanced
    //     // do advanced routing
    //     let dSwitcher = {'parent': base.name, 'subtype':'matrix', 'variablename':'Switcher'};
    //     for (let out of advOut) {
    //       if(outputMap[out].advancedMode.source !== '') {
    //         host.perform(dSwitcher,'Select Video Source', {'Source':inputMap[outputMap[out].advancedMode.source].xPoint,'Dest':outputMap[out].xPoint});
    //         outputMap[out].source = inputMap[outputMap[out].advancedMode.source].xPoint;
    //       }
    //     }

    //   }
    // }
    // base.getVar('CurrentMode').string = params.Mode;
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop,
    setDest, setSource, setAudioSource, setCurrentMode,
    testCmd
  };
};
