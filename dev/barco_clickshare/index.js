/**
 * Created by Florian on 5/19/2016.
 */
"use strict";
/***
 * init
 */
let logger;
let request;
function init(host) {
    logger = host.logger;
    request = host.request;
}
exports.init = init;
/**
 * create a device
 */
function createDevice(base) {
    return new DriverDevice(base);
}
exports.createDevice = createDevice;
class DriverDevice {
    constructor(base) {
        this.askedRestart = false;
        this.numberOfFails = 0;
        this.base = base;
        this.modelName = this.base.getVar('ModelName');
        this.status = this.base.getVar('Status');
        this.statusMessage = this.base.getVar('StatusMessage');
        this.sharingStatus = this.base.getVar('SharingStatus');
        this.cpuTemperature = this.base.getVar('CpuTemperature');
        this.firmwareVersion = this.base.getVar('FirmwareVersion');
        this.currentUptime = this.base.getVar('CurrentUptime');
        this.totalUptime = this.base.getVar('TotalUptime');
        this.location = this.base.getVar('Location');
        this.meetingRoomName = this.base.getVar('MeetingRoomName');
        this.serialNumber = this.base.getVar('SerialNumber');
    }
    // SETUP //
    setup(config) {
        this.config = config;
        //Define how to talk to the Clickshare depending to the model
        switch (this.config.model) {
            case 'CSM-1':
                this.config.authMethod = 'digest';
                this.config.protocol = "http";
                this.config.port = "4000";
                break;
            case 'CSC-1':
                this.config.authMethod = 'digest';
                this.config.protocol = "http";
                this.config.port = "4000";
                this.base.createRealVariable("CpuTemperature", 0, 200);
                break;
            case 'CSE-200':
            case 'CSE-800':
                this.config.authMethod = 'basic';
                this.config.protocol = "https";
                this.config.port = "4001";
                this.base.createRealVariable("CpuTemperature", 0, 200);
                break;
            default:
                logger.error("Model " + this.config.model + " not recognized !!");
        }
    }
    // COMMANDS //
    restartSystem() {
        const self = this;
        logger.debug('restartSystem()');
        this.sendRequest('v1.0/Configuration/RestartSystem', 'PUT', { value: true })
            .then(function () {
            self.askedRestart = true;
        })
            .catch(function (err) {
            logger.error('Error in restartSystem(): ' + err);
        });
        setTimeout(self.getInfo(), 5000); //Restart getInfo() in 5 secs
    }
    shutdownSystem() {
        logger.debug('shutdownSystem()');
        this.sendRequest('v1.0/Configuration/ShutdownSystem', 'PUT', { value: true })
            .then(function () {
            logger.info('Shutdown successful');
        })
            .catch(function (err) {
            logger.error('Error in shutdownSystem(): ' + err);
        });
    }
    standbySystem() {
        logger.debug('standbySystem()');
        if (this.config.model != 'CSE-800')
            var url = 'v1.0/Display/StandbyState';
        else
            var url = 'v1.6/Display/StandbyState';
        this.sendRequest(url, 'PUT', { value: true })
            .then(function (resp) {
            logger.info('Standby change to true successful ' + resp);
        })
            .catch(function (err) {
            logger.error('Error in StandbyState change to true: ' + err);
        });
    }
    awakeSystem() {
        logger.debug('awakeSystem()');
        if (this.config.model != 'CSE-800')
            var url = 'v1.0/Display/StandbyState';
        else
            var url = 'v1.6/Display/StandbyState';
        this.sendRequest(url, 'PUT', { value: false })
            .then(function (resp) {
            logger.info('Standby change to false successful ' + resp);
        })
            .catch(function (err) {
            logger.error('Error in StandbyState change to false: ' + err);
        });
    }
    setStatus(params) {
        logger.debug('setStatus()');
        switch (params.Status) {
            case 'Standby':
                this.standbySystem();
                break;
            case 'Connected':
                this.awakeSystem();
                break;
            case 'Restarting':
                this.restartSystem();
                break;
            case 'Disconnected':
                this.shutdownSystem();
                break;
        }
    }
    updateLocation(value) {
        logger.debug('updateLocation()');
        const self = this;
        this.sendRequest('v1.0/OnScreenText/Location', 'PUT', { value: value })
            .then(function (resp) {
            logger.info('Location update to ' + value + ' successful');
            self.location.value = value;
        })
            .catch(function (err) {
            logger.error('Location update to ' + value + ' error: ' + err);
        });
    }
    updateMeetingRoomName(value) {
        logger.debug('updateMeetingRoomName()');
        const self = this;
        this.sendRequest('v1.0/OnScreenText/MeetingRoomName', 'PUT', { value: value })
            .then(function (resp) {
            logger.info('MeetingRoomName update to ' + value + ' successful');
            self.meetingRoomName.value = value;
        })
            .catch(function (err) {
            logger.error('MeetingRoomName update to ' + value + ' error: ' + err);
        });
    }
    // SYSTEM FUNCTIONS //
    /**
     * START called when the device starts
     */
    start() {
        this.getInfo();
    }
    /**
     * STOP called when the device stops
     */
    stop() {
        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
            this.tickTimer = null;
        }
    }
    // Not used
    tick() {
    }
    /**
     * TICK internal private getInfo function which is called regularly
     */
    getInfo() {
        const self = this;
        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
            this.tickTimer = null;
        }
        this.sendRequest('v1.0/DeviceInfo/ModelName')
            .then(function (modelName) {
            self.modelName.value = modelName;
            //Reset the restarting flag.
            if (self.numberOfFails > 2) {
                self.numberOfFails = 0;
                self.askedRestart = false;
                logger.debug("Reset flags");
            }
            return self.sendRequest('v1.0/DeviceInfo/SerialNumber');
        })
            .then(function (number) {
            self.serialNumber.value = number;
            return self.sendRequest('v1.0/DeviceInfo/Sharing');
        })
            .then(function (sharingStatus) {
            self.sharingStatus.value = sharingStatus ? 1 : 0;
            return self.sendRequest('v1.0/DeviceInfo/Status');
        })
            .then(function (statusNumber) {
            switch (statusNumber) {
                case 0:
                    //Connected, do nothing before knowing if it is in standby mode.
                    break;
                case 1:
                    //self.status.value = 2; //Warning
                    self.status.string = 'Warning';
                    break;
                case 2:
                    //self.status.value = 3; //Error
                    self.status.string = 'Error';
                    break;
            }
            if (self.config.model != 'CSE-800')
                return self.sendRequest('v1.0/Display/StandbyState');
            else
                return self.sendRequest('v1.6/Display/StandbyState');
        })
            .then(function (standbyState) {
            switch (standbyState) {
                case true:
                    //self.status.value = 5; //Standby
                    self.status.string = 'Standby';
                    break;
                case false:
                    //self.status.value = 4; //Connected
                    self.status.string = 'Connected';
                    break;
            }
            return self.sendRequest('v1.0/DeviceInfo/StatusMessage');
        })
            .then(function (statusMessage) {
            self.statusMessage.value = statusMessage == ' ' ? '-' : statusMessage;
            return self.sendRequest('v1.0/Software/FirmwareVersion');
        })
            .then(function (firmwareVersion) {
            self.firmwareVersion.value = firmwareVersion;
            return self.sendRequest('v1.0/DeviceInfo/CurrentUptime');
        })
            .then(function (currentUptime) {
            self.currentUptime.value = currentUptime / 3600;
            return self.sendRequest('v1.0/DeviceInfo/TotalUptime');
        })
            .then(function (totalUptime) {
            self.totalUptime.value = totalUptime / 3600;
            return self.sendRequest('v1.0/OnScreenText/Location');
        })
            .then(function (location) {
            self.location.value = location;
            return self.sendRequest('v1.0/OnScreenText/MeetingRoomName');
        })
            .then(function (meetingRoomName) {
            self.meetingRoomName.value = meetingRoomName;
            if (self.config.model != 'CSM-1')
                return self.sendRequest('v1.0/DeviceInfo/Sensors/CpuTemperature');
            else
                return false;
        })
            .then(function (cpuTemperature) {
            let cpuTempObj = self.base.getVar('CpuTemperature');
            if (cpuTempObj) {
                //Convert the temperature to the unit of the config
                if (self.config.temperatureUnit == "Fahrenheit") {
                    cpuTemperature = cpuTemperature * 1.8 + 32;
                }
                cpuTempObj.value = cpuTemperature;
            }
        })
            .catch(function (err) {
            if (err.options) {
                logger.error(err.options.uri + ' ' + err);
            }
            else {
                logger.error(err);
            }
            if (self.askedRestart) {
                self.numberOfFails++;
                if (self.numberOfFails < 100) {
                    //Device hasn't answered but normal because a restart has been asked
                    //self.status.value = 1; //Restarting
                    self.status.string = 'Restarting';
                }
                else {
                    //Device has took too much time to restart. He is disconnected.
                    //self.status.value = 0; //Disconnected
                    self.status.string = 'Disconnected';
                }
            }
            else {
                //Device hasn't answered, he is not connected
                //self.status.value = 0; //Disconnected
                self.status.string = 'Disconnected';
            }
            self.sharingStatus ? self.sharingStatus.value = 0 : false; //Not Sharing
            self.cpuTemperature ? self.cpuTemperature.value = 0 : false;
        })
            .finally(function () {
            //Restart the loop if device is Enabled:
            if (self.base.getVar('Activity').string == 'Enabled') {
                self.tickTimer = setTimeout(function () {
                    self.getInfo();
                }, self.config.refreshInterval);
            }
        });
    }
    // INTERNAL FUNCTIONS //
    sendRequest(endPointPath, meth, payload) {
        const method = meth ? meth : 'GET';
        const baseUrl = this.config.protocol + '://' + this.config.ip + ':' + this.config.port;
        const fullUrl = baseUrl + '/' + endPointPath;
        let json = true;
        if (typeof payload === 'string') {
            json = false;
        }
        const options = {
            method: method,
            uri: fullUrl,
            auth: {
                user: this.config.user,
                pass: this.config.password,
                sendImmediately: false
            },
            rejectUnauthorized: false,
            json: json,
            timeout: 10000,
            body: payload
        };
        return request(options)
            .then(function (answer) {
            if (answer.data) {
                return answer.data.value;
            }
            else {
                return answer;
            }
        });
    }
}
//# sourceMappingURL=index.js.map