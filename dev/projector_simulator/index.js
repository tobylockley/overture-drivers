"use strict";
/**
 * init
 */
let logger;
function init(host) {
    logger = host.logger;
}
exports.init = init;
/**
 * create a device
 */
function createDevice(base) {
    return new DriverDevice(base);
}
exports.createDevice = createDevice;
/**
 * Projector Device
 */
class DriverDevice {
    /**
     * constructor
     */
    constructor(base) {
        /**
         * local vars
         */
        this.startDate = new Date();
        this.base = base;
        this.status = this.base.getVar('Status');
        this.power = this.base.getVar('Power');
        this.shutter = this.base.getVar('Shutter');
        this.sources = this.base.getVar('Sources');
        this.brightness = this.base.getVar('Brightness');
        this.contrast = this.base.getVar('Contrast');
        this.temperature = this.base.getVar('Temperature');
        this.hoursLamp1 = this.base.getVar('HoursLamp1');
        this.base.setTickPeriod(5000);
    }
    /**
     * setup the device
     */
    setup(config) {
        // todo
    }
    /**
     * called when the required value of a variable is changed
     */
    setVariable(variable) {
        // nothing to do because the default behavior is handled by the base device
    }
    /**
     * set power
     */
    setPower(params) {
        if (params.Status === 'On') {
          setTimeout( () => {
            this.power.value = 1;
          }, 3000);
        }
        if (params.Status === 'Off') {
            setTimeout( () => {
              this.power.value = 0;
            }, 3000);
        }
        // todo: throw error if wrong param  
    }
    /**
     * set shutter
     */
    setShutter(params) {
        if (params.Status === 'Open' || params.Status === 'Opened') {
            this.shutter.value = 1;
        }
        if (params.Status === 'Closed') {
            this.shutter.value = 0;
        }
        // todo: throw error if wrong param  
    }
    /**
     * select source
     */
    selectSource(params) {
        let index = this.sources.enums.indexOf(params.Name);
        if (index >= 0) {
            this.sources.value = index;
        }
        // todo: throw error if wrong index  
    }
    /**
     * set contrast
     */
    setContrast(params) {
        this.contrast.value = Number(params.Level);
    }
    /**
     * set brightness
     */
    setBrightness(params) {
        this.brightness.value = Number(params.Level);
    }
    /**
     * called when the device starts
     */
    start() {
        this.status.value = 1;
        this.power.value = 0;
        this.shutter.value = 0;
        this.sources.value = 1;
        this.brightness.value = 40;
        this.contrast.value = 60;
        this.temperature.value = 80 + Math.ceil((Math.random() * 10));
        this.hoursLamp1.value = 125;
    }
    /**
     * called when the device stops
     */
    stop() {
    }
    /**
     * internal tick function which is called regularly
     */
    tick() {
        // this.temperature.value = 80 + Math.ceil((Math.random() * 10));
        let delta = new Date().getTime() - this.startDate.getTime();
        this.hoursLamp1.value = new Date(delta).getHours();
    }
}
//# sourceMappingURL=index.js.map