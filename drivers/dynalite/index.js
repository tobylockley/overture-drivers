"use strict";

/**
 * init
 */
let logger
let host
//let checksumbuffer
const{
    AREA1
} = require("./area_presets.js");
const{
    DynalitePresets
} = require("./dynalitePresets.js");

exports.init = (_host) => {
    host = _host
    logger = host.logger
}

/**
 * create a device
 */
exports.createDevice = (base) => {

    const status = base.getVar('Status')
    const presets = base.getVar('Presets')
    let channels = []
    let TCPClient
    let Area


    /**
     * setup the device
     */
    const setup = (config) => {
        var presetArray = []
        channels = [],
       // recallPreset(config)
        Area = config.Area
        for(let i = 0; i < config.DynalitePresets.length; i++){
             presetArray.push(config.DynalitePresets[i].name)
        }
       base.createVariable({
                name: 'Dynalite Preset',
                type: 'enum',
                enums: presetArray
            })

        for (let i = 0; i < config.channels; i++) {
            // let channel = base.createIntegerVariable('LevelChannel' + (i + 1), 0, 100)
            // perform: { action: 'Set Speaker ', params: {Channel: i+1, Level: '$value' } }
            let channel = base.createVariable({
                type: 'integer',
                name: 'LevelChannel' + (i + 1),
                min: 0,
                max: 100,
                perform: { action: 'Set Level', params: { Channel: i + 1, Level: "$value", Area: config.Area } },
                "optimize": true
            })
            // channel.perform = { action: 'Set Level', params: { Channel: i + 1, Level: "$value", Area: config.Area }}
            channels.push(channel)
        }
      //  recallPreset(config.Presets)

    }

    /**
     * set the level of on channel
     */
    const setLevel = (params) => {
        params.Channel = params[0]
        params.Level = params[1]
        let variable = channels[Number(params.Channel) - 1]
        if (variable) {
            variable.value = Number(params.Level)
        }
        // var channel = Buffer.from([params.channel])
        //var level = Buffer.from([params.level])
        var levelbuffer = Buffer.from([0x1C, Area, params.Channel, 0x71, 255 - params.Level * 2.55, 0x01, 0xFF])
        checksum(levelbuffer)

    }

    /**
     * recall a preset
     */
    const recallPreset = (params) => {
     if(Area == '1'){
        if(params.Name == 'Day'){
            base.getVar('Presets').string = 'Day'
            setLevel(AREA1.Low)
        }
        else if(params.Name == 'Meeting'){
            base.getVar('Presets').string = 'Meeting'
            setLevel(AREA1.Medium)
        }
        else if(params.Name == 'Night'){
            base.getVar('Presets').string = 'Night'
            setLevel(AREA1.High)
        }
        else if(params.Name == 'None'){
            base.getVar('Presets').string = 'None'  
            setLevel(AREA1.High)
        }
     }
    }


    /**
     * called when the device starts
     */
    const start = () => {
        status.value = 1
        initTcpClient()
        tcpClient.connect(config.port, config.host)
    }


    const setPower = (params) => {
        if (params.Name == 'On') {
            var data = Buffer.from([0x1C, 0x07, 0x09, 0x70, 0x00, 0x00, 0xFF])
            var alldata = checksum(data)
        }

    }
    const checksum = (checksumbuffer) => {
        var sum_buffer = 0
        for (var i = 0; i < 7; i++) {
            sum_buffer += checksumbuffer[i]
        }

        var csum_buffer = sum_buffer % 255
        var checksumvar = (((~(csum_buffer % 255) >>> 0)) + 2) % 255
        //  var checksum = ((((~(csum_buffer%255)>>>0)) + 2).toString(2)).substring(24)

        var buffer1 = Buffer.from([checksumvar])
        var total_data = Buffer.concat([checksumbuffer, buffer1])
        logger.silly(total_data.toString())
        return total_data
    }
  



    const initTcpClient = () => {
        if (!tcpClient) {
            tcpClient = host.createTCPClient()

            tcpClient.on('connect', () => {
                logger.silly(`TCPClient connected`)
                base.getVar('Status').string = 'Connected'
            })

            tcpClient.on('data', data => {
                data = data.toString()
                logger.silly(`TCPClient data: ${data}`)
                onFrame(data)
            })

            tcpClient.on('close', () => {
                logger.silly(`TCPClient closed`)
                disconnect()
            })

            tcpClient.on('error', err => {
                logger.error(`TCPClient: ${err}`)
                disconnect()
            })
        }
    }
    const disconnect = () => {
        base.getVar('Status').string = 'Disconnected'
        tcpClient && tcpClient.end()
    }

    const send = data => {
        // logger.silly(`TCPClient send: ${data}`)
        return tcpClient && tcpClient.write(data)
    }
    const sendDefer = data => {
        if (send(data)) {
            base.commandDefer()
        } else {
            base.commandError(`Data not sent`)
        }
    }
    const onFrame = data => {

    }


    /**
     * called when the device stops
     */
    const stop = () => {
    }

    /**
     * tick function which is called regularly
     */
    const tick = () => {
    }
  
    /**
     * exposes the public functions of the device
     */
    return {
        setup,
        start,
        stop,
        tick,
        setLevel,
        recallPreset,
        setPower,
        checksum
    }

}
