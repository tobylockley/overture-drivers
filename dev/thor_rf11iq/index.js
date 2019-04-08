'use strict';

let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let request = host.request;
  let parseXml = require('xml2js').parseString;


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function setup(_config) {
    config = _config;
    base.setTickPeriod(config.polling_interval);

    // Set default request headers
    let auth = 'Basic ' + new Buffer(config.username + ':' + config.password).toString('base64');
    request = request.defaults({
      headers: {'Authorization': auth}
    });
  }

  function start() {
  }

  function tick() {
    getStatus();
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected';
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getStatus() {
    request(`http://${config.host}/status.xml`)
      .then( function (response) {
        if (response) {
          base.getVar('Status').string = 'Connected';
          parseXml(response, {'explicitArray': false}, function (err, result) {
            for (let key in result.response) {
              updateValue(key, result.response[key]);
            }
            logger.silly('getStatus success:', result.response);
          });
        }
      })
      .catch( function(err) {
        // process errors here
        logger.error(err);
        base.getVar('Status').string = 'Disconnected';
      });
  }

  function updateValue(key, value) {
    // Update overture variables based on the xml key/value
    let var_map = {
      's1': 'Status_Sockets',
      's2': 'Status_IEC',
      'bz': 'Status_Alarm',
      'b1': 'Buzzer_Enable_Sockets',
      'b2': 'Buzzer_Enable_IEC',
      'p1': 'Power_1',
      'p2': 'Power_2',
      'p3': 'Power_3',
      'p4': 'Power_4',
      'p5': 'Power_5',
      'p6': 'Power_6',
      'p7': 'Power_7',
      'p8': 'Power_IEC',
      'c1': 'Current_1',
      'c2': 'Current_2',
      'c3': 'Current_3',
      'c4': 'Current_4',
      'c5': 'Current_5',
      'c6': 'Current_6',
      'c7': 'Current_7',
      'c8': 'Current_IEC'
    };
    let var_name = var_map[key];
    if (var_name) base.getVar(var_name).value = Number(value);
  }


  // ------------------------------ SET FUNCTIONS ------------------------------
  function setValue(params) {
    request(`http://${config.host}/cpan.cgi?param=${params.Channel}&value=${params.Status}`)
      .then( function (response) {
        if (response) {
          logger.silly(`setValue response: ${response}`);
        }
      })
      .catch( function(err) {
        // process errors here
        logger.error(err);
      });
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getStatus,
    setValue
  };
};