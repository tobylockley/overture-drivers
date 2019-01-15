'use strict';

const HUE_TIMEOUT = 10000;
const UPDATE_TIME = 500;
const RECONNECT_TIME = 5000;


let host;
exports.init = _host => {
  host = _host;
};


exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let huejay;
  let hueClient;
  let initialised = false;
  let mySensors = {};  // Store config info, as well as last sensor state and update timestamp

  const isConnected = () => { return base.getVar('Status').string === 'Connected'; };
  const isNotConnected = () => { return base.getVar('Status').string === 'Disconnected'; };

  const setup = _config => {
    config = _config;

    config.sensors.forEach(sensor => {
      let id = sensor.identifier.toString();
      mySensors[id] = {};  // Initialise
      mySensors[id].type = sensor.type;
      mySensors[id].name = sensor.name;
      // Create variables dynamically
      if (sensor.type === 'Motion Sensor') {
        base.createEnumVariable(sensor.name, ['Off', 'On']);
      }
      else if (sensor.type === 'Dimmer Switch') {
        base.createVariable({
          name: sensor.name,
          type: 'enum',
          enums: [
            'Idle',
            '1_ShortPress',
            '1_LongPress',
            '1_Hold',
            '2_ShortPress',
            '2_LongPress',
            '2_Hold',
            '3_ShortPress',
            '3_LongPress',
            '3_Hold',
            '4_ShortPress',
            '4_LongPress',
            '4_Hold'
          ]
        });
      }
    });

    // Get all sensor info in one operation
    base.setPoll({
      action: 'getAllSensors',
      period: UPDATE_TIME,
      enablePollFn: isConnected
    });

    // Ping bridge periodically when disconnected
    base.setPoll({
      action: 'checkConnection',
      period: RECONNECT_TIME,
      enablePollFn: isNotConnected,
      startImmediately: true
    });
  };


  const start = () => {
    huejay = require('huejay');
    hueClient = new huejay.Client({
      host: config.host,
      username: config.username,
      timeout: HUE_TIMEOUT
    });
    base.startPolling();
  };


  const stop = () => {
    disconnect();
  };


  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected';
  };


  const checkConnection = () => {
    hueClient.bridge.ping()
      .then(() => {
        base.getVar('Status').string = 'Connected';
      })
      .catch(error => {
        logger.error(`checkConnection: ${error}`);
        disconnect();
      });
  };


  const getAllSensors = () => {
    base.commandDefer(HUE_TIMEOUT + 1000);
    hueClient.sensors.getAll()
      .then(sensors => {
        base.commandDone();
        for (let sensor of sensors) {
        // Does sensor id corresponds with a configured sensor?
          if (mySensors.hasOwnProperty(sensor.id)) {
            if (!initialised) {
              logger.debug(`First run... Updating [${mySensors[sensor.id].name}] lastUpdated timestamp to: ${sensor.state.lastUpdated}`);
              mySensors[sensor.id].state = sensor.state;  // Initialise on first run
            }
            else {
              if (mySensors[sensor.id].type === 'Dimmer Switch') updateSwitch(sensor);
              else if (mySensors[sensor.id].type === 'Motion Sensor') updateMotion(sensor);
            }
          }
        }
        initialised = true;
      })
      .catch(error => {
        base.commandError(`getAllSensors: ${error.stack}`);
        disconnect();
        throw error;
      });
  };


  const updateSwitch = data => {
    /*Button	Action
      1xxx    Button 1 (ON)
      2xxx    Button 2 (DIM UP)
      3xxx    Button 3 (DIM DOWN)
      4xxx    Button 4 (OFF)

      x000	  INITIAL_PRESS
      x001	  HOLD
      x002	  SHORT_RELEASED
      x003	  LONG_RELEASED

      Overture enums (repeated for buttons n = 1-4):
        'Idle',
        'n_ShortPress',
        'n_LongPress',
        'n_Hold'
    */
    let currState = data.state;
    let lastState = mySensors[data.id].state;
    if (currState.lastUpdated != lastState.lastUpdated || currState.buttonEvent != lastState.buttonEvent) {
      let button_num = parseInt(currState.buttonEvent / 1000);  // parseInt removes decimal part
      let event_num = currState.buttonEvent % 1000;
      let event_names = [
        'InitialPress',  // This is ignored, only change var for other events
        'Hold',
        'ShortPress',
        'LongPress'
      ];
      if (event_num > 0) {
        let event = `${button_num}_${event_names[event_num]}`;
        logger.silly(`Switch event (${mySensors[data.id].name}): ${event}`);
        base.getVar(mySensors[data.id].name).string = event;
        // Clear button timeout if it exists, then set a fresh timeout
        mySensors[data.id].timeoutfn && clearTimeout(mySensors[data.id].timeoutfn);
        mySensors[data.id].timeoutfn = setTimeout( () => {
          base.getVar(mySensors[data.id].name).string = 'Idle';
        }, config.button_timeout);
      }
      mySensors[data.id].state = currState;
    }
  };


  // Update the overture variable based on recent sensor data
  const updateMotion = data => {
    let thisVar = base.getVar(mySensors[data.id].name);
    if (data.state.presence != mySensors[data.id].state.presence) {
      thisVar.value = data.state.presence ? 1 : 0;  // Convert true/false to 1/0
    }
    mySensors[data.id].state = data.state;
  };


  return {
    setup, start, stop,
    checkConnection, getAllSensors
  };
};
