"use strict";

const ESC = Buffer.from([0x1B]);


/**
 * Polling constants
 * @const 
 * @todo Need to adjust to actual values after testing.
 * @ignore
 */
const pollTimeOften = 5000;
const pollTimeNormal = 10000;
const pollTimeOccassionally = 60000;
const pollTimeLong = 120000;
const pollTimeHour = 3600000;

let host;
exports.init = function init(_host) {
   host = _host;
}

/**
 * create a device
 */
exports.createDevice = function createDevice(base) {
  return new DriverDevice(base);
}

/**
 * Extron Matrix Switcher - designed for Model Nos. 
 * DXP 44 HD 4K — 4 inputs by 4 outputs with 2 audio outputs
 * DXP 84 HD 4K — 8 inputs by 4 outputs with 2 audio outputs
 * DXP 88 HD 4K — 8 inputs by 8 outputs with 2 audio outputs
 * DXP 168 HD 4K — 16 inputs by 8 outputs with 4 audio outputs
 * DXP 1616 HD 4K — 16 inputs by 16 outputs with 4 audio outputs
 @class
*/
class DriverDevice {
    
    


    /**
     * @constructor Creates a device driver to control an Extron DXP Matrix Switcher.
     * @param {object} base - Passed in by Overture. 
     * @ignore
     */
    constructor(base) {
        this.base = base;
        this.logger = base.logger || host.logger;
        

        //BUILD THE FRAME PARSER
        this.frameParser = host.createFrameParser();
        //this.frameParser.setSeparator(/\x0d\x0A/);
        this.frameParser.on('data', (frame) => {
            this.parse(frame);
        });
    }

    /**
   * Prepares the driver. Does not start communication with the device. 
   * @param {object} config - Passed in by Overture.
   * 
   */

    setup(config) {
        this.config = config;
        this.inputs = ['None'];
        this.inputMap = {};
        this.inputMap['None'] = 0;
        this.outputs = ['AllOutputs'];
        this.outputMap = {};
        this.outputMap['AllOutputs'] = 0;
        
         // //CREATE VARIABLES BASED ON INPUTS
        for (let input of this.config.inputs) {
            this.inputs.push(input.name);
            this.inputMap[input.name] = input.channel;
        }
        let src = this.base.getVar("Source");
        src.enums = this.inputs;
        let dest = this.base.getVar("Dest");
        dest.enums = this.outputs;

        let valAudOuts = this.getValidAudioOutputs();
         // //CREATE VARIABLES BASED ON OUTPUTS
         for (let output of this.config.outputs) {
            this.outputs.push(output.name);
            this.outputMap[output.name] = output.channel;
            this.logger.debug("Creating output variables. output.name = " + output.name);
            if (valAudOuts.includes(output.channel)) {
                this.base.createVariable({"name": this.makeVariableName("AOut",output.channel),"type": "enum", "enums": this.inputs, "humanName": "Audio Out " + output.channel});
                this.base.getVar(this.makeVariableName("AOut",output.channel)).perform = {"action" : "Select Audio Source", "params" : {"Source": "$string", "Dest":output.name}};
            }
            this.base.createVariable({"name": this.makeVariableName("VOut",output.channel),"type": "enum", "enums": this.inputs, "humanName": "Video Out " + output.channel});
            this.base.getVar(this.makeVariableName("VOut",output.channel)).perform = {"action" : "Select Video Source", "params" : {"Source": "$string", "Dest":output.name}};
        }
        
        
       // this.base.setPoll('getLampHours', pollTimeOccassionally);
        
    }

 

     // SYSTEM FUNCTIONS //
    /**
     * Called by Overture to start the device driver
     * @function
     * 
     */
    start() {
        this.initTcpClient()
        this.connect();
    }

    /**
     * Called by Overture to stop the device driver
     * @function
     * 
     */
    stop() {
        this.tcpClient.end();
        this.disconnect();
    }

    // INTERNAL FUNCTIONS //

