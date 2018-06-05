let host
exports.init = _host => {
    host = _host
}

exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config
    let tcpClient

    let api = require('./nec_api.js')

    let firstFrame = ''
    let secondFrame = ''
    let fullFrame = ''

    // Buffers for command list

    const setup = _config => {
        config = _config
        base.setPoll('Get Power', 5000)
        base.setPoll('Get Temp', 5000)
    }

    const start = () => {
        initTcpClient()
        tcpClient.connect(config.port, config.host)
 
        base.startPolling()
    }

    const stop = () => {
        disconnect()
    }

    const getPower = () => {
        var actualMonitorID = 0x40 + config.display_id;
        var header_command = Buffer.from([0x01, 0x30, actualMonitorID, 0x30, 0x41, 0x30, 0x36])
        var power_data = Buffer.from([0x02, 0x30, 0x31, 0x44, 0x36, 0x03]);

        var calcBuffer = Buffer.concat([header_command, power_data])
        var tempValue = calcBuffer[1]

        for (let i = 1; i < calcBuffer.length - 1; i++) {
            var BCC = tempValue ^ calcBuffer[i + 1]
            tempValue = BCC
        }

        var BCCBuffer = Buffer.from([BCC])
        var Delimiter = Buffer.from([0x0D])

        var total_buffer = Buffer.concat([calcBuffer, BCCBuffer, Delimiter])

        sendDefer(total_buffer)
    }

    const getTemp = () => {
        var actualMonitorID = 0x40 + config.display_id;
        var header_command = Buffer.from([0x01, 0x30, actualMonitorID, 0x30, 0x45, 0x30, 0x41])
        var temp_select_data = Buffer.from([0x02, 0x30, 0x32, 0x37, 0x38, 0x30, 0x30, 0x30, 0x31, 0x03])

        var calcBuffer = Buffer.concat([header_command, temp_select_data])
        var tempValue = calcBuffer[1]

        for (let i = 1; i < calcBuffer.length - 1; i++) {
            var BCC = tempValue ^ calcBuffer[i + 1]
            tempValue = BCC
        }

        var BCCBuffer = Buffer.from([BCC])
        var Delimiter = Buffer.from([0x0D])

        var total_buffer = Buffer.concat([calcBuffer, BCCBuffer, Delimiter])

        sendDefer(total_buffer)
        setTimeout(function () { delaytempsend(); }, 1000);
    }

    const delaytempsend = () => {
        var actualMonitorID = 0x40 + config.display_id;
        var header_command = Buffer.from([0x01, 0x30, actualMonitorID, 0x30, 0x43, 0x30, 0x46])
        var temp_select_data = Buffer.from([0x02, 0x30, 0x32, 0x37, 0x39, 0x03])

        var calcBuffer = Buffer.concat([header_command, temp_select_data])
        var tempValue = calcBuffer[1]

        for (let i = 1; i < calcBuffer.length - 1; i++) {
            var BCC = tempValue ^ calcBuffer[i + 1]
            tempValue = BCC
        }

        var BCCBuffer = Buffer.from([BCC])
        var Delimiter = Buffer.from([0x0D])

        var total_buffer = Buffer.concat([calcBuffer, BCCBuffer, Delimiter])

        sendDefer(total_buffer)

    }




    // const setPower = params => {
    //     if (params.Status == 'Off') {
    //         var Off_Command = new Buffer([0xAA, 0x11, config.display_id, 0x01, 0x00, (0x12 + config.display_id)])
    //         sendDefer(Off_Command)
    //     }
    //     else if (params.Status == 'On') {
    //         var On_Command = new Buffer([0xAA, 0x11, config.display_id, 0x01, 0x01, (0x13 + config.display_id)])
    //         sendDefer(On_Command)
    //     }
    // }

    // const selectSource = params => {
    //     if (params.Name == 'HDMI1') {
    //         var HDMI1_Command = new Buffer([0xAA, 0x14, config.display_id, 0x01, 0x21, (0x36 + + config.display_id)])
    //         sendDefer(HDMI1_Command)
    //     }
    //     else if (params.Name == 'HDMI2') {
    //         var HDMI2_Command = new Buffer([0xAA, 0x14, config.display_id, 0x01, 0x23, (0x38 + config.display_id)])
    //         sendDefer(HDMI2_Command)
    //     }
    //     else if (params.Name == 'DVI') {
    //         var DVI_Command = new Buffer([0xAA, 0x14, config.display_id, 0x01, 0x18, (0x2D + config.display_id)])
    //         sendDefer(DVI_Command)
    //     }
    // }


    const initTcpClient = () => {
        if (!tcpClient) {
            tcpClient = host.createTCPClient()

            tcpClient.on('connect', () => {
                logger.silly(`TCPClient connected`)
                base.getVar('Status').string = 'Connected'
            })

            tcpClient.on('data', data => {
                //data = data.toString()
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

    const sendDefer = data => {
        if (send(data)) {
            base.commandDefer(250)
        } else {
            base.commandError(`Data not sent`)
        }
    }

    const send = data => {
        // logger.silly(`TCPClient send: ${data}`)
        return tcpClient && tcpClient.write(data)
    }

    const onFrame = data => {
        if (data[data.length - 1] != 0x0D) {
            firstFrame = (firstFrame + data.toString())
        }
        else if (data[data.length - 1] == 0x0D) {
            secondFrame = data.toString()
            fullFrame = (firstFrame + secondFrame)
            secondFrame = ''
            firstFrame = ''
            const dataBuffer = Buffer.from(fullFrame)
            // logger.silly(fullFrame);

            // Check Full Frames against variables:
            if (fullFrame.indexOf('D6000004000') > 1) {
                var datavalue = fullFrame.substr((fullFrame.indexOf('D6000004000') + 11), 1)
                // logger.silly(datavalue)
                if (datavalue == '1') {
                    base.getVar('Power').string = "On"
                }
                else if (datavalue == '2') {
                    base.getVar('Power').string = "Stand-by"
                }
                else if (datavalue == '3') {
                    base.getVar('Power').string = "Suspend"
                }
                else if (datavalue == '4') {
                    base.getVar('Power').string = "Off"
                }
            }
            else if (fullFrame.indexOf('00027900') > 1) {
                var datavalue = fullFrame.substr((fullFrame.indexOf('00027900') + 14), 2)
                var tens = parseInt(datavalue)
                 //logger.silly(tens/2)
                base.getVar('Temperature').value = tens/2
            }
            else {
            }
            base.commandDone()
        }
    }

    return {
        setup, start, stop,
        getPower, getTemp,
        //  setPower, selectSource,
    }
}



