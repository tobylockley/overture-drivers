const {
  DISPLAY_STATUS_COMMAND,
  SERIALNUM_COMMAND,
  SW_VERSION_COMMAND,
  MODEL_COMMAND,
  MODEL_NAME_COMMAND,
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
  NETWORK_STANDBY_COMMAND
} = require('./constants/commands.js')

const {
  MSG_HEADER,
  NAK,
  ERRORS
} = require('./constants/protocol.js')

const RESPONSES = {};
RESPONSES[DISPLAY_STATUS_COMMAND] = [
  {varname: 'Lamp'},
  {varname: 'TemperatureStatus'},
  {varname: 'BrightSensor'},
  {varname: 'Sync'},
  {varname: 'Temperature'},
  {varname: 'Fan'},
]
RESPONSES[SERIALNUM_COMMAND] = [
  {varname: 'Serial', bytes: 14, proc: (frame, csVar)=>{
    csVar.string = hexStringToChars( frame.substring(12, frame.length-2) ).trim()
  }}
]
RESPONSES[MODEL_COMMAND] = [
  {varname: 'Species', select: "speciesNames"},
  {varname: 'Model', select: "modelNames"}
]
RESPONSES[POWER_COMMAND] = [
  {varname: 'Power'}
]
RESPONSES[AUDIO_VOLUME_COMMAND] = [
  {varname: 'AudioLevel'}
]
RESPONSES[NETWORK_STANDBY_COMMAND] = [
  {varname: 'NetworkStandby'}
]
RESPONSES[AUDIO_MUTE_COMMAND] = [
  {varname: 'AudioMute'}
]
RESPONSES[INPUT_COMMAND] = [
  {varname: 'Sources', select: "sourceNames"}
]
RESPONSES[COLOR_COMMAND] = [
  {varname: 'Color'}
]
RESPONSES[CONTRAST_COMMAND] = [
  {varname: 'Contrast'}
]
RESPONSES[BRIGHTNESS_COMMAND] = [
  {varname: 'Brightness'}
]
RESPONSES[SHARPNESS_COMMAND] = [
  {varname: 'Sharpness'}
]
RESPONSES[TINT_COMMAND] = [
  {varname: 'Tint'}
]
RESPONSES[MDC_CONNECTION_TYPE_COMMAND] = [
  {varname: 'MDCConnectionType'}
]
RESPONSES[DEVICE_NAME_COMMAND] = [
  {varname: 'DeviceName', proc: (frame, csVar)=>{
    csVar.string = hexStringToChars( frame.substring(12, frame.length-2) )
  }}
]
RESPONSES[MODEL_NAME_COMMAND] = [
  {varname: 'Model', proc: (frame, csVar)=>{
    csVar.string = hexStringToChars( frame.substring(12, frame.length-2) )
  }}
]
RESPONSES[SW_VERSION_COMMAND] = [
  {varname: 'SWVersion', proc: (frame, csVar)=>{
    csVar.string = hexStringToChars( frame.substring(12, frame.length-2) )
  }}
]


function makeChecksum(data) {
  let check = 0x00;
  data.forEach(byte => check = check + byte);
  return Buffer.from([ check % 256 ])
}

function validateFrameChecksum(frame) {
  let data = frame.substr(2,frame.length-4)
  let frameChecksum = parseInt(frame.substr(-2), 16).toString(16)
  let check = 0x00;
  for (var i = 0; i < data.length; i += 2) {
    check = check + parseInt(data.substr(i,2), 16)
  }
  return frameChecksum == (check % 256).toString(16) 
}

function isFullFrame(frame) {
  return parseInt(frame.substr(0,2), 16) == MSG_HEADER && parseInt(frame.substr(6,2), 16) == (frame.length/2 - 5)
}

function frameHasError(frame) {
  let ackOrNak = parseInt(frame.substr(8, 2), 16)
  return ackOrNak == NAK;
}

function parseFrameError(frame) {
    return ERRORS[parseInt(frame.substr(-4, 2), 16).toString(16)]
}


module.exports = {
  RESPONSES,
  makeChecksum,
  validateFrameChecksum,
  isFullFrame,
  frameHasError,
  parseFrameError
}

// HELPERS

function hexStringToChars(data) {
  let chars = Array(data.length/2).fill().map((_,i)=>{
      return String.fromCharCode(parseInt(data.substr(i*2,2), 16))
  }).join('').replace(/\0/g,"").trim();
  return chars;
}