    /**
     * Internal function to create a connection to the device.
     * @function
     * 
     */
    initTcpClient() {
        if (!this.tcpClient) {
            this.logger.debug("TCP Client Created.");
            this.tcpClient = host.createTCPClient();
            this.tcpClient.on('data', (data) => {
                this.logger.debug("TCP data push - " + data);
                this.frameParser.push(data);
            });
        this.tcpClient.on('connect', () => {
            this.logger.debug("TCP Connection Open");
            this.base.getVar('Status').value = 1;
            this.onConnect();
        });

        this.tcpClient.on('close', () => {
            this.logger.debug("TCP Connection Closed");
            this.base.getVar('Status').value = 0;
            this.disconnect();
        });

        this.tcpClient.on('error', (err) => {
            this.logger.debug("TCP Connection Error" + JSON.stringify(err));
            this.base.getVar('Status').value = 0;
            this.disconnect();
        });
        }
    }
    /**
     * @function
     * 
     */
    onConnect() {
        // need to login first
    }

    onLoggedIn() {
        //Commands that only need to be initialized once
        this.logger.debug("onLoggedIn starting initial unit status requests");
        this.base.perform("Set Verbose Mode", "");
        for (let out of this.outputs) {
            if(out !== "AllOutputs") {
                this.base.perform("Get Video Source", out);
            }
        }
        let valAudioOuts = this.getValidAudioOutputs();
        for (let aCh of valAudioOuts){
            this.base.perform("Get Audio Source", aCh);
        }
        //start polling.
        this.startPoll();
    }

    /**
     * @function
     * 
     */
    startPoll() {
        //Start polling 
        this.base.startPolling();
    }
    /**
     * @function
     * 
     */
    connect() {
        this.logger.debug("Attempting to connect to "+this.config.host+' on port '+ this.config.port);
        this.tcpClient.connect(this.config.port, this.config.host);
    }
    /**
     * @function
     * 
     */
    disconnect() {
        this.base.stopPolling();
        this.base.clearPendingCommands();
    }
  
    /**
     * sendCommand - send a command to the device
     * @function 
     * @param {string} - msg - the message to send
     * @param {integer} - timeout - how long to defer command
     * 
     */
    sendCommand(msg, timeout = 10000) {
        if (timeout > -1) {
            this.base.commandDefer(timeout);
        }
        if (this.tcpClient.write(msg)) {
            this.logger.debug('Sending Message: ' + msg);
            return true;
        }
        else {
            this.base.commandError('Message Not Sent : ' + msg);
            return false;
        }
    }


    setModel(mod) {
        let modelStr = mod;
        switch (mod) {
            case ("60-1493-01"): modelStr = "DXP 44 HD 4K"; break;
            case ("60-1494-01"): modelStr = "DXP 84 HD 4K"; break;
            case ("60-1495-01"): modelStr = "DXP 88 HD 4K"; break;
            case ("60-1496-01"): modelStr = "DXP 168 HD 4K"; break;
            case ("60-1497-01"): modelStr = "DXP 1616 HD 4K"; break;
            case ("60-1493-21"): modelStr = "DXP 44 HD 4K PLUS"; break;
            case ("60-1494-21"): modelStr = "DXP 84 HD 4K PLUS"; break;
            case ("60-1495-21"): modelStr = "DXP 88 HD 4K PLUS"; break;
        }
        this.config.model = modelStr;
    }

    getModel() {
        let msg = "N";
        this.sendCommand(msg);
    }


    setVerboseMode() {
        // set verbosemode 3
        let msg = Buffer.from("3CV\r");
        msg = Buffer.concat([ESC,msg])
        this.sendCommand(msg);
    }

    getVerboseMode() {
        let msg = Buffer.from("CV\r");
        msg = Buffer.concat([ESC,msg])
        this.sendCommand(msg);
    }

    setSource(params){
        if(params != null && params.Source != null) {
            this.logger.debug("Set Source - " + params.Source);
            this.base.perform("Select Video Source",{"Source":params.Source,"Dest":this.getDest()});
        } else this.logger.error("Error from Extron matrix Switcher -- Invalid Source param in \"Set Source()\"");    
    }

