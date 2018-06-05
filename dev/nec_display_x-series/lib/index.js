/* global Buffer */

let host
let _

const TCP_TIMEOUT = 5000
const CMD_TIMEOUT = 600

const FRAME_SEPARATOR = String.fromCharCode(0x0D)
const NULL = 'BE'
// Header
const SOH = String.fromCharCode(0x01)
const RESERVED = '0'
const DESTINATION = '*'
const BARCO_NODE = '0'
const STX = String.fromCharCode(0x02)
const ETX = String.fromCharCode(0x03)
const MSG_TYPE = {
  CMD: 'A',
  CMD_RPL: 'B',
  GET: 'C',
  GET_RPL: 'D',
  SET: 'E',
  SET_RPL: 'F'
}

const FRAME_ERROR = STX + NULL + ETX

// Commands
const POWER_SET = 'C203D6' 
const POWER_GET = '01D6'
const AUDIO_MUTE = '008D'
const AUDIO_LEVEL = '0062'
const SOURCE = '0060'
const TEMP_SENSOR = '0078'
const TEMPERATURE = '0279'
const BRIGHTNESS = '0010'
const CONTRAST = '0012'

const HANDLERS = {
  [POWER_SET.slice(2,4)]: "power",
  [POWER_GET.slice(-2)]: "power",
  [AUDIO_MUTE.slice(-2)]: "audioMute",
  [AUDIO_LEVEL.slice(-2)]: "audioLevel",
  [TEMP_SENSOR.slice(-2)]: "tempSensor",  
  [TEMPERATURE.slice(-2)]: "temperature",
  [BRIGHTNESS.slice(-2)]: "brightness",
  [CONTRAST.slice(-2)]: "contrast",
  [SOURCE.slice(-2)]: "source"
}

// Base Class 
class XDevice {
  constructor(_host, base) {
    host = _host
    _ = host.lodash
    this.base = base
    this.logger = base.logger || host.logger

    this.setupFrameParser()
  }

  // UTIL COMMANDS

  connect() {
    this.initTcpClient()
    this.base.commandDefer(TCP_TIMEOUT)
  }

  disconnect() {
    this.cleanup()
    if (this.tcpClient) {
      this.tcpClient.end() 
      this.tcpClient = null
    }
  }

  cleanup() {
    this.base.stopPolling()
    this.base.clearPendingCommands()
  }

  setupFrameParser() {
    this.frameParser = host.createFrameParser();
    this.frameParser.setSeparator(FRAME_SEPARATOR);
    this.frameParser.on('data', (frame) => this.parse(frame))
    this.frameAccum = ''  
  }

  initTcpClient() {
    if (!this.tcpClient) {
      this.logger.debug("TCP Client Created.")
      this.tcpClient = host.createTCPClient()
      this.tcpClient
        .on('data', (data) => {
          this.logger.debug("INCOMING DATA --------------", data.toString())
          this.frameParser.push(data.toString())
        })
        .on('connect', () => {
          this.logger.debug("TCP Connection Open")
          this.base.getVar('Status').value = 1
          this.base.getPendingCommand() && this.base.commandDone()
          this.startPoll()
        })
        .on('close', () => {
          this.logger.debug("TCP Connection Closed")
          this.base.getVar('Status').value = 0
          this.cleanup()
        })
        .on('error', (err) => {
          this.logger.debug("TCP Connection Error", err)
          this.base.getVar('Status').value = 0
          this.cleanup()
        })
    }

    this.tcpClient.isConnected()
      || this.tcpClient.connect(this.config.port, this.config.host)

  }

