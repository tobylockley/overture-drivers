'use strict';

const TICK_PERIOD = 5000;           // In-built tick interval

let express, app, server, path;


let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;

  // ------------------------------ BASE FUNCTIONS ----------------------------------
  function setup(_config) {
    config = _config;
    logger.debug(`port: ${config.port}`);
    logger.debug(`token: ${config.token}`);
    base.setTickPeriod(TICK_PERIOD);
  }

  function start() {
    logger.debug('Starting');

    path = require('path');
    express = require('express');
    app = express();

    app.get('/', (req, res) => {
      // res.send(`Hello World!<br><br>${config.token}`);
      res.sendFile(path.join(__dirname + '/index.html'));
    });

    if (config.startup) startServer();
  }

  function stop() {
    logger.debug('Stopping');
    stopServer();
  }

  function tick() {
  }

  // ------------------------- IMPLEMENTATION FUNCTIONS -----------------------------
  function setServerState(params) {
    logger.debug(`setServerState: ${params.Status}`);
    // base.getVar('ServerStatus').string = params.Status;
    // DISABLE SERVER HERE
    if (params.Status === 'On') startServer();
    else if (params.Status === 'Off') stopServer();
  }

  function startServer() {
    server = app.listen(config.port, () => {
      logger.info(`Express server app listening on port ${config.port}!`);
      base.getVar('ServerStatus').string = 'On';
    });
  }

  function stopServer() {
    server && server.close();
    logger.info(`Express server on port ${config.port} has been closed!`);
    base.getVar('ServerStatus').string = 'Off';
  }

  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick, setServerState
  };
};