    setAudioSource(params) {
        if(params != null && params.AudioSource != null) {
            this.logger.debug("Set Audio Source - " + params.AudioSource);
            this.base.perform("Select Audio Source",{"Source":params.AudioSource,"Dest":this.getAudioDest()});
        } else this.logger.error("Error from Extron matrix Switcher -- Invalid AudioSource param in \"Set Audio Source()\"");    
    }

    setDest(params) {
        if(params != null && params.Dest != null) {
            this.logger.debug("Set Dest - " + params.Dest);
            let VOut = this.outputMap[params.Dest] != null ? this.outputMap[params.Dest] : parseInt(params.Dest);
            if(VOut != NaN) {
                this.base.getVar("Dest").value = VOut;
            } else this.logger.error("Error from Extron matrix Switcher -- Invalid Dest param in \"Set Dest()\"");    
        } else this.logger.error("Error from Extron matrix Switcher -- Invalid Dest param in \"Set Dest()\"");    
    }

    setAudioDest(params) {
        if(params != null && params.Dest != null) {
            this.logger.debug("Set Audio Dest - " + params.AudioDest);
            let AOut = this.outputMap[params.Dest] != null ? this.outputMap[params.Dest] : parseInt(params.Dest);
            if(AOut != NaN) {
                if(this.getValidAudioOutputs().indexOf(AOut) >-1) {
                    this.base.getVar("Dest").value = AOut;
                } else this.logger.error("Error from Extron matrix Switcher -- Invalid Dest param in \"Set Dest()\"");
            } else this.logger.error("Error from Extron matrix Switcher -- Invalid Dest param in \"Set Dest()\"");    
        } else this.logger.error("Error from Extron matrix Switcher -- Invalid Dest param in \"Set Dest()\"");    
    }

    getSource() {
        return this.base.getVar("Source").string;
    }

    getAudioSource() {
        return this.base.getVar("Dest").string;
    }

    getDest() {
        return this.base.getVar("Dest").string;
    }

    getAudioDest() {
        return this.base.getVar("AudioDest").string;
    }

    

    selectSource(params) {
        if(params != null && params.Source != null && params.Dest != null && params.Mode != null) {
            if(params.Mode != "Audio") {
                this.base.perform("Set Video Source",{"Source":params.Source,"Dest":params.Dest});
            }
            if(params.Mode != "HDMI") {
                // audio is involved - 
                this.base.perform("Set Audio Source",{"Source":params.Source,"Dest":params.Dest});
            }
        } else this.logger.error("Error from Extron matrix Switcher -- Invalid Destination param in \"Select Source()\"");    
    }

    getAudioSource(output){
        if(output != null) {
            let AOut = this.outputMap[output] != null ? this.outputMap[output] : parseInt(output);
            if(AOut != NaN) {
                this.logger.debug("AOut = " + AOut);
                AOut = this.checkAudioOutput(AOut);
                let msg = AOut + "$";
                this.sendCommand(msg);
                this.logger.debug("sending command - Get Audio Source - " + msg);
            } else this.logger.error("VOut is NaN in \"getAudioSource()\"");
        } else this.logger.error("Invalid parameter passed to \"getVideoSource()\" - " + output);
    }

    selectAudioSource(params) {
        if(params != null && params.Source != null && params.Dest != null) {
            let AOut = this.outputMap[params.Dest] != null ? this.outputMap[params.Dest] : parseInt(params.Dest);
            if(AOut != NaN) {
                AOut = this.checkAudioOutput(AOut);
                let AIn = this.inputMap[params.Source] != null ? this.inputMap[params.Source] : parseInt(params.Source);
                if(AIn != NaN) {
                    this.logger.debug("AIn = " + AIn + " Source = " + params.Source);
                    if(AIn < 0) {
                        AIn = 0;        // if params.Source is undefined unlatch output
                    }
                    let msg = AIn + "*" + AOut + "$";
                    this.sendCommand(msg);
                    this.logger.debug("sending command - Select Audio Source - " + msg);
                } else this.logger.error("Invalid Source parameter passed to \"selectAudioSource()\"");
            } else this.logger.error("Invalid Dest parameter passed to \"selectAudioSource()\"");
        } else {
            this.logger.error("Invalid parameter passed to \"selectAudioSource()\"");
        }
    }

