/* global Buffer */

let host;

/*  ADDED BY AVD  */
const TCP_IDLE_TIMEOUT = 30000;          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000;   // How long to wait before attempting to reconnect

const {
  MSG_HEADER,
  GET_DATA,
  SET_DATA
} = require('./constants/protocol.js');
const {
  POWER_STATUS,
  AUDIOMUTE_STATUS,
  NETWORK_STANDBY_STATUS
} = require('./constants/status.js');
const {
  INPUT_SOURCES
} = require('./constants/input_sources.js');
const {
  MODELSPECIES,
  MODELNUMBERS
} = require('./constants/models.js')
const {
  DISPLAY_STATUS_COMMAND,
  MODEL_COMMAND,
  SERIALNUM_COMMAND,
  SW_VERSION_COMMAND,
  POWER_COMMAND,
  AUDIO_VOLUME_COMMAND,
  AUDIO_MUTE_COMMAND,
  INPUT_COMMAND,
  COLOR_COMMAND,
  CONTRAST_COMMAND,
  BRIGHTNESS_COMMAND,
  SHARPNESS_COMMAND,
  TINT_COMMAND,
  DEVICE_NAME_COMMAND,
  MDC_CONNECTION_TYPE_COMMAND,
  MODEL_NAME_COMMAND,
  NETWORK_STANDBY_COMMAND,
} = require('./constants/commands.js');
const {
  RESPONSES,
  makeChecksum,
  validateFrameChecksum,
  isFullFrame,
  frameHasError,
  parseFrameError
} = require('./parser.js')

const TCP_TIMEOUT = 5000

class MDCDevice {

  constructor(_host, base) {
    host = _host;
    this.logger = base.logger || host.logger;

    this.tcpClient = null;
    this.isInPowerOff = false;
    base.setTickPeriod(5000);

    let realSources = base.getVar("Sources").enums;
    let sourcesKeys = Object.keys(INPUT_SOURCES);
    ({
        sources: this.sources,
        sourceNames: this.sourceNames
      } = realSources.filter(name => sourcesKeys.includes(name))
      .reduce((acc, name) => {
        
        let hexValue = INPUT_SOURCES[name];
        acc.sources[name] = hexValue;
        acc.sourceNames[hexValue.toString(16)] = name;

        if (name.startsWith('HDMI'))
          acc.sourceNames[INPUT_SOURCES[name+'-PC'].toString(16)] = name;

        return acc
      }, {
        sources: {},
        sourceNames: {}
      }));
    if (realSources.length != Object.keys(this.sources).length) {
      let supportedSourcesNames = Object.keys(this.sources);
      this.logger.error("Some configuration sources are unsupported: ", realSources.filter(name => !supportedSourcesNames.includes(name)))
    }

    this.speciesNames = Object.keys(MODELSPECIES).reduce((acc, name) => {
      let hexValue = MODELSPECIES[name];
      acc[hexValue.toString(16)] = name;
      return acc;
    }, {})

    this.modelNames = Object.keys(MODELNUMBERS).reduce((acc, name) => {
      let hexValue = MODELNUMBERS[name];
      acc[hexValue.toString(16)] = name;
      return acc;
    }, {})

  }

  //BASE COMMANDS-------------------------------------------------------
  tick() {
    if (!this.tcpClient) this.initTcpClient()  // allow auto-reconnect after Power Off
  }
  //END BASE COMMANDS-----------------------------------------------------------


  setupFrameParser() {
    //BUILD THE FRAME PARSER
    this.frameParser = host.createFrameParser();
    this.frameParser.on('data', (frame) => {
      this.parse(frame);
    })
    this.frameAccum = '';
  }

  connect() {
    this.initTcpClient();
  }

  disconnect() {
    this.base.stopPolling();
    this.base.clearPendingCommands();
    if (this.tcpClient) {
      this.tcpClient.end();  // may need to be before preeceeding commands
      this.tcpClient = null;
    }
  }

  isConnected() {
    return this.tcpClient && this.tcpClient.isConnected() && !!this.base.getVar('Status').value;
  }

  isPoweredOn() {
    return this.isConnected() && !!this.base.getVar('Power').value;
  }

