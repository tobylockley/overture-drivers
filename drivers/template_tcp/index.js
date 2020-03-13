//---------------------------------------------------------------------------------------- CONSTANTS
const CMD_DEFER_TIME = 3000 // Timeout when using commandDefer
const TICK_PERIOD = 5000 // In-built tick interval
const TCP_TIMEOUT = 30000 // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 5000 // How long to wait before attempting to reconnect

let host
exports.init = _host => {
    host = _host
}

exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config
    let tcpClient

    let frameParser = host.createFrameParser()
    frameParser.setSeparator('\n')
    frameParser.on('data', data => onFrame(data))

    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)
        // Register polling functions
        let pollms = config.polltime * 1000
        base.setPoll({
            action: 'getPower',
            period: pollms,
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
            frameParser.push(data.toString())
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
        logger.silly(`TCPClient send: ${data}`)
        return tcpClient && tcpClient.write(data)
    }

    function sendDefer(data) {
        base.commandDefer(CMD_DEFER_TIME)
        if (!send(data)) base.commandError('Data not sent')
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
        sendDefer('*SEPOWR################\n')
    }

    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setPower(params) {
        if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n')
        else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n')
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
