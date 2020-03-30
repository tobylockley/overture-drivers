// exported init function
let logger
let host

exports.init = _host => {
    host = _host
    logger = host.logger
}

// exported createDevice function
exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config
    let tcpClient
    let feedbackCommands = []
    let lastFeedbackIndex = 0

    //SET POLLING COMMANDS
    base.setPoll('getFeedback', 750)

    //BASE COMMANDS-------------------------------------------------------
    const setup = _config => {
        config = _config
        feedbackCommands.push(getPower)
        feedbackCommands.push(getSource)

    }

    // connect to the device when start()
    const start = () => {
        initTcpClient()
        base.performInPriority('connect')
        base.startPolling()
    }

    // disconnect from the device when stop()
    const stop = () => {
        tcpClient.end()
        disconnect()
    }
    //END BASE COMMANDS-----------------------------------------------------------

    //DEVICE COMMANDS-----------------------------------------------------------
    const setPower = (params) => {
        let message
        if (params.status == "On") {
            message = Buffer.from(["(", "PWR", " ", 1, ")"])
        }
        else if (params.status == "Off") {
            message = Buffer.from(["(", "PWR", " ", 0, ")"])
        }
        sendDefer(message)
    }

    const selectSource = (params) => {
        let message
        switch (params.Name) {
            case "VGA 1":
                message = 1
                break
            case "VGA 2":
                message = 2
                break
            case "HDMI 1":
                message = 3
                break
            case "HDMI 2":
                message = 4
                break
            case "Video":
                message = 5
                break
            case "Multimedia":
                message = 6
                break
        }
        sendDefer(Buffer.from(["(", "SIN", " ", message, ")"]))
    }

    const setVideoMute = (params) => {
        let message
        if (params.status == "On") {
            message = Buffer.from(["(", "AVM", " ", 1, ")"])
        }
        else if (params.status == "Off") {
            message = Buffer.from(["(", "AVM", " ", 0, ")"])
        }
        sendDefer(message)
    }

    //POLL COMMANDS--------------------------------------------
    const getFeedback = () => {
        const command = feedbackCommands[lastFeedbackIndex]
        if (command) {
            lastFeedbackIndex++
            if (lastFeedbackIndex >= feedbackCommands.length) {
                lastFeedbackIndex = 0
            }
            sendDefer()
        } else {
            lastFeedbackIndex = 0
            base.commandError('Command not found');
        }
    }

    const getPower = () => {
        let msg = Buffer.from(["PWR", "?"])
        if (sendDefer(msg)) base.commandDefer(5000)
        else base.commandError('Not Sent')
    }

    const getSource = () => {
        let msg = Buffer.from(["SIN", "?"])
        if (sendDefer(msg)) base.commandDefer(5000)
        else base.commandError('Not Sent')
    }

    //UTIL COMMANDS---------------------------------	
    const connect = () => {
        tcpClient.connect(config.port, config.host)
        base.commandDefer(2000)
    }

    const disconnect = () => {
        base.stopPolling()
        base.clearPendingCommands()
    }
    const reconnect = () => {
        tcpClient.connect(config.port, config.host)
    }
    const send = data => {
        return tcpClient && tcpClient.write(data)
    }
    const sendDefer = data => {
        if (send(data)) {
            base.commandDefer(400)
        } else {
            base.commandError('Data not sent')
        }
    }

    // create a tcp client and handle events
    const initTcpClient = () => {
        if (!tcpClient) {
            tcpClient = host.createTCPClient()
            tcpClient.on('connect', () => {
                logger.debug("TCP Connection Open")
                base.getVar('Status').string = "Connected"
                //connect()
            })
            tcpClient.on('data', (data) => {
                let frame = data.toString('hex')
                logger.debug(frame)
                frameParser.push(frame)
            })

            tcpClient.on('close', () => {
                logger.debug("TCP Connection Closed")
                disconnect()
            })

            tcpClient.on('error', (err) => {
                logger.debug("TCP Connection Error")
                //base.getVar('Status').value = 0
                disconnect()
                //reconnect()
            })
        }
    }

    const onFrame = (data) => {
        if (data.includes("PWR!")) {
            if (data.substr(data.indexOf("PWR!") + 4) == 1) {
                base.getVar('Power').string = "On"
            }
            else {
                base.getVar('Power').string = "Off"
            }
        }
        else if (data.includes("SIN!")) {
            switch (data.substr(data.indexOf("SIN!") + 4)) {
                case "1":
                    base.getVar('Sources').string = "VGA1"
                    break
                case "2":
                    base.getVar('Sources').string = "VGA2"
                    break
                case "3":
                    base.getVar('Sources').string = "HDMI1"
                    break
                case "4":
                    base.getVar('Sources').string = "HDMI2"
                    break
                case "5":
                    base.getVar('Sources').string = "Video"
                    break
                case "6":
                    base.getVar('Sources').string = "Multimedia"
                    break
            }
        }
        base.commandDone()
    }

    return {
        setup,
        start,
        stop,

        connect,
        disconnect,
        sendDefer,
        send,

        setPower,
        selectSource,
        setVideoMute,

        getFeedback,
        getPower,
        getSource
    }
}
