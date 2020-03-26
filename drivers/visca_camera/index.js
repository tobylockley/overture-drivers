//------------------------------------------------------------------------------------------ CONSTANTS
const CMD_DEFER_TIME = 3000         // Timeout when using commandDefer
const POLL_PERIOD = 5000            // Polling function interval
const TICK_PERIOD = 5000            // In-built tick interval
const TCP_TIMEOUT = 30000           // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 5000    // How long to wait before attempting to reconnect

let host
exports.init = _host => {
    host = _host
}

exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config
    let tcpClient

    let frameParser = host.createFrameParser()
    frameParser.setSeparator(0xFF)
    frameParser.on('data', data => onFrame(data))

    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)
        // Register polling functions
        base.setPoll({
            action: 'getPower',
            period: POLL_PERIOD,
            enablePollFn: isConnected,
            startImmediately: true
        })
    }

    function start() {
        initTcpClient()
    }

    function tick() {
        if (!tcpClient) initTcpClient()
    }

    function disconnect() {
        base.getVar('Status').string = 'Disconnected'
        base.getVar('Power').string = 'Off'
    }

    function stop() {
        disconnect()
        tcpClient && tcpClient.end()
        tcpClient = null
        base.stopPolling()
        base.clearPendingCommands()
    }

    function initTcpClient() {
        if (tcpClient) return // Do nothing if tcpClient already exists

        tcpClient = host.createTCPClient()
        tcpClient.setOptions({
            receiveTimeout: TCP_TIMEOUT,
            autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
        })

        tcpClient.on('connect', () => {
            logger.silly('TCPClient connected')
            base.getVar('Status').string = 'Connected'
            base.startPolling()
        })

        tcpClient.on('data', data => {
            // frameParser.push(data)
            onFrame(data)
        })

        tcpClient.on('close', () => {
            logger.silly('TCPClient closed')
            disconnect() // Triggered on timeout, this allows auto reconnect
        })

        tcpClient.on('error', err => {
            logger.error(`TCPClient: ${err}`)
            stop() // Throw out the tcpClient and get a fresh connection
        })

        tcpClient.connect(config.port, config.host)
    }

    //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
    function send(data) {
        logger.silly('TCPClient send:', bufferToHex(data))
        return tcpClient && tcpClient.write(data)
    }

    function sendDefer(data) {
        base.commandDefer(CMD_DEFER_TIME)
        if (!send(data)) base.commandError('Data not sent')
    }

    function onFrame(data) {
        let pending = base.getPendingCommand()
        if (pending && pending.params) {
            logger.debug(`onFrame (${pending.action}: `, pending.params, '):', bufferToHex(data))
        }
        else if (pending) {
            logger.debug(`onFrame (${pending.action}):`, bufferToHex(data))
        }
        else {
            logger.debug('onFrame (no pending actions):', bufferToHex(data))
        }

        if (pending.action === 'getPower') {
            if (data[2] === 0x02) {
                base.getVar('Power').string = 'On'
                base.commandDone()
            }
            else if (data[2] === 0x03) {
                base.getVar('Power').string = 'Off'
                base.commandDone()
            }
            else {
                logger.error('Unknown response')
            }
        }
        else {
            if (data[1] === 0x60 && data[2] === 0x02) {
                base.commandError('Syntax Error')
            }
            else if (data[1] === 0x61 && data[2] === 0x41) {
                base.commandError('Command Not Executable')
            }
            else if (data[1] === 0x41) {
                logger.silly(`ACK received - ${pending.action}:`, pending.params)
            }
            else if (data[1] === 0x51) {
                base.commandDone()
                if (pending.action === 'setPreset') {
                    base.getVar('SetPreset').string = pending.params.Name
                    setImmediate(() => base.getVar('SetPreset').value = 0) // Revert back to idle
                }
                else if (pending.action === 'recallPreset') {
                    base.getVar('RecallPreset').string = pending.params.Name
                    setImmediate(() => base.getVar('RecallPreset').value = 0) // Revert back to idle
                }
                else if (pending.action === 'setAutoTracking') {
                    base.getVar('AutoTracking').string = pending.params.Status
                    setImmediate(() => base.getVar('AutoTracking').value = 0) // Revert back to unknown
                }
            }
            else {
                logger.warn('onFrame data not processed:', bufferToHex(data))
            }
        }
    }

    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getPower() {
        const header = 0x80 + config.address
        sendDefer(Buffer.from([header, 0x09, 0x04, 0x00, 0xFF]))
    }

    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setPower(params) {
        const header = 0x80 + config.address
        if (params.Status == 'Off') sendDefer(Buffer.from([header, 0x01, 0x04, 0x00, 0x03, 0xFF]))
        else if (params.Status == 'On') sendDefer(Buffer.from([header, 0x01, 0x04, 0x00, 0x02, 0xFF]))
    }

    function setAutoTracking(params) {
        const header = 0x80 + config.address
        if (params.Status == 'Off') sendDefer(Buffer.from([header, 0x0A, 0x08, 0x01, 0x03, 0xFF]))
        else if (params.Status == 'On') sendDefer(Buffer.from([header, 0x0A, 0x08, 0x01, 0x02, 0xFF]))
    }

    function setPreset(params) {
        const header = 0x80 + config.address
        const match = params.Name.match(/\d+/)
        if (params.Name === 'Idle') {
            base.getVar('SetPreset').value = 0
        }
        else if (match) {
            const num = parseInt(match[0])
            sendDefer(Buffer.from([header, 0x01, 0x04, 0x3F, 0x01, num, 0xFF]))
        }
        else {
            logger.error(`Unknown preset name: ${params.Name}`)
        }
    }

    function recallPreset(params) {
        const header = 0x80 + config.address
        const match = params.Name.match(/\d+/)
        if (params.Name === 'Idle') {
            base.getVar('RecallPreset').value = 0
        }
        else if (match) {
            const num = parseInt(match[0])
            sendDefer(Buffer.from([header, 0x01, 0x04, 0x3F, 0x02, num, 0xFF]))
        }
        else {
            logger.error(`Unknown preset name: ${params.Name}`)
        }
    }

    function sendPanTiltCommand(params) {
        const header = 0x80 + config.address
        const codes = {
            'Stop': [0x03, 0x03],
            'Up': [0x03, 0x01],
            'Down': [0x03, 0x02],
            'Left': [0x01, 0x03],
            'Right': [0x02, 0x03],
            'Up Left': [0x01, 0x01],
            'Up Right': [0x02, 0x01],
            'Down Left': [0x01, 0x02],
            'Down Right': [0x02, 0x02]
        }
        const cmdCode = codes[params.Name]
        if (cmdCode) {
            sendDefer(Buffer.from([header, 0x01, 0x06, 0x01, config.panspeed, config.tiltspeed, cmdCode[0], cmdCode[1], 0xFF]))
        }
        else {
            logger.error(`Unknown pan tilt command name: ${params.Name}`)
        }
    }

    function sendZoomCommand(params) {
        const header = 0x80 + config.address
        const codes = {
            'Stop': 0x00,
            'In': 0x20 + config.zoomspeed,
            'Out': 0x30 + config.zoomspeed
        }
        const cmdCode = codes[params.Name]
        if (cmdCode !== undefined) {
            sendDefer(Buffer.from([header, 0x01, 0x04, 0x07, cmdCode, 0xFF]))
        }
        else {
            logger.error(`Unknown zoom command name: ${params.Name}`)
        }
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function isConnected() {
        return base.getVar('Status').string === 'Connected'
    }

    function bufferToHex(buffer) {
        return '[' + Array
            .from (new Uint8Array(buffer))
            .map (b => '0x' + b.toString(16).padStart (2, '0'))
            .join (' ') + ']'
    }

    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup,
        start,
        stop,
        tick,
        getPower,
        setPower,
        setAutoTracking,
        setPreset,
        recallPreset,
        sendPanTiltCommand,
        sendZoomCommand
    }
}