    getVideoSource(output){
        if(output != null) {
            this.logger.debug("DEBUG  - output = " + output);
            let VOut = this.outputMap[output] != null ? this.outputMap[output] : parseInt(output);
            if(VOut != NaN) {
                let msg = VOut + "%";
                this.sendCommand(msg);
                this.logger.debug("sending command - Get Video Source - " + msg);
            } else this.logger.error("VOut is NaN in \"getVideoSource()\"");
        } else this.logger.error("Invalid parameter passed to \"getVideoSource()\" - " + output);
    }

    selectVideoSource(params) {
        if(params != null && params.Source != null && params.Dest != null) {
            let VOut = this.outputMap[params.Dest] != null ? this.outputMap[params.Dest] : parseInt(params.Dest);
            if(VOut != NaN) {
                if(VOut < 1) {
                    VOut = "";      // if params.Dest == 0 or is undefined route to all outputs
                }
                let VIn =  this.inputMap[params.Source] != null ? this.inputMap[params.Source] : parseInt(params.Source);
                if(VIn != NaN) {
                    if(VIn < 0) {
                        VIn = 0;        // if params.Source is undefined unlatch output
                    }
                    let msg = VIn + "*" + VOut + "%";
                    this.sendCommand(msg);
                    this.logger.debug("sending command - Select Video Source - " + msg);
                } else this.logger.error("Invalid Source parameter passed to \"selectVideoSource()\"");
            } else this.logger.error("Invalid Dest parameter passed to \"selectVideoSource()\"");
        } else {
            this.logger.error("Invalid parameter passed to \"selectVideoSource()\"");
        }

    }