  sendCommand(data) {
    let _sendCommand = () => {
      if (this.tcpClient)
        return this.tcpClient.write(  Buffer.concat([Buffer.from([MSG_HEADER]), data, makeChecksum(data)]) );
      else {
        this.logger.error("TCP Client is not initialized!")
        return false;
      }
    };

    this.logger.silly(`TCPClient send: ${data}`);
    if (this.isConnected()) {
      return _sendCommand();
    } else {
      return false;
    }
  }

  // create a tcp client and handle events
  initTcpClient() {
    if (!this.tcpClient) {
      this.tcpClient = host.createTCPClient()
      this.tcpClient.setOptions({
        receiveTimeout: TCP_IDLE_TIMEOUT,
        autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
      });

      this.tcpClient.on('data', (data) => {
        this.frameParser.push(data.toString('hex'));
      });

      this.tcpClient.on('connect', () => {
        this.logger.debug("TCP Connection Open");
        this.base.getVar('Status').value = 1
        // onConnect && onConnect()
        this.startPoll();
      });

      this.tcpClient.on('close', () => {
        this.logger.debug("TCP Connection Closed");
        this.base.getVar('Status').value = 0;
        // this.disconnect();  // Let the connection try to reconnect by itself
      });

      this.tcpClient.on('error', (err) => {
        this.logger.debug("TCP Connection Error", err);
        this.base.getVar('Status').value = 0;
        this.disconnect();
      });
    }

    if (!this.tcpClient.isConnected()) {
      this.tcpClient.connect(this.config.port, this.config.host);
    // } else {
    //   onConnect && onConnect();
    }
  }

  parse(frame) {
    this.logger.silly(`parsing frame [${this.base.getPendingCommand().action}]: ${frame}`);
    if (!isFullFrame(frame)) {
      this.frameAccum += frame;
      if (isFullFrame(this.frameAccum)) {
        frame = this.frameAccum;
        this.frameAccum = '';
      } else {
        return
      }
    }

    if (parseInt(frame.substr(4, 2), 16) == parseInt(this.config.mdc)) {  // the frame includes this device MDC ID 
      if (validateFrameChecksum(frame)) {
        if (frameHasError(frame)) {
          this.logger.error("Frame has error: ", parseFrameError(frame));
          this.base.commandError("Bad Command");

        } else {
          let currentCommand = parseInt(frame.substr(10,2), 16);
          let matchedResponse = RESPONSES[currentCommand];

          if (matchedResponse) {
            let frameResponse = frame.substring(12);
            matchedResponse.forEach((response, idx) => {

              if (!this.base[response.varname]) {
                this.logger.debug("skipping variable: ", response.varname);
                return
              }

              if (response.proc) {
                response.proc( frame, this.base.getVar(response.varname))
              } else {
                let position = (response.position != undefined ? response.position : idx) * 2;
                let charCount = (response.bytes || 1) * 2;
                let result = frameResponse.substr(position, charCount)
                if (response.select) {
                  if (this[response.select]) {

                    let selected = this[response.select][parseInt(result, 16).toString(16)]
                    if (selected) {
                      this.base.getVar(response.varname).string = selected;
                    } else {
                      this.logger.error("MDC parser error: no match for selection in ", frame)
                      this.base.getVar(response.varname).string = "N/A";
                    }
                  } else {
                    this.logger.error("MDC parser error:   Missing select ", response.select)
                  }
                } else {
                  this.base.getVar(response.varname).value = parseInt(result, (response.base || 16))
                }
              }
            });
            this.base.commandDone();

            if (currentCommand == POWER_COMMAND && !this.base.getVar('Power').value && this.isInPowerOff) {
              this.disconnect()  // disconnect after Power Off, as a new TCP connection will be needed
              this.isInPowerOff = false;
            }

          } else {
            this.logger.error("MDC parser error: No RESPONSES match: ", frame)
            this.base.commandError("Bad Response")
          }
        }
      } else {
        this.base.commandError("Bad Frame")
      }
    }
  }

