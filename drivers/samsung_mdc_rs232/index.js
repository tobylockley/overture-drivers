const CMD_DEFER_TIME = 5000 // Timeout when using commandDefer
const TICK_PERIOD = 5000 // In-built tick interval
const POLL_PERIOD = 5000 // Polling frequency
const TCP_TIMEOUT = 30000 // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000 // How long to wait before attempting to reconnect

let host
exports.init = _host => {
    host = _host
}

exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config
    let tcpClient

    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)
        // Register polling functions
        const defaults = { period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true }
        base.setPoll({ ...defaults, action: 'getPower' })
        base.setPoll({ ...defaults, action: 'getSource', enablePollFn: isPoweredOn })
        base.setPoll({ ...defaults, action: 'getAudioLevel', enablePollFn: isPoweredOn })
        base.setPoll({ ...defaults, action: 'getAudioMute', enablePollFn: isPoweredOn })
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
    }

    //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
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
    }

    function send(data) {
        logger.silly(`TCPClient send: ${data}`)
        return tcpClient && tcpClient.write(data)
    }

    function sendDefer(data) {
        base.commandDefer(CMD_DEFER_TIME)
        if (!send(data)) base.commandError('Data not sent')
    }

    function onFrame(data) {
        const pending = base.getPendingCommand()
        logger.debug(`onFrame (pending = ${pending && pending.action}): ${data}`)

        // Checksum valid?
        const checksum = data.slice(1, -1).reduce((acc, val) => acc + val) & 0xFF
        if (data[data.length - 1] !== checksum) throw new Error('Checksum error on received data')

        // Ack/Nak check
        const ACK = data[4] === 'A'.charCodeAt(0)
        const NAK = data[4] === 'N'.charCodeAt(0)
        if (NAK) throw new Error(`Error code received: ${data[6]}`)

        if (ACK && pending.action == 'getPower') {
            base.getVar('Power').value = data[6]
            base.commandDone()
        }
        else if (ACK && pending.action == 'getSource') {
            switch (data[6]) {
            case 0x14: base.getVar('Sources').string = 'VGA'; break
            case 0x18: base.getVar('Sources').string = 'DVI'; break
            case 0x0C: base.getVar('Sources').string = 'HDMI'; break
            case 0x08: base.getVar('Sources').string = 'Component'; break
            default: throw new Error(`Unknown source code: ${data[6].toString(16)}`)
            }
            base.commandDone()
        }
        else if (ACK && pending.action == 'getAudioLevel') {
            base.getVar('AudioLevel').value = data[6]
            base.commandDone()
        }
        else if (ACK && pending.action == 'getAudioMute') {
            base.getVar('AudioMute').value = data[6]
            base.commandDone()
        }
        else if (ACK && pending.action == 'setPower') {
            base.getVar('Power').string = pending.params.Status
            base.commandDone()
        }
        else if (ACK && pending.action == 'selectSource') {
            base.getVar('Sources').string = pending.params.Name
            base.commandDone()
        }
        else if (ACK && pending.action == 'setAudioLevel') {
            base.getVar('AudioLevel').value = pending.params.Level
            base.commandDone()
        }
        else if (ACK && pending.action == 'setAudioMute') {
            base.getVar('AudioMute').string = pending.params.Status
            base.commandDone()
        }
        else {
            logger.warn('WARNING: Could not process frame')
        }
    }

    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getPower() {
        sendWithChecksum([0xAA, 0x11, config.id, 0x00])
    }

    function getSource() {
        sendWithChecksum([0xAA, 0x14, config.id, 0x00])
    }

    function getAudioLevel() {
        sendWithChecksum([0xAA, 0x12, config.id, 0x00])
    }

    function getAudioMute() {
        sendWithChecksum([0xAA, 0x13, config.id, 0x00])
    }

    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setPower(params) {
        if (params.Status == 'Off') sendWithChecksum([0xAA, 0x11, config.id, 0x01, 0x00])
        else if (params.Status == 'On') sendWithChecksum([0xAA, 0x11, config.id, 0x01, 0x01])
    }

    function selectSource(params) {
        if (params.Name === 'VGA') {
            sendWithChecksum([0xAA, 0x14, config.id, 0x01, 0x14])
        }
        else if (params.Name === 'DVI') {
            sendWithChecksum([0xAA, 0x14, config.id, 0x01, 0x18])
        }
        else if (params.Name === 'HDMI') {
            sendWithChecksum([0xAA, 0x14, config.id, 0x01, 0x0C])
        }
        else if (params.Name === 'Component') {
            sendWithChecksum([0xAA, 0x14, config.id, 0x01, 0x08])
        }
        else {
            logger.error(`Unrecognized source: ${params.Name}`)
        }
    }

    function setAudioLevel(params) {
        sendWithChecksum([0xAA, 0x12, config.id, 0x01, params.Level])
    }

    function setAudioMute(params) {
        if (params.Status == 'Off') sendWithChecksum([0xAA, 0x13, config.id, 0x01, 0x00])
        else if (params.Status == 'On') sendWithChecksum([0xAA, 0x13, config.id, 0x01, 0x01])
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function isConnected() {
        return base.getVar('Status').string === 'Connected'
    }

    function isPoweredOn() {
        return isConnected() && base.getVar('Power').string === 'On'
    }

    function sendWithChecksum(packet) {
        // Slice off first element (header), add all bytes, then take lowest 8 bits
        const checksum = packet.slice(1).reduce((acc, val) => acc + val) & 0xFF
        sendDefer(Buffer.from([...packet, checksum]))
    }

    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup,
        start,
        stop,
        tick,
        getPower,
        getSource,
        getAudioLevel,
        getAudioMute,
        setPower,
        selectSource,
        setAudioLevel,
        setAudioMute
    }
}
