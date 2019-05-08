'use strict';

const CMD_DEFER_TIME = 3000;        // Timeout when using commandDefer
const TICK_PERIOD = 5000;           // In-built tick interval
const POLL_PERIOD_FAST = 5000;      // Continuous polling function interval
const POLL_PERIOD_SLOW = 30000;     // Continuous polling function interval, for less frequent tasks like updating source list
const REQUEST_TIMEOUT = 2000;       // Timeout for AJAX requests

const VWALL_NAMING_TEMPLATE = 'VW_<vw_name>_<enc_name>';  // Change this to alter the appearance in overture source list
const MVIEW_NAMING_TEMPLATE = 'MV_<mv_name>';  // Change this to alter the appearance in overture source list

let host;
exports.init = _host => {
  host = _host;
};

exports.createDevice = base => {
  const logger = base.logger || host.logger;
  let config;
  let tcpClient;

  // Array variables to store all MP data
  let device_config = [];
  let multiviews = [];
  let videowalls = [];
  let decoder_status = [];

  let frameParser = host.createFrameParser();
  frameParser.setSeparator('Zyper$');
  frameParser.on('data', data => onFrame(data));


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected'; }

  function setup(_config) {
    config = _config;
    base.setTickPeriod(TICK_PERIOD);

    // Polling functions needed to update source list, not needed as frequently
    // base.setPoll({ action: 'getDeviceConfig', period: POLL_PERIOD_SLOW, enablePollFn: isConnected, startImmediately: true });
    // base.setPoll({ action: 'getMultiviews', period: POLL_PERIOD_SLOW, enablePollFn: isConnected, startImmediately: true });
    // base.setPoll({ action: 'getVideowalls', period: POLL_PERIOD_SLOW, enablePollFn: isConnected, startImmediately: true });
    // base.setPoll({ action: 'updateSources', period: POLL_PERIOD_SLOW, enablePollFn: isConnected, startImmediately: true });

    // Register fast polling functions, like retrieving current source
    base.setPoll({ action: 'updateDecoders', period: POLL_PERIOD_FAST, enablePollFn: isConnected, startImmediately: true });

    // Initialise variables for each decoder
    for (let decoder of config.decoders) {
      decoder.varname = `Sources_${decoder.name.replace(/[^A-Za-z0-9]/g, '')}`;  // Make legal variable name
      base.createVariable({
        name: decoder.varname,
        type: 'enum',
        enums: ['None'],
        perform: {
          action: 'selectSource',
          params: { Channel: decoder.name, Name: '$string', Index: '$value' }
        }
      });
    }

    // Initialise variables for each video wall
    for (let wall of config.videowalls) {
      wall.varname = `Sources_VideoWall_${wall.name.replace(/[^A-Za-z0-9]/g, '')}`;  // Make legal variable name
      base.createVariable({
        name: wall.varname,
        type: 'enum',
        enums: ['None'],
        perform: {
          action: 'selectSource',
          params: { Channel: wall.name, Name: '$string', Index: '$value' }
        }
      });
    }
  }

  function start() {
    base.startPolling();
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected';
    base.stopPolling();
    base.clearPendingCommands();
  }

  function tick() {
    zyperCmd('show server info')
      .then(response => {
        if (isConnected() === false) {
          base.getVar('Status').string = 'Connected';
          base.getVar('MacAddress').string = response.text.gen.macAddress;
          base.getVar('SerialNumber').string = response.text.gen.serialNumber;
          base.getVar('FirmwareVersion').string = response.text.gen.version;
        }
      })
      .catch(error => {
        logger.error(`tick failed > ${error.message}`)
      })
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  async function zyperCmd(cmdString) {
    try {
      const options = {
        method: 'POST',
        uri: `http://${config.host}/rcCmd.php`,
        timeout: REQUEST_TIMEOUT,
        form: {
          commands: cmdString
        }
      };
      let response = await host.request(options);
      response = JSON.parse(response);
      let zyperResponse = response.responses[0];
      if (zyperResponse.warnings.length > 0) logger.warn(`zyperCmd > ${zyperResponse.warnings[0]}`);
      if (zyperResponse.errors.length > 0) throw new Error(zyperResponse.errors[0]);
      return zyperResponse;
    }
    catch(error) {
      throw new Error(`zyperCmd failed > ${error.message}`);
    }
  }

  function onFrame(data) {
    // logger.silly(`onFrame: ${data}`);

    const pendingCommand = base.getPendingCommand();
    pendingCommand && logger.debug(`pendingCommand: ${pendingCommand.action}`);

    if (pendingCommand && pendingCommand.action == 'getDeviceConfig') {
      device_config = importZyperData(data);
      base.commandDone();
    }
    else if (pendingCommand && pendingCommand.action == 'getMultiviews') {
      multiviews = importZyperData(data);
      base.commandDone();
    }
    else if (pendingCommand && pendingCommand.action == 'getVideowalls') {
      videowalls = importZyperData(data);
      base.commandDone();
    }
    else if (pendingCommand && pendingCommand.action == 'getDecoderStatus') {
      decoder_status = importZyperData(data);
      if (decoder_status.length == 0) {
        logger.error('No decoder status information available. Check connection to Zyper MP.');
        return;
      }

      // Decipher status and update current sources
      config.decoders.forEach( decoder => {
        // decoder.model
        // decoder.name
        // decoder.varname
        let this_status = decoder_status.filter(device => device.gen.name == decoder.name);
        if (this_status.length != 1) {
          logger.error(`onFrame/getDecoderStatus: Retrieving device status for ${decoder.name} failed. Possible duplicate device names, or incorrect name.`);
          return;
        }
        this_status = this_status[0];  // Should be only 1 entry, no need to store in an array

        // Retrieve this decoders source list from overture enum
        let this_sources = base.getVar(decoder.varname).enums;

        // Is decoder showing a video wall?
        if (this_status.activeVideoWall.name == 'none') {
          if (this_status.connectedEncoder.mac == 'none') {
            // DECODER HAS NO SOURCE ATTACHED
            base.getVar(decoder.varname).string = 'None';
          }
          else if (this_status.connectedEncoder.mac == 'multiview') {
            // MULTIVIEW
            let mv_sourcename = MVIEW_NAMING_TEMPLATE.replace('<mv_name>', this_status.connectedEncoder.name);
            let result = this_sources.filter(source => source == mv_sourcename);
            if (result.length == 1) {
              // multiview found in source list, set current source
              base.getVar(decoder.varname).string = result[0];
            }
            else {
              logger.error(`onFrame/getDecoderStatus: Multiview '${this_status.connectedEncoder.name}' not found in source list for ${decoder.name}`);
            }
          }
          else {
            // REGULAR ENCODER
            let result = this_sources.filter(source => source == this_status.connectedEncoder.name);
            if (result.length == 1) {
              // encoder found in source list, set current source
              base.getVar(decoder.varname).string = result[0];
            }
            else {
              logger.error(`onFrame/getDecoderStatus: Encoder '${this_status.connectedEncoder.name}' not found in source list for ${decoder.name}`);
            }
          }
        }
        else {
          // VIDEOWALL - search source list for videowall name and connected encoder  `VW_${vw_name}_${encoder}`
          let vw_sourcename = VWALL_NAMING_TEMPLATE.replace('<vw_name>', this_status.activeVideoWall.name).replace('<enc_name>', this_status.connectedEncoder.name);
          let result = this_sources.filter(source => source == vw_sourcename);
          if (result.length == 1) {
            // encoder found in source list, set current source
            base.getVar(decoder.varname).string = result[0];
          }
          else {
            logger.error(`onFrame/getDecoderStatus: Videowall source '${vw_sourcename}' not found in source list for ${decoder.name}`);
          }
        }
      });
      base.commandDone();
    }
    else if (pendingCommand && pendingCommand.action == 'selectSource') {
      if (data.includes('Success')) base.commandDone();
      else base.commandError(`onFrame/selectSource: Unexpected response: ${data}`);

      // Print warning to logs
      let match = data.match(/Warning.*(?=[\r\n])/);
      match && logger.error(`selectSource[${pendingCommand.params.Channel}]: ${match[0]}`);
    }

  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function updateDecoders() {
    base.commandDefer(CMD_DEFER_TIME);
    zyperCmd('show device status decoders')
      .then(response => {

        // Process each decoder in response
        for (let status of response.text) {
          let decoder = config.decoders.find(x => x.name === status.gen.name);
          decoder.status = status;
          if (status.connectedEncoder.mac === 'none') {
            base.getVar(decoder.varname).value = 0;
          }
          else if (status.connectedEncoder.mac === 'multiview') {
            // Do something with multiview
            logger.warn('multiview not implemented yet')
            // let mv_sourcename = MVIEW_NAMING_TEMPLATE.replace('<mv_name>', this_status.connectedEncoder.name);
            // let result = this_sources.filter(source => source == mv_sourcename);
          }
          else {
            base.getVar(decoder.varname).string = status.connectedEncoder.name;
          }
        }




        // Decipher status and update current sources
        if (false) {
          let decoder
          // decoder.model
          // decoder.name
          // decoder.varname
          let this_status = decoder_status.filter(device => device.gen.name == decoder.name);
          if (this_status.length != 1) {
            logger.error(`onFrame/getDecoderStatus: Retrieving device status for ${decoder.name} failed. Possible duplicate device names, or incorrect name.`);
            return;
          }
          this_status = this_status[0];  // Should be only 1 entry, no need to store in an array

          // Retrieve this decoders source list from overture enum
          let this_sources = base.getVar(decoder.varname).enums;

          // Is decoder showing a video wall?
          if (this_status.activeVideoWall.name == 'none') {
            if (this_status.connectedEncoder.mac == 'none') {
              // DECODER HAS NO SOURCE ATTACHED
              base.getVar(decoder.varname).string = 'None';
            }
            else if (this_status.connectedEncoder.mac == 'multiview') {
              // MULTIVIEW
              let mv_sourcename = MVIEW_NAMING_TEMPLATE.replace('<mv_name>', this_status.connectedEncoder.name);
              let result = this_sources.filter(source => source == mv_sourcename);
              if (result.length == 1) {
                // multiview found in source list, set current source
                base.getVar(decoder.varname).string = result[0];
              }
              else {
                logger.error(`onFrame/getDecoderStatus: Multiview '${this_status.connectedEncoder.name}' not found in source list for ${decoder.name}`);
              }
            }
            else {
              // REGULAR ENCODER
              let result = this_sources.filter(source => source == this_status.connectedEncoder.name);
              if (result.length == 1) {
                // encoder found in source list, set current source
                base.getVar(decoder.varname).string = result[0];
              }
              else {
                logger.error(`onFrame/getDecoderStatus: Encoder '${this_status.connectedEncoder.name}' not found in source list for ${decoder.name}`);
              }
            }
          }
          else {
            // VIDEOWALL - search source list for videowall name and connected encoder  `VW_${vw_name}_${encoder}`
            let vw_sourcename = VWALL_NAMING_TEMPLATE.replace('<vw_name>', this_status.activeVideoWall.name).replace('<enc_name>', this_status.connectedEncoder.name);
            let result = this_sources.filter(source => source == vw_sourcename);
            if (result.length == 1) {
              // encoder found in source list, set current source
              base.getVar(decoder.varname).string = result[0];
            }
            else {
              logger.error(`onFrame/getDecoderStatus: Videowall source '${vw_sourcename}' not found in source list for ${decoder.name}`);
            }
          }
        }

        base.commandDone();
      })
      .catch(error => {
        base.commandError(error.message);
      })
  }

  function getDeviceConfig() {
    sendDefer('show device config all\n');
  }

  function getMultiviews() {
    sendDefer('show multiviews config\n');
  }

  function updateVideowalls() {
    sendDefer('show video-walls\n');
  }

  function updateSources() {
    if (device_config.length == 0 || multiviews.length == 0 || videowalls.length == 0) {
      logger.error('Not all config data has been retrieved. Check connection to Zyper MP.');
      return;
    }

    // Uses imported data to update overture enum lists
    config.decoders.forEach( decoder => {
      let temp_encoders = [];  // To store encoders, for building video wall sources
      let temp_sources = ['None'];  // To build list of sources
      let temp_join_commands = [`join none ${decoder.name} fast-switched\n`];  // To build list of join commands that match sources

      // STEP 1: Find decoder model
      let this_config = device_config.filter(device => device.gen.name == decoder.name);
      if (this_config.length != 1) {
        logger.error(`updateSources: Retrieving device config for ${decoder.name} failed. Possible duplicate device names, or incorrect name.`);
        return;
      }
      decoder.model = this_config[0].gen.model;

      // STEP 2: Add all encoders of same type to sources
      let encoder_config = device_config.filter(device => (device.gen.model == decoder.model) && (device.gen.type == 'encoder'));
      if (encoder_config.length == 0) {
        logger.error(`updateSources: Could not find any ${decoder.model} encoders.`);
      }
      else {
        for (let i = 0; i < encoder_config.length; i++) {
          temp_encoders.push(encoder_config[i].gen.name);  // Will use these below when building video wall sources
          temp_sources.push(encoder_config[i].gen.name);
          temp_join_commands.push(`join ${encoder_config[i].gen.name} ${decoder.name} fast-switched\n`);
        }
      }

      // STEP 3: Add all multiviews to sources (Zyper4K ONLY)
      if (decoder.model == 'Zyper4K') {
        for (let i = 0; i < multiviews.length; i++) {
          let mv_sourcename = MVIEW_NAMING_TEMPLATE.replace('<mv_name>', multiviews[i].id);
          temp_sources.push(mv_sourcename);
          temp_join_commands.push(`join ${multiviews[i].id} ${decoder.name} multiview\n`);
        }
      }

      // STEP 4: Add all videowalls which use this decoder to sources, with each encoder as an option
      for (let i = 0; i < videowalls.length; i++) {
        const vw = videowalls[i];
        let decoder_match = false;

        // Search each decoder of the video wall for a match
        for (let row of Object.keys(vw).filter(key => key.includes('decodersRow'))) {
          for (let col in vw[row]) {
            if (vw[row][col] == decoder.name) decoder_match = true;
          }
        }

        // If we found this decoder in the video wall, add an entry to sources for each encoder (using array from step 2)
        if (decoder_match) {
          for (let j = 0; j < temp_encoders.length; j++) {
            let vw_sourcename = VWALL_NAMING_TEMPLATE.replace('<vw_name>', vw.id).replace('<enc_name>', temp_encoders[j]);
            temp_sources.push(vw_sourcename);
            temp_join_commands.push(`join ${temp_encoders[j]} ${vw.id} video-wall\n`);
          }
        }
      }

      // STEP 5: If sources have changed, replace overture sources enum with our temp array, and store join commands in config object
      let current_sources = base.getVar(decoder.varname).enums;
      if (!arraysMatch(current_sources, temp_sources)) {
        base.getVar(decoder.varname).enums = temp_sources;
        decoder.join_commands = temp_join_commands;
        logger.debug(`updateSources: Updated sources for ${decoder.name}`);
      }
    });
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function selectSource(params) {
    let join_command = config.decoders.filter(decoder => decoder.name == params.Channel)[0].join_commands[params.Index];
    sendDefer(join_command);
    // logger.debug(`selectSource: ${params.Channel} = ${params.Name}. Index = ${params.Index}`);
    // logger.debug(`selectSource join command: ${join_command}`);
  }


  // ----------------------------- HELPER FUNCTIONS ----------------------------

  function importZyperData(data) {
    // Accepts a chunk of data from zyper MP, e.g. "show device config all"
    // Separates each entry, and returns an array of all entries

    let imported = [];  // Store all imported data here
    let match_block, match_line;  // Variables for regex processing

    // Narrow down to each "block" of data, a single device
    let regex_block = /.+?\((.+?)\);\r\n((?:\s{2}.+?\r\n)+)/g;
    while ((match_block = regex_block.exec(data)) != null) {
      let temp = {};  // Store all key/value pairs in here
      temp.id = match_block[1];  // Device id (usually mac address)
      let block = match_block[2];

      // Process each line of block, saving each variable
      let regex_line = /\s{2}.+?\.(.+?); (.*?)\r\n/gm;
      while ((match_line = regex_line.exec(block)) != null) {
        let category = match_line[1];

        // Catch edge case for usbDownLinks showing '[none]'
        if (match_line[2] == '[none]') {
          temp[category] = 'none';
        }
        else {
          temp[category] = temp[category] || {};  // If category key doesn't exist, init with empty object
          let vals = match_line[2].split(/, /);  // Split  into 'key=value' chunks
          vals.forEach( val => {
            let val_split;
            if (category.includes('VideoWall') && !val.includes('=')) {  // Special case, was causing errors
              val_split = val.split(/ /);
            }
            else {
              val_split = val.split(/=/);
            }
            if (val_split.length == 2) {
              if (val_split[1].charAt(val_split[1].length - 1) == ';') {
                // If 'value' ends in semi-colon, remove the semi-colon (can appear at end of lines sometimes)
                val_split[1] = val_split[1].slice(0, -1);
              }
              temp[category][val_split[0]] = val_split[1];
            }
            else {
              logger.error(`importZyperData: Unexpected data format. Expected: key=value, Received: ${match_line[2]}`);
            }
          });
        }

      }

      imported.push(temp);  // Add this device to the array
    }

    return imported;
  }

  function arraysMatch(arr1, arr2) {
    // This only works for simple arrays containing simple objects like strings or integers
    if (arr1.length != arr2.length) return false;
    let arrays_match = true;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] != arr2[i]) arrays_match = false;
    }
    return arrays_match;
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    updateDecoders, updateVideowalls, updateSources,
    selectSource
  };
};