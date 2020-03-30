'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const TCP_TIMEOUT = 30000          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000   // How long to wait before attempting to reconnect

const POSSIBLE_SOURCES = {
    '11': 'RGB1',
    '12': 'RGB2',
    '13': 'RGB3',
    '14': 'RGB4',
    '15': 'RGB5',
    '16': 'RGB6',
    '17': 'RGB7',
    '18': 'RGB8',
    '19': 'RGB9',
    '21': 'VIDEO1',
    '22': 'VIDEO2',
    '23': 'VIDEO3',
    '24': 'VIDEO4',
    '25': 'VIDEO5',
    '26': 'VIDEO6',
    '27': 'VIDEO7',
    '28': 'VIDEO8',
    '29': 'VIDEO9',
    '31': 'DIGITAL1',
    '32': 'DIGITAL2',
    '33': 'DIGITAL3',
    '34': 'DIGITAL4',
    '35': 'DIGITAL5',
    '36': 'DIGITAL6',
    '37': 'DIGITAL7',
    '38': 'DIGITAL8',
    '39': 'DIGITAL9',
    '41': 'STORAGE1',
    '42': 'STORAGE2',
    '43': 'STORAGE3',
    '44': 'STORAGE4',
    '45': 'STORAGE5',
    '46': 'STORAGE6',
    '47': 'STORAGE7',
    '48': 'STORAGE8',
    '49': 'STORAGE9',
    '51': 'NETWORK1',
    '52': 'NETWORK2',
    '53': 'NETWORK3',
    '54': 'NETWORK4',
    '55': 'NETWORK5',
    '56': 'NETWORK6',
    '57': 'NETWORK7',
    '58': 'NETWORK8',
    '59': 'NETWORK9'
}

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


    // ------------------------------ SETUP FUNCTIONS ------------------------------

    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)

        // Register polling functions
        base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
        base.setPoll({ action: 'getSource', period: POLL_PERIOD, enablePollFn: isPoweredOn, startImmediately: true })
        base.setPoll({ action: 'getAVMute', period: POLL_PERIOD, enablePollFn: isPoweredOn, startImmediately: true })
        base.setPoll({ action: 'getAvailableSources', period: 60000, enablePollFn: isPoweredOn, startImmediately: true })
    }

    function start() {
        initTcpClient()
    }

    function disconnect() {
        base.getVar('Status').string = 'Disconnected'  // Triggered on timeout, this allows auto reconnect
        base.stopPolling()
        base.clearPendingCommands()
    }

    function stop() {
        disconnect()
        tcpClient && tcpClient.end()
        tcpClient = null
    }

    function tick() {
        if (!tcpClient) initTcpClient()
    }

    function initTcpClient() {
        if (tcpClient) return  // Return if tcpClient already exists

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
            stop()  // Throw out the tcpClient and get a fresh connection
        })
    }


    // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

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

        let match = data.match(/%1(.*?)=(.*?)\r/)
        let cmd = match && match[1]
        let val = match && match[2]
        let val_int = val && parseInt(val)
        if (match && val.includes('ERR')) {
            if (val === 'ERR1') {
                logger.error('PJLink Error: Undefined command')
            }
            else if (val === 'ERR2') {
                logger.error('PJLink Error: Out of parameter')
            }
            else if (val === 'ERR3') {
                logger.error('PJLink Error: Unavailable at this time')
            }
            else if (val === 'ERR4') {
                logger.error('PJLink Error: Projector/Display failure')
            }
            else {
                logger.error('Unknown PJLink Error')
            }
            pending && base.commandError('Error response from device')
        }
        else if (match) {
            if (pending.action === 'getPower' && cmd === 'POWR') {
                base.getVar('Power').value = val_int // 0=off, 1=on, 2=cooling, 3=warming
                base.commandDone()
            }
            else if (pending.action === 'getSource' && cmd === 'INPT') {
                // Get source from list
                let source_name = POSSIBLE_SOURCES[val]
                if (source_name && base.getVar('Sources').enums.includes(source_name)) {
                    base.getVar('Sources').string = source_name
                    base.commandDone()
                }
                else {
                    base.commandError('Error getting current source')
                }
            }
            else if (pending.action === 'getAVMute' && cmd === 'AVMT') {
                // Decipher audio/video mute status
                if (val_int == 11) {
                    base.getVar('AudioMute').value = 0
                    base.getVar('VideoMute').value = 1
                    base.commandDone()
                }
                else if (val_int == 21) {
                    base.getVar('AudioMute').value = 1
                    base.getVar('VideoMute').value = 0
                    base.commandDone()
                }
                else if (val_int == 31) {
                    base.getVar('AudioMute').value = 1
                    base.getVar('VideoMute').value = 1
                    base.commandDone()
                }
                else if (val_int == 30) {
                    base.getVar('AudioMute').value = 0
                    base.getVar('VideoMute').value = 0
                    base.commandDone()
                }
                else {
                    logger.error(`onFrame, unknown AVMT value: ${val}`)
                }
            }
            else if (pending.action === 'getAvailableSources' && cmd === 'INST') {
                // Construct sources enum
                let sources = []
                for (let id of val.split(' ')) {
                    let source_name = POSSIBLE_SOURCES[id]
                    source_name && sources.push(source_name)
                }
                base.getVar('Sources').enums = sources
                base.commandDone()
            }
            else if (pending.action === 'setPower' && cmd === 'POWR' && val === 'OK') {
                if (pending.params.Status === 'Off') {
                    base.getVar('Power').value = 2  // Cooling down
                    base.commandDone()
                }
                else if (pending.params.Status === 'On') {
                    base.getVar('Power').value = 3  // Warming up
                    base.commandDone()
                }
            }
            else if (pending.action === 'selectSource' && cmd === 'INPT' && val === 'OK') {
                base.getVar('Sources').string = pending.params.Name
                base.commandDone()
            }
            else if (pending.action === 'setAudioMute' && cmd === 'AVMT' && val === 'OK') {
                base.getVar('AudioMute').string = pending.params.Status
                base.commandDone()
            }
            else if (pending.action === 'setVideoMute' && cmd === 'AVMT' && val === 'OK') {
                base.getVar('VideoMute').string = pending.params.Status
                base.commandDone()
            }
            else {
                logger.warn(`onFrame data matched regex but not processed: ${data}`)
            }
        }
        else {
            logger.silly(`onFrame data not processed: ${data}`)
        }
    }


    // ------------------------------ GET FUNCTIONS ------------------------------
    function getPower() {
        sendDefer('%1POWR ?\r')
    }

    function getSource() {
        sendDefer('%1INPT ?\r')
    }

    function getAVMute() {
        sendDefer('%1AVMT ?\r')
    }

    function getAvailableSources() {
        sendDefer('%1INST ?\r')
    }


    // ------------------------------ SET FUNCTIONS ------------------------------
    function setPower(params) {
        if (params.Status == 'Off') sendDefer('%1POWR 0\r')
        else if (params.Status == 'On') sendDefer('%1POWR 1\r')
        else logger.warn('setPower only accepts "Off" or "On"')
    }

    function selectSource(params) {
        for (let id in POSSIBLE_SOURCES) {
            if (POSSIBLE_SOURCES[id] === params.Name) {
                sendDefer(`%1INPT ${id}\r`)
                return
            }
        }
        logger.error(`selectSource: could not find ${params.Name} in possible sources`)
    }

    function setAudioMute(params) {
        if (params.Status == 'Off') sendDefer('%1AVMT 20\r')
        else if (params.Status == 'On') sendDefer('%1AVMT 21\r')
        else logger.warn('setAudioMute only accepts "Off" or "On"')
    }

    function setVideoMute(params) {
        if (params.Status == 'Off') sendDefer('%1AVMT 10\r')
        else if (params.Status == 'On') sendDefer('%1AVMT 11\r')
        else logger.warn('setVideoMute only accepts "Off" or "On"')
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function isConnected() {
        return base.getVar('Status').string === 'Connected'
    }

    function isPoweredOn() {
        return isConnected() && base.getVar('Power').string === 'On'
    }


    // ------------------------------ EXPORTED FUNCTIONS ------------------------------
    return {
        setup, start, stop, tick,
        getPower, getSource, getAVMute, getAvailableSources,
        setPower, selectSource, setAudioMute, setVideoMute
    }
}