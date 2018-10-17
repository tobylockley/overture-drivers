'use strict';   // Must declare variables before use

var host;
exports.init = _host => {
  host = _host;
}


exports.createDevice = base => {
  const logger = base.logger || host.logger;
  var config;


  const setup = _config => {
    config = _config;
  }


  const start = () => {
  }


  const stop = () => {
  }


  const tick = () => {
  }


  return {
    setup, start, stop, tick
  }
}