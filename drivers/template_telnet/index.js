//------------------------------------------------------------------------------------------ CONSTANTS
const CMD_DEFER_TIME = 3000         // Timeout when using commandDefer
const POLL_PERIOD = 5000            // Polling function interval
const TICK_PERIOD = 5000            // In-built tick interval
const TELNET_TIMEOUT = 10000        // Socket will timeout after specified milliseconds of inactivity
const SEND_TIMEOUT = 1000           // Timeout when using telnet send function

let host
exports.init = _host => {
    host = _host
}

exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config

    let Telnet = require('telnet-client')
    let telnetClient

    let frameParser = host.createFrameParser()
    frameParser.setSeparator('\n')
    frameParser.on('data', data => onFrame(data))

    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)
        // Register polling functions
        const defaults = {period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true}
        base.setPoll({...defaults, action: 'getPower'})
        base.setPoll({...defaults, action: 'getSource', enablePollFn: isPoweredOn})
    }

    function start() {
        initTelnetClient()
    }

    function tick() {
        if (!telnetClient) initTelnetClient()
    }

    function disconnect() {
        base.getVar('Status').string = 'Disconnected'
        base.getVar('Power').string = 'Off'
    }

    function stop() {
        disconnect()
        telnetClient && telnetClient.end()
        telnetClient = null
        base.stopPolling()
        base.clearPendingCommands()
    }

    function initTelnetClient() {
        if (!telnetClient) {
            telnetClient = new Telnet()
            logger.silly(`Attempting telnet connection to: ${config.host}:${config.port}`)

            telnetClient.connect({
                host: config.host,
                port: config.port,
                timeout: TELNET_TIMEOUT,
                initialLFCR: true,
                sendTimeout: SEND_TIMEOUT
            })

            telnetClient.on('connect', function () {
                logger.silly('Telnet connected!')
                base.getVar('Status').string = 'Connected'
                base.startPolling()
            })

            telnetClient.on('data', (chunk) => {
                frameParser.push(chunk)
            })

            telnetClient.on('close', function () {
                logger.silly('telnet closed')
                stop()
            })

            telnetClient.on('error', err => {
                logger.error(`telnetClient: ${err}`)
                stop()
            })
        }
    }

    //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
    function sendDefer(data) {
        base.commandDefer(CMD_DEFER_TIME)
        telnetClient.send(data).then(recvd => {
            // Handled in onFrame
            logger.silly(`Telnet send OK (${data}): ${recvd}`)
        }, err => {
            base.commandError(`Telnet send error: ${err}`)
        })
    }

    function onFrame(data) {
        let pending = base.getPendingCommand()
        logger.debug(`onFrame (pending = ${pending && pending.action}): ${data}`)
        let match = data.match(/POWR(\d+)/)
        if (match && pending) {
            if (match && pending.action == 'getPower') {
                base.getVar('Power').value = parseInt(match[1]) // 0 = Off, 1 = On
                base.commandDone()
            }
            else if (match && pending.action == 'setPower') {
                base.getVar('Power').string = pending.params.Status
                base.commandDone()
            }
        }
        else if (match && !pending) {
            logger.warn(`Received data but no pending command: ${data}`)
        }
        else {
            logger.warn(`onFrame data not processed: ${data}`)
        }
    }

    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getPower() {
        sendDefer('get power\r\n')
    }

    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setPower(params) {
        if (params.Status == 'Off') sendDefer('set power 0\n')
        else if (params.Status == 'On') sendDefer('set power 1\n')
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function isConnected() {
        return base.getVar('Status').string == 'Connected'
    }

    function isPoweredOn() {
        return isConnected() && base.getVar('Power').string == 'On'
    }

    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup,
        start,
        stop,
        tick,
        getPower,
        setPower
    }
}