  parse(frame) {
    if (!this.isFullFrame(frame)) {
      this.frameAccum += frame
      if (this.isFullFrame(this.frameAccum))
        frame = this.frameAccum
      else {
        if (!this.frameHasHeader(this.frameAccum)) this.frameAccum = ''
        return
      }
    }
    this.frameAccum = ''

    this.logger.debug('FRAME:', frame)

    const msg = frame.slice(frame.indexOf(STX), frame.indexOf(ETX) + 1)

    const msgError = !msg.slice(3,5) === '00'
    const cmdCode = msg.slice(5,-5)

    const modeCode = cmdCode.slice(0,2)
    const cmdStatus = msg.slice(-5, -1)

    let state = {
      error: false,
      loggerMsg: "",
      baseMsg: "",
      param: frame
    }

    if (msg === FRAME_ERROR) {
      state.error = true
      state.loggerMsg = "An unknown error occured"
      state.baseMsg = "An unknown error occured"    
    
    } else {
      if (msgError) {
        state.error = true
        state.loggerMsg = "Unsupported operation with this monitor"
        state.baseMsg = "Unsupported operation with this monitor"
  
      } else {
        this.logger.debug('MODE_CODE', modeCode)
        const cmdName = HANDLERS[modeCode]
        const handlerName = `${cmdName}Handler`

        this.logger.debug('HANDLERNAME:',handlerName)

        if (!this[handlerName]) {
          state.error = true
          state.loggerMsg = `Missing Handler for Command ${cmdName}`
          state.baseMsg = "Missing Handler"
  
        } else this[handlerName](cmdStatus)       
      }
    }

    // Closing in on commandDefer() window
    if (state.error) {
      this.logger.error(state.loggerMsg, state.param)
      setTimeout(() => this.base.commandError(state.baseMsg), CMD_TIMEOUT)
    } else {
      this.base.getPendingCommand()
        ? setTimeout(() => this.base.commandDone(), CMD_TIMEOUT)
        : this.logger.warn("Frame received without pending command: ", frame) 
    }
  }

  sendCommand(type, len, cmd, params=[]) {
    const block = RESERVED + DESTINATION + BARCO_NODE + type + len + STX + cmd + params + ETX
    const msg = SOH + block + this.checksum(block) + FRAME_SEPARATOR

    console.log('MSG:', Buffer.from(msg))

    if (this.tcpClient.write(Buffer.from(msg))) {
      this.base.commandDefer(TCP_TIMEOUT)
    } else {
      this.logger.error("Error while executing command, TCP client failed", msg)
      this.base.commandError('Command Not Sent')
    }
  }

  // END BASE COMMANDS----------------------------------------

  // DEVICE COMMANDS-----------------------------------------------------------

  // Power
  getPower() {
    this.logger.debug('GET_POWER')
    this.sendCommand(MSG_TYPE.CMD, '06', POWER_GET)
    //this.sendCommand('A0601D6')
  }

  setPower({ Status }) {
    this.logger.debug('SET_POWER:', Status)
    
    const param = Number(Status === 'On') ? '0001' : '0004'
    this.sendCommand(MSG_TYPE.CMD, '0C', POWER_SET, param)
  }

  powerHandler(data) {
    this.logger.debug('POWER_HANDLER', data)
    this.base.getVar('Power').value = Number(data === '0001')
  }

  // Audio Mute
  getAudioMute() {
    this.sendCommand(MSG_TYPE.GET, '06', AUDIO_MUTE)
  }

  setAudioMute({ Status }) {
    const param =  Number(Status === 'On') ? '0001' : '0002'
    this.sendCommand(MSG_TYPE.SET, '0A', AUDIO_MUTE, param)
  }

  audioMuteHandler(data) {
    this.logger.debug('AUDIO_MUTE:', data === '0001')
    this.base.getVar('AudioMute').value = Number(data === '0001')
  }

  // Audio Level
  getAudioLevel() {
    this.sendCommand(MSG_TYPE.GET, '06', AUDIO_LEVEL)
  }

  setAudioLevel({ Level }) {
    const param = this.pad(Level)
    this.logger.debug('SEND AUDIO_LEVEL', param)
    this.sendCommand(MSG_TYPE.SET, '0A', AUDIO_LEVEL, param)
  }