  //DEVICE COMMANDS-----------------------------------------------------------
  _setCommand(params, command, options={}) {
    let msg = null;

    if (params.Level) {
      let lvl = params.Level;
      if ((!params.min || params.min <= lvl) && (!params.max || params.max >= lvl)) {
        msg = Buffer.from([command, this.config.mdc, SET_DATA, lvl]);
      } else {
        this.base.commandError('Bad Parameters');
        this.base.getVar("Error").value = "Value Out Of Range";
      }
    } else if (params.Name && options.choices && options.choices[params.Name]) {
      msg = Buffer.from([command, this.config.mdc, SET_DATA, options.choices[params.Name]]);
    } else if (params.Status && options.choices && options.choices[params.Status] != undefined) {
      msg = Buffer.from([command, this.config.mdc, SET_DATA, options.choices[params.Status]]);
    } else if (options.errMessage) {
      this.base.commandError('Bad Parameters');
      this.base.getVar("Error").value = options.errMessage;
    }
    if (msg) {
      let deferTimeout = options.deferTimeout ? options.deferTimeout : TCP_TIMEOUT;
      if (this.sendCommand(msg)) {
        this.base.commandDefer(deferTimeout);
      } else this.base.commandError('Not Sent');
    } else {
      this.base.commandError('Not Sent');
    }
  }

  setPower(params) {
    if (params.Status == 'Off') this.isInPowerOff = true;
    this._setCommand(params, POWER_COMMAND, {choices:POWER_STATUS})
  }
  setAudioMute(params) {
    this._setCommand(params, AUDIO_MUTE_COMMAND, {choices:AUDIOMUTE_STATUS})
  }
  setNetworkStandby(params) {
    this._setCommand(params, NETWORK_STANDBY_COMMAND, {choices:NETWORK_STANDBY_STATUS})
  }
  setAudioLevel(params) {
    this._setCommand(params, AUDIO_VOLUME_COMMAND, {min: 0, max: 100})
  }
  setColor(params) {
    this._setCommand(params, COLOR_COMMAND, {min: 0, max: 100})
  }
  setContrast(params) {
    this._setCommand(params, CONTRAST_COMMAND, {min: 0, max: 100})
  }
  setBrightness(params) {
    this._setCommand(params, BRIGHTNESS_COMMAND, {min: 0, max: 100})
  }
  setSharpness(params) {
    this._setCommand(params, SHARPNESS_COMMAND, {min:0, max: 100})
  }
  setTint(params) {
    this._setCommand(params, TINT_COMMAND, {min:0, max: 100})
  }
  selectSource(params) {
    this._setCommand(params, INPUT_COMMAND, {choices:this.sources, errMessage: "Unknown Source"})
  }
  //END DEVICE COMMANDS------------------------------------------------

  //POLL COMMANDS--------------------------------------------
  _getCommand(command, timeout = TCP_TIMEOUT) {
    let msg = Buffer.from([command, this.config.mdc, GET_DATA]);
    if (this.sendCommand(msg)) this.base.commandDefer(timeout);
    else this.base.commandError('Not Sent');
  }
  getDeviceName() {
    this._getCommand(DEVICE_NAME_COMMAND)
  }
  getModel() {
    this._getCommand(MODEL_COMMAND)
  }
  getModelName() {
    this._getCommand(MODEL_NAME_COMMAND)
  }
  getSerial() {
    this._getCommand(SERIALNUM_COMMAND)
  }
  getSWVersion() {
    this._getCommand(SW_VERSION_COMMAND)
  }
  getPower() {
    this._getCommand(POWER_COMMAND)
  }
  getAudioMute() {
    this._getCommand(AUDIO_MUTE_COMMAND)
  }
  getNetworkStandby() {
    this._getCommand(NETWORK_STANDBY_COMMAND)
  }
  getAudioLevel() {
    this._getCommand(AUDIO_VOLUME_COMMAND)
  }
  getSource() {
    this._getCommand(INPUT_COMMAND)
  }
  getColor() {
    this._getCommand(COLOR_COMMAND)
  }
  getContrast() {
    this._getCommand(CONTRAST_COMMAND)
  }
  getBrightness() {
    this._getCommand(BRIGHTNESS_COMMAND)
  }
  getSharpness() {
    this._getCommand(SHARPNESS_COMMAND)
  }
  getTint() {
    this._getCommand(TINT_COMMAND)
  }
  getDisplayStatus() {
    this._getCommand(DISPLAY_STATUS_COMMAND)
  }
  getMDCConnectionType() {
    this._getCommand(MDC_CONNECTION_TYPE_COMMAND)
  }
  //END POLL COMMANDS----------------------------------------
}

exports.MDCDevice = MDCDevice;