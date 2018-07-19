"use strict"

const CMD_DEFER_TIME = 2000
const RELAY_POLL = 3000
const INPUT_POLL = 1000
const TICK_PERIOD = 5000
const TCP_TIMEOUT = 60000
const TCP_RECONNECT_DELAY = 5000

// exported init function
let logger
let host
exports.init = function (_host) {
  host = _host
  logger = host.logger
}

// exported createDevice function
exports.createDevice = function (base) {
  return new DriverDevice(base)
}

// driver device implementation
class DriverDevice {

  constructor(base) {
    this.base = base;
    //BUILD THE FRAME PARSER
    this.frameParser = host.createFrameParser();
    this.frameParser.setSeparator('\r');
    this.frameParser.on('data', (frame) => {
      this.parse(frame);
    });
  }

  //BASE COMMANDS-------------------------------------------------------
  setup(config) {
  this.config = config;
    //CREATE VARIABLES BASED ON RELAYS
    for (let i = 0; i < this.config.relays; i++) {
      let num = i + 1;
      this.base.createEnumVariable('PowerChannel' + num, ["Off", "On"]);
      this.base.getVar("PowerChannel" + num).smooth = true;
      this.base.getVar("PowerChannel" + num).perform = { "action": "Set Power", "params": { "Channel": num, "Status": "$string" } }
      // Set up polling
      this.base.setPoll('getPower', RELAY_POLL, { "Channel": num });
    }
    //CREATE VARIABLES BASED ON INPUTS
    for (let i = 0; i < this.config.inputs; i++) {
      let num = i + 1;
      this.base.createEnumVariable('InputChannel' + num, ["Off", "On"]);
      // Set up polling
      this.base.setPoll('getInput', INPUT_POLL, { "Channel": num });
    }
    this.base.setTickPeriod(TICK_PERIOD);
  }

  start() {
    this.initTcpClient();
  }
  stop() {
    this.disconnect();
    if (this.tcpClient) {
      this.tcpClient.end();
      this.tcpClient = null;
    }
  }
  disconnect() {
    this.base.getVar('Status').value = 0;
    this.base.stopPolling();
    this.base.clearPendingCommands();
  }
  tick() {
    !this.tcpClient && this.initTcpClient();
  }
  //END BASE COMMANDS-----------------------------------------------------------

  //DEVICE COMMANDS-------------------------------------------------------------
  setPower(params) {
    let num = params.Status === 'On' ? 1 : 0;
    this.sendDefer(`setstate,${this.config.modRelay}:${params.Channel},${num}\r`);
  }
  //END DEVICE COMMANDS--------------------------------------------------------

  //POLL COMMANDS--------------------------------------------------------------
  getPower(params) {
    this.sendDefer(`getstate,${this.config.modRelay}:${params.Channel}\r`);
  }
  getInput(params) {
    this.sendDefer(`getstate,${this.config.modInput}:${params.Channel}\r`);
  }
  //END POLL COMMANDS---------------------------------------------------------

  //UTIL COMMANDS-------------------------------------------------------------
  send(data) {
    logger.silly(`TCPClient send: ${data}`);
    return this.tcpClient && this.tcpClient.write(data);
  }
  sendDefer(data) {
    this.base.commandDefer(CMD_DEFER_TIME);
    if (!this.send(data)) this.base.commandError(`Data not sent`);
  }

  // Create a tcp client and handle events
  initTcpClient() {
    if (!this.tcpClient) {
      logger.debug("TCP Client Created.");
      this.tcpClient = host.createTCPClient();
      this.tcpClient.setOptions({
        receiveTimeout: TCP_TIMEOUT,
        autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
      });
      this.tcpClient.connect(this.config.port, this.config.host);

      this.tcpClient.on('data', (data) => {
        let frame = data.toString();
        logger.silly("Incoming Frame: " + frame);
        this.frameParser.push(data);
      });

      this.tcpClient.on('connect', () => {
        logger.debug("TCP Connection Open");
        this.base.getVar('Status').value = 1
        this.base.startPolling();
      });

      this.tcpClient.on('close', () => {
        logger.debug("TCP Connection Closed");
        this.disconnect();
      });

      this.tcpClient.on('error', (err) => {
        logger.debug("TCP Connection Error");
        this.stop();
      });
    }
  }

  parse(frame) {
    let err = /ERR/;
    if (err.test(frame)) {
      this.base.commandError('Error from module, check Error variable');
      if (frame == "ERR 003\r") this.base.getVar('Error').value = "Bad Module or Channel Number";
      else if (frame == "ERR RS004\r") this.base.getVar('Error').value = "Logical Relay Disabled or Unavailable";
      else this.base.getVar('Error').value = "General Error";
    }
    else this.base.getVar('Error').value = "";

    let rPower = /state,(\d):(\d),(\d)/;
    if (rPower.test(frame)) {
      let mod = Number(rPower.exec(frame)[1]);
      let channel = Number(rPower.exec(frame)[2]);
      let value = Number(rPower.exec(frame)[3]);
      if (mod == this.config.modRelay) this.base.getVar("PowerChannel" + channel).value = value;
      else if (mod == this.config.modInput) this.base.getVar("InputChannel" + channel).value = value;
      this.base.commandDone();
    }
  }

}