  audioLevelHandler(data) {
    this.logger.debug('RECEIVED AUDIO_LEVEL:', data)
    this.base.getVar('AudioLevel').value = this.getIntFromStringHex(data)
  }

  // Brightness
  getBrightness() {
    this.sendCommand(MSG_TYPE.GET, '06', BRIGHTNESS)
  }

  setBrightness({ Level }) {
    const param = this.pad(Level)
    this.logger.debug('SEND BRIGHTNESS', param)
    this.sendCommand(MSG_TYPE.SET, '0A', BRIGHTNESS, param)
  }

  brightnessHandler(data) {
    this.logger.debug('RECEIVED BRIGHTNESS:', data)
    this.base.getVar('Brightness').value = this.getIntFromStringHex(data)
  }

  // Contrast
  getContrast() {
    this.sendCommand(MSG_TYPE.GET, '06', CONTRAST)
  }

  setContrast({ Level }) {
    const param = this.pad(Level)
    this.logger.debug('SEND CONTRAST:', param)
    this.sendCommand(MSG_TYPE.SET, '0A', CONTRAST, param)
  }

  contrastHandler(data) {
    this.logger.debug('RECEIVED CONTRAST:', data)
    this.base.getVar('Contrast').value = this.getIntFromStringHex(data)
  }

  setTempSensor() {
    this.sendCommand(MSG_TYPE.SET, '06', TEMP_SENSOR, '0001')
  }

  tempSensorHandler(data) {
    data && this.base.performInPriority('getTemperature')
  }

  getTemperature() {
    this.sendCommand(MSG_TYPE.GET, '06', TEMPERATURE)
  }

  temperatureHandler(data) {
    const degrees = this.calcTemp(data)
    this.logger.debug('RECEIVED TEMPERATURE:', data, degrees)
    this.base.getVar('Temperature').value = degrees
  }

  // Video Source
  getSource() {
    this.sendCommand(MSG_TYPE.GET, '06', SOURCE)
  }

  selectSource({ Name }) {
    const param = this.sources.valueFrom[Name]
    this.logger.debug('SELECT_SOURCE:', Name, param)
    this.sendCommand(MSG_TYPE.SET, '0A', SOURCE, param)
  }

  sourceHandler(data) {
    this.logger.debug('SOURCE_HANDLER', data)
    if (this.sources.keyFrom[data])
      this.base.getVar('Sources').string = this.sources.keyFrom[data]
    else {
      this.logger.error("Unknown Input Source: ", data)
      this.base.getVar('Sources').string = ""
    }
  }

  // END DEVICE COMMANDS----------------------------------------

  // HELPERS----------------------------------------
  mirrorObject(obj) {
    return { 'valueFrom': Object.assign({}, obj), 'keyFrom': Object.assign({}, _.invert(obj)) }
  }

  frameHasHeader(frame) {
    return frame[0] === SOH;
  }

  frameHasFooter(frame) {
    return frame.slice(-1) === FRAME_SEPARATOR
  }
  
  isFullFrame(frame) {
    return this.frameHasHeader(frame) && this.frameHasFooter(frame)
  }
  
  checksum(block) {
    return Buffer.from([Buffer.from(block).reduce((acc,x) => acc ^ x)])
  }

  getHexValFromChar(str) {
    const parseChar = (c) => {
      if (c >= 0 && c <= 9) return c.charCodeAt() - 48
      if (c >= 'A' && c <= 'F') return c.charCodeAt() - 55 
      return undefined
    }
    return Array.from(str).reduce((num,char) => [...num, parseChar(char)], [])
  }
  
  getIntFromStringHex(str) {
    return this.getHexValFromChar(str).reduce((num,val) => num * 16 + val, 0)	
  }
  
  calcTemp(str) {
    const int = this.getIntFromStringHex(str)
    return (int >= 65535 / 2 ? int - 65536 : int) / 2
  }

  pad(data) {
    return _.padStart(data.toString(16), 4, '0')
  }
  // END HELPERS----------------------------------------

}

exports.XDevice = XDevice
