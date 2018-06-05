
const { XDevice } = require('./lib')
const pckg = require('./package.json')

// exported init function
let host
const CMD_TIMEOUT = 600

exports.init = function (_host) {
  host = _host
}

// exported createDevice function
exports.createDevice = function (base) {
  return new DriverDevice(base)
}

// driver device implementation
class DriverDevice extends XDevice {

  constructor(base) {
    super(host, base)
    this.base = base
    this.logger = base.logger || host.logger

    this.pckg = pckg
    this.models = pckg.overture.models

    //SET POLLING COMMANDS
    this.base.setPoll('getPower', 3000)
    this.base.setPoll('getAudioMute', 3000)
    this.base.setPoll('getAudioLevel', 3000)
    this.base.setPoll('getBrightness', 3000)
    this.base.setPoll('getContrast', 3000)
    this.base.setPoll('getTemperature', 2000)
    this.base.setPoll('getSource', 3000)
  }

  //BASE COMMANDS----------------------------------------
  setup(config) {
    this.config = config
    const modelSources = {
      x554un: {
        "DVI1": '0003',
        "Display Port": '000F',
        "HDMI 1": '0011',
        "VGA": '0001'
      },
      others: {
        "Display Port": '000F',
        "DVI1": '0003',
        "DVI2": '0004',
        "HDMI 1": '0011',
        "HDMI 2": '0012',
        "HDMI 3": '0082',
        "HDMI 4": '0083',
        "Option": '000D'
      }
    }

    if (config.model.includes("X554UN")) {
      this.sources = this.mirrorObject(modelSources.x554un) 
      this.base.getVar('Sources').enums = Object.keys(modelSources.x554un)
    } else {
      this.sources = this.mirrorObject(modelSources.others)
      this.base.getVar('Sources').enums = Object.keys(modelSources.others)
    }
  }

  start() {
    this.base.perform('connect')
  }

  stop() {
    this.disconnect()
  }

  startPoll() {
    this.base.startPolling({startImmediately: true})    
  }
}
