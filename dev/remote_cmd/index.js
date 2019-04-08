/* eslint-disable no-unused-vars */
'use strict';


var host;
exports.init = _host => {
  host = _host;
};


exports.createDevice = base => {
  const logger = base.logger || host.logger;
  var config;

  const { exec } = require('child_process');

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('\n');
  frameParser.on('data', data => onFrame(data));


  function setup(_config) {
    config = _config;
  }


  function start() {
  }


  function stop() {
  }


  function run(params) {
    logger.info('----- RUNNING COMMAND ON CS!');
    let ex = exec(params.Cmd, (error, stdout, stderr) => {
      if (error) {
        logger.error(error.message);
      }
      else {
        logger.debug('stdout: ', stdout);
        logger.debug('stderr: ', stderr);
      }
    });
    ex.stdout.on('data', chunk => frameParser.push(chunk));
  }


  function onFrame(data) {
    logger.debug('-----FRAME: ', data.replace(/[\r\n]/g, ''));
  }


  return {
    setup, start, stop, run
  };
};