    /**
     * parse the current frame to determine information from the projector 
     * @function 
    * @param 
    * 
    */
    parse(frame) {
        this.logger.debug("Parse incoming data:" + frame);
        let comm = this.base.getPendingCommand();
        let errorState = false;
        let pss = /Password:/;
        if(pss.test(frame)){
            //this.logger.debug("Sending Command password - " + this.config.password);
            this.sendCommand(this.config.password+"\r");
        }
        pss = /Login Administrator/;
        if(pss.test(frame)){
            this.logger.debug("Password Accepted");
            this.onLoggedIn();
        }
        let err = /^E(\d\d)/;
        if (err.test(frame)) {      // Error returned from switcher
            let errNum = err.exec(frame);
            this.logger.error("Error from Extron matrix Switcher -- " + errNum[1]); 
            switch (errNum[1]) {
                case ("01") : {
                    this.logger.error("Error from Extron matrix Switcher -- INVALID INPUT NUMBER");    
                    errorState = true;  
                    break;  
                }
                case ("10") : {
                    this.logger.error("Error from Extron matrix Switcher -- INVALID COMMAND");        
                    errorState = true;
                    break;    
                }
                case ("11") : {
                    this.logger.error("Error from Extron matrix Switcher -- INVALID PRESET NUMBER");        
                    errorState = true;    
                    break;
                }
                case ("12") : {
                    this.logger.error("Error from Extron matrix Switcher -- INVALID OUTPUT NUMBER");        
                    errorState = true;    
                    break;
                }
                case ("13") : {
                    this.logger.error("Error from Extron matrix Switcher -- INVALID PARAMETER");        
                    errorState = true;    
                    break;
                }
                case ("14") : {
                    this.logger.error("Error from Extron matrix Switcher -- NOT VALID FOR THIS CONFIGURARTION");        
                    errorState = true;    
                    break;
                }
                case ("17") : {
                    this.logger.error("Error from Extron matrix Switcher -- TIMEOUT");        
                    errorState = true;    
                    break;
                }
                case ("21") : {
                    this.logger.error("Error from Extron matrix Switcher -- INVALID ROOM NUMBER");        
                    errorState = true;    
                    break;
                }
                case ("22") : {
                    this.logger.error("Error from Extron matrix Switcher -- BUSY");        
                    errorState = true;    
                    break;
                }
                case ("24") : {
                    this.logger.error("Error from Extron matrix Switcher -- PRIVILEGE VIOLATION");        
                    errorState = true;    
                    break;
                }
                case ("25") : {
                    this.logger.error("Error from Extron matrix Switcher -- DEVICE NOT PRESENT");        
                    errorState = true;    
                    break;
                }
                case ("26") : {
                    this.logger.error("Error from Extron matrix Switcher -- MAX NUM OF CONNECTIONS EXCEEDED");        
                    errorState = true;    
                    break;
                }
                case ("28") : {
                    this.logger.error("Error from Extron matrix Switcher -- BAD FILENAME OR FILE NOT FOUND");        
                    errorState = true;    
                    break;
                }
            }
        } 
        let res = /Qik\x0d/; // front panel switching operation occured
        if (res.test(frame)) {
            this.logger.debug("Extron Matrix Switcher - front panel switching operation occured");
            return false;
        }
        res = /Rpr(\d\d)\x0d/; // a memory preset is recalled from the front panel.
        if (res.test(frame)) {
            let pst = res.exec(frame);
            this.logger.debug("Extron Matrix Switcher - Memory preset " + pst[1] + " recalled from the front panel.");
            return false;
        }
        res = /Spr(\d\d)\x0d/; // a memory preset is saved from the front panel.
        if (res.test(frame)) {
            let pst = res.exec(frame);
            this.logger.debug("Extron Matrix Switcher - Memory preset " + pst[1] + " saved from the front panel.");
            return false;
        }
        res = /(\d\d)Vmt(\d)\x0d/; // video output mute is toggled on or off from the front panel.
        if (res.test(frame)) {
            let pst = res.exec(frame);
            // eventually we may need to set a variable for video mute
            this.logger.debug("Extron Matrix Switcher - video mute is toggled " + pst[2] > 0 ? "ON" : "OFF" + " on output " + pst[1] + "  from the front panel.");
            return false;
        }
        res = /(\d\d)Amt(\d)\x0d/; // audio output mute is toggled on or off from the front panel.
        if (res.test(frame)) {
            let pst = res.exec(frame);
            // eventually we may need to set a variable for audio mute
            this.logger.debug("Extron Matrix Switcher - audio mute is toggled " + pst[2] > 0 ? "ON" : "OFF" + " on output " + pst[1] + "  from the front panel.");
            return false;
        }
        res = /Exe(\d)\x0d/; // the Front Panel Lockout mode is toggled on or off from the front panel.
        if (res.test(frame)) {
            let pst = res.exec(frame);
            this.logger.debug("Extron Matrix Switcher - Front Panel Lockout mode is toggled to " + pst[1] == 0 ? "OFF" : pst[1] == 1 ? "VIEW ONLY" : "BASIC MODE ONLY" +  " from the front panel.");
            return false;
        }
        res = /HplgO(\d\d)\x0d/; // Hotplug is detected on output.
        if (res.test(frame)) {
            let pst = res.exec(frame);
            this.logger.debug("Extron Matrix Switcher - Hotplug is detected on output " + pst[1] + ".");
            return false;
        }
        if (comm) {
            this.logger.debug("Parse looking at pending command: " + comm.action);
            switch (comm.action) {
                case 'setVerboseMode': {
                    if(errorState) {
                        this.base.commandError("setVerboseMode");
                        return false;
                    }
                    let rVbs = /^Vrb(\d)\r/; // verbose mode
                    if (rVbs.test(frame)) { 
                        let vMode = rVbs.exec(frame);
                        this.logger.debug("Parse switch() found setVerboseMode with value of " + vMode[1]);
                        this.base.performInPriority("getVerboseMode", "");
                        this.base.commandDone("setVerboseMode");
                        return true;
                    } else {
                        this.logger.error("Error from Extron Switcher -- returned invalid response \"" + frame + "\" for command setVerboseMode");
                        this.base.commandError("setVerboseMode");
                        return false;
                    }
                }
                case 'getVerboseMode': {
                    if(errorState) {
                        this.base.commandError("getVerboseMode");
                        return false;
                    }
                    let rVbs = /^Vrb(\d)\r/; // verbose mode 1,2,3
                    let rVbs0 = /(\d)\r/; // verbose mode 0
                    if (rVbs.test(frame) || rVbs0.test(frame)) { 
                        let vMode = rVbs0.exec(frame);
                        this.logger.debug("Parse switch() found getVerboseMode with value of " + vMode[1]);
                        this.base.getVar("VerboseMode").value = parseInt(vMode[1]);
                        this.base.commandDone("getVerboseMode");
                        return true;
                    } else {
                        this.logger.error("Error from Extron Switcher -- returned invalid response \"" + frame + "\" for command getVerboseMode");
                        this.base.commandError("getVerboseMode");
                        return false;
                    }
                }
                case ("getModel") : {
                    if(errorState) {
                        this.base.commandError("getModel");
                        return false;
                    }
                    let rmod = /^Pno(.+)\r/; 
                    if (rmod.test(frame)) { 
                        let mod = rmod.exec(frame);
                        this.logger.debug("Parse switch() found getmodel with value of " + mod[1]);
                        this.setModel(vMode[1]);
                        this.base.commandDone("getModel");
                        return true;
                    } else {
                        this.logger.error("Error from Extron Switcher -- returned invalid response \"" + frame + "\" for command getModel");
                        this.base.commandError("getModel");
                        return false;
                    }
                }
                case ("selectVideoSource") : {
                    if(errorState) {
                        this.base.commandError("selectVideoSource");
                        return false;
                    }
                    let rVsel = /^Out(\d+) In(\d+) Vid\r/; 
                    if (rVsel.test(frame)) { 
                        let vSel = rVsel.exec(frame);
                        this.logger.debug("Parse switch() found selectVideoSource with Source of " + vSel[2] + " and Dest of " + vSel[1]);
                        this.base.getVar(this.makeVariableName("VOut",vSel[1]) ).string = this.getInputName(vSel[2]);
                        this.base.commandDone("selectVideoSource");
                        return true;
                    } else {
                        this.logger.error("Error from Extron Switcher -- returned invalid response \"" + frame + "\" for command SelectVideoSource");
                        this.base.commandError("selectVideoSource");
                        return false;
                    }
                }
                case ("getVideoSource") : {
                    if(errorState) {
                        this.base.commandError("getVideoSource");
                        return false;
                    }
                    let rVsel = /^Out(\d+) In(\d+) Vid\r/; 
                    if (rVsel.test(frame)) { 
                        let vSel = rVsel.exec(frame);
                        this.logger.debug("Parse switch() found getVideoSource with Source of " + vSel[2] + " and Dest of " + vSel[1] + " => InputName = " + this.getInputName(vSel[2]));
                        this.base.getVar(this.makeVariableName("VOut",vSel[1]) ).string = this.getInputName(vSel[2]);
                        this.base.commandDone("getVideoSource");
                        return true;
                    } else {
                        this.logger.error("Error from Extron Switcher -- returned invalid response \"" + frame + "\" for command getVideoSource");
                        this.base.commandError("getVideoSource");
                        return false;
                    }
                }
                case ("selectAudioSource") : {
                    if(errorState) {
                        this.base.commandError("selectAudioSource");
                        return false;
                    }
                    let rAsel = /^Out(\d+) In(\d+) Aud\r/; 
                    if (rAsel.test(frame)) { 
                        let aSel = rAsel.exec(frame);
                        this.logger.debug("Parse switch() found selectAudioSource with Source of " + aSel[2] + "and Dest of " + aSel[1]);
                        this.base.getVar(this.makeVariableName("AOut",aSel[1]) ).string = this.getInputName(aSel[2]);
                        this.base.commandDone("selectAudioSource");
                        return true;
                    } else {
                        this.logger.error("Error from Extron Switcher -- returned invalid response \"" + frame + "\" for command SelectAudioSource");
                        this.base.commandError("selectAudioSource");
                        return false;
                    }
                }
                case ("getAudioSource") : {
                    if(errorState) {
                        this.base.commandError("getAudioSource");
                        return false;
                    }
                    let rAsel = /^Out(\d+) In(\d+) Aud\r/; 
                    if (rAsel.test(frame)) { 
                        let aSel = rAsel.exec(frame);
                        this.logger.debug("Parse switch() found getAudioSource with Source of " + aSel[2] + "and Dest of " + aSel[1]);
                        this.base.getVar(this.makeVariableName("AOut",aSel[1]) ).string = this.getInputName(aSel[2]);
                        this.base.commandDone("getAudioSource");
                        return true;
                    } else {
                        this.logger.error("Error from Extron Switcher -- returned invalid response \"" + frame + "\" for command getAudioSource");
                        this.base.commandError("getAudioSource");
                        return false;
                    }
                }
            }
        }
    }

