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
  let zypermp;  // We will store all current Zyper MP data here


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
          params: { Channel: decoder.name, Name: '$string' }
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
          params: { Channel: wall.name, Name: '$string' }
        }
      });
    }
  }

  function start() {
    updateSources();  // Update decoders and video walls with all available sources
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
      if (base.getVar('Status').string === 'Disconnected') {
        base.getVar('Status').string = 'Connected';
        base.getVar('MacAddress').string = response.text.gen.macAddress;
        base.getVar('SerialNumber').string = response.text.gen.serialNumber;
        base.getVar('FirmwareVersion').string = response.text.gen.version;
      }
    })
    .catch(error => {
      base.getVar('Status').string === 'Disconnected';
      logger.error(`tick failed > ${error.message}`);
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
      for (let warning of zyperResponse.warnings) logger.warn(`zyperCmd > ${warning}`);
      if (zyperResponse.errors.length > 0) throw new Error(zyperResponse.errors[0]);
      return zyperResponse;
    }
    catch(error) {
      throw new Error(`zyperCmd failed > ${error.message}`);
    }
  }

  function onFrame(data) {

    if (pendingCommand && pendingCommand.action == 'getDecoderStatus') {
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
        decoder.status = status;  // Store for reference
        if (status.connectedEncoder.mac === 'none') {
          base.getVar(decoder.varname).value = 0;  // Set to 'None', first enum entry
        }
        else {
          base.getVar(decoder.varname).string = status.connectedEncoder.name;
        }
      }
      base.commandDone();
    })
    .catch(error => {
      base.commandError(error.message);
    })
  }

  async function updateSources() {
    try {
      let encoders = await zyperCmd('show device config encoders');
      let decoders = await zyperCmd('show device config decoders');
      let videowalls = await zyperCmd('show video-walls');
      let multiviews = await zyperCmd('show multiviews config');

      encoders = encoders.text;
      decoders = decoders.text;
      videowalls = videowalls.text;
      multiviews = multiviews.text;
      config.multiviews = multiviews;  // Store for later
      config.encoders = encoders;

      // Generate a sorted array for each type of encoder
      let sources = {
        'ZyperUHD': encoders.filter(x => x.gen.model === 'ZyperUHD').map(x => x.gen.name).sort(),
        'Zyper4K': encoders.filter(x => x.gen.model === 'Zyper4K').map(x => x.gen.name).sort(),
        'MV': multiviews.map(x => x.gen.name).sort()
      }

      for (let decoder of config.decoders) {
        let thisvar = base.getVar(decoder.varname);
        decoder.config = decoders.find(x => x.gen.name === decoder.name);
        let temp = ['None'].concat(sources[decoder.config.gen.model]);
        if (decoder.config.gen.model === 'Zyper4K') temp = temp.concat(sources['MV']);
        thisvar.enums = temp;
      }

      for (let wall of config.videowalls) {
        let thisvar = base.getVar(wall.varname);
        wall.config = videowalls.find(x => x.gen.name === wall.name);
        let wallModel = decoders.find(x => x.gen.name === wall.config.decodersRow1.col1).gen.model;
        thisvar.enums = ['None'].concat(sources[wallModel]);
      }
    }
    catch(error) {
      logger.error(`updateSources > ${error.message}`)
    }
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function selectSource(params) {
    let joinmethod, varname;
    let decoder = config.decoders.find(x => x.name === params.Channel);
    let wall = config.videowalls.find(x => x.name === params.Channel);

    // Determine join method based on decoder/videowall, and encoder/multiview as source
    if (decoder) {
      if (config.encoders.find(x => x.gen.name === params.Name)) joinmethod = 'fast-switched';
      else if (config.multiviews.find(x => x.gen.name === params.Name)) joinmethod = 'multiview';
      varname = decoder.varname;
    }
    else if (wall) {
      joinmethod = 'video-wall';
      varname = wall.varname;
    }

    base.commandDefer(CMD_DEFER_TIME);
    zyperCmd(`join ${params.Name} ${params.Channel} ${joinmethod}`)
    .then(response => {
      logger.silly(`selectSource > ${response}`);
      base.commandDone();
      base.getVar(varname).string = params.Name;
    })
    .catch(error => {
      base.commandError(error.message);
    })
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    updateDecoders, updateVideowalls, updateSources,
    selectSource
  };
};