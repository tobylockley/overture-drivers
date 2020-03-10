const CMD_DEFER_TIME = 3000 // Timeout when using commandDefer
const TICK_PERIOD = 5000 // In-built tick interval
const TCP_TIMEOUT = 10000 // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000 // How long to wait before attempting to reconnect

const GET_PWR = String.fromCharCode(0x6C)  // l
const GET_SRC = String.fromCharCode(0x6A)  // j
const GET_VOL = String.fromCharCode(0x66)  // f
const GET_MUT = String.fromCharCode(0x67)  // g
const SET_PWR = String.fromCharCode(0x21)  // !
const SET_SRC = String.fromCharCode(0x22)  // "
const SET_VOL = String.fromCharCode(0x35)  // 5
const SET_MUT = String.fromCharCode(0x36)  // 6

let host
exports.init = _host => {
    host = _host
}

exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config
    let tcpClient

    let frameParser = host.createFrameParser()
    frameParser.setSeparator('\r')
    frameParser.on('data', data => onFrame(data))

    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)
        // Register polling functions
        let poll_ms = config.polltime * 1000 // Convert from seconds to milliseconds
        setPoll('getPower', poll_ms, isConnected)
        setPoll('getSource', poll_ms, isPoweredOn)
        setPoll('getAudioLevel', poll_ms, isPoweredOn)
        setPoll('getAudioMute', poll_ms, isPoweredOn)
    }

    function start() {
        if (config.simulation) base.getVar('Status').string = 'Connected'
        else initTcpClient()
    }

    function tick() {
        if (!config.simulation && !tcpClient) initTcpClient()
    }

    function disconnect() {
        base.getVar('Status').string = 'Disconnected'
        base.stopPolling()
        base.clearPendingCommands()
    }

    function stop() {
        disconnect()
        tcpClient && tcpClient.end()
        tcpClient = null
    }

    function initTcpClient() {
        if (tcpClient) return // Return if tcpClient already exists

        tcpClient = host.createTCPClient()
        tcpClient.setOptions({
            receiveTimeout: TCP_TIMEOUT,
            autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
        })
        tcpClient.connect(config.port, config.host)

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
    }

    //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
    function send(data) {
        logger.debug(`TCPClient send: ${data}`)
        return tcpClient && tcpClient.write(data)
    }

    function sendDefer(data) {
        base.commandDefer(CMD_DEFER_TIME)
        if (!send(data)) {
            base.commandError('Data not sent')
        }
    }

    function onFrame(data) {
        let match // Used for regex matching below
        const pending = base.getPendingCommand()
        logger.debug(`onFrame (pending = ${pending && pending.action}): ${data}`)

        if ((match = data.match(/.(\d\d)(.)(.?)(\d*?)\r/))) {
            const id = parseInt(match[1])
            const type = match[2]
            const cmd = match[3]
            const val = match[4]

            logger.silly(`ID: ${id}   TYPE: ${type}   CMD: ${cmd}   VAL: ${val}`)

            // DO SOME BASIC ERROR CHECKING
            if (id != config.id) {
                logger.error('Device response does not match configured TV ID')
            }
            else if (pending && type === '-') {
                base.commandError('Device responded with error')
            }
            else if (!pending) {
                logger.warn('onFrame: No pending command, data not processed')
            }

            // GET RESPONSES
            else if (pending.action === 'getPower' && cmd === GET_PWR && type === 'r') {
                base.getVar('Power').value = parseInt(val)
                base.commandDone()
            }
            else if (pending.action === 'getSource' && cmd === GET_SRC && type === 'r') {
                let sourceList = {
                    '000': 'VGA',
                    '001': 'HDMI1',
                    '002': 'HDMI2',
                    '021': 'HDMI3',
                    '022': 'HDMI4',
                    '101': 'Android',
                    '102': 'OPS',
                }
                if (Object.keys(sourceList).includes(val)) {
                    base.getVar('Sources').string = sourceList[val]
                    base.commandDone()
                }
                else {
                    logger.warn('onFrame: Unrecognised source value')
                }
            }
            else if (pending.action === 'getAudioLevel' && cmd === GET_VOL && type === 'r') {
                base.getVar('AudioLevel').value = parseInt(val)
                base.commandDone()
            }
            else if (pending.action === 'getAudioMute' && cmd === GET_MUT && type === 'r') {
                base.getVar('AudioMute').value = parseInt(val)
                base.commandDone()
            }

            // SET RESPONSES
            else if (pending.action === 'setPower' && type === '+') {
                base.getVar('Power').string = pending.params.Status
                base.commandDone()
            }
            else if (pending.action === 'selectSource' && type === '+') {
                base.getVar('Sources').string = pending.params.Name
                base.commandDone()
            }
            else if (pending.action === 'setAudioLevel' && type === '+') {
                base.getVar('AudioLevel').value = pending.params.Level
                base.commandDone()
            }
            else if (pending.action === 'setAudioMute' && type === '+') {
                base.getVar('AudioMute').string = pending.params.Status
                base.commandDone()
            }

            else {
                logger.warn('onFrame: Unable to process data')
            }
        }
        else {
            logger.warn('Unrecognised response from device')
        }
    }

    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getPower() {
        benqGet(GET_PWR)
    }

    function getSource() {
        benqGet(GET_SRC)
    }

    function getAudioLevel() {
        benqGet(GET_VOL)
    }

    function getAudioMute() {
        benqGet(GET_MUT)
    }

    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setPower(params) {
        if (config.simulation) {
            base.getVar('Power').string = params.Status
            return
        }

        if (params.Status == 'Off') benqSet(SET_PWR, 0)
        else if (params.Status == 'On') benqSet(SET_PWR, 1)
    }

    function selectSource(params) {
        if (config.simulation) {
            base.getVar('Sources').string = params.Name
            return
        }

        if (params.Name === 'VGA') benqSet(SET_SRC, 0)
        else if (params.Name === 'HDMI1') benqSet(SET_SRC, 1)
        else if (params.Name === 'HDMI2') benqSet(SET_SRC, 2)
        else if (params.Name === 'HDMI3') benqSet(SET_SRC, 21)
        else if (params.Name === 'HDMI4') benqSet(SET_SRC, 22)
    }

    function setAudioLevel(params) {
        if (config.simulation) {
            base.getVar('AudioLevel').value = params.Level
            return
        }

        benqSet(SET_VOL, params.Level)
    }

    function setAudioMute(params) {
        if (config.simulation) {
            base.getVar('AudioMute').string = params.Status
            return
        }

        if (params.Status == 'Off') benqSet(SET_MUT, 0)
        else if (params.Status == 'On') benqSet(SET_MUT, 1)
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function isConnected() {
        return base.getVar('Status').string === 'Connected'
    }

    function isPoweredOn() {
        return isConnected() && base.getVar('Power').string === 'On'
    }

    function setPoll(action, period, enableFn) {
        base.setPoll({
            action: action,
            period: period,
            enablePollFn: enableFn,
            startImmediately: true
        })
    }

    function benqGet(cmd) {
    // Send get request to BenQ panel, only works for 3 byte responses
        if (!(host.lodash.isString(cmd) && cmd.length === 1)) {
            throw new TypeError('cmd must be a single character')
        }
        let id = config.id.toString().padStart(2, '0')
        sendDefer(`8${id}g${cmd}000\r`)
    }

    function benqSet(cmd, val) {
        if (!(host.lodash.isString(cmd) && cmd.length === 1)) {
            throw new TypeError('cmd must be a single character')
        }
        if (!host.lodash.isInteger(val)) {
            throw new TypeError('val must be an integer')
        }
        val = val.toString().padStart(3, '0')
        let id = config.id.toString().padStart(2, '0')
        let msg = `${id}s${cmd}${val}`
        sendDefer(`${msg.length + 1}${msg}\r`)
    }

    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup, start, stop, tick,
        getPower, getSource, getAudioLevel, getAudioMute,
        setPower, selectSource, setAudioLevel, setAudioMute
    }
}