    getInputName(input) {
        /*
        this.logger.debug("** getInputName |  input = " + input);
        let obKeys = Object.keys(this.inputMap);
        this.logger.debug("** getInputName |  obKeys = " + obKeys);
        let res = obKeys.find(key =>this.inputMap[key] == input);
        this.logger.debug("** getInputName |  res = " + res);
        */
        return Object.keys(this.inputMap).find(key =>this.inputMap[key] == input);
    }


    getValidAudioOutputs(){
        let AOut = 0;
        let valOutputs = [];
        let r16 = /DXP 16/;
        if(r16.test(this.config.model)){
            AOut = 4;
        }else  {
            AOut = 2;              // only 2 audio outputs so route to all
        }
        //is this a plus model?
        let rplus = /4K PLUS/;
        if(rplus.test(this.config.model)){
            valOutputs.push(2);           // only channel 2 is a valid audio output
        } else {
            for (let i=1;i<= AOut; ++i) {
                valOutputs.push(i);
            }
        }
        return valOutputs;        
    }

    checkAudioOutput(AOut) {
        this.logger.debug("into check Audio Output");
        let r16 = /DXP 16/;
        if(r16.test(this.config.model)){
            if(AOut > 4) {
                AOut = 0;           // only 4 audio outputs so route to all
            } 
        }else  if(AOut > 2) {
            AOut = 0;              // only 2 audio outputs so route to all
        }
        //is this a plus model?
        let rplus = /4K PLUS/;
        if(rplus.test(this.config.model)){
            AOut = 2;           // audio output chanel will be 2
        }
        if(AOut < 1) {
            AOut = "";      // if params.Dest == 0 or is undefined route to all outputs
        }
        this.logger.debug("check Audio Output - returning " + AOut );
        return AOut;
    }

    toCamelCase(str) {
        // Lower cases the string
        if (typeof str === 'undefined') {
          return str;
        }
        return str.toLowerCase()
          // Replaces any - or _ characters with a space 
          .replace(/[-_]+/g, ' ')
          // Removes any non alphanumeric characters 
          .replace(/[^\w\s]/g, '')
          // Uppercases the first character in each group immediately following a space 
          // (delimited by spaces) 
          .replace(/ (.)/g, function ($1) { return $1.toUpperCase(); })
          // Removes spaces 
          .replace(/ /g, '');
      }
    
      
      makeVariableName(myType, myLabel) {
        let varName = this.toCamelCase(myType + ' ' + myLabel);
        varName = varName.charAt(0).toUpperCase() + varName.slice(1);
        return varName;
      }
             

}