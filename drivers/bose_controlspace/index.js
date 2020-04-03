//------------------------------------------------------------------------------------------ CONSTANTS
const CMD_DEFER_TIME = 3000         // Timeout when using commandDefer
const POLL_PERIOD = 5000            // Polling function interval
const TICK_PERIOD = 5000            // In-built tick interval
const TCP_TIMEOUT = 30000           // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 5000    // How long to wait before attempting to reconnect
const LEVEL_MIN = -60
const LEVEL_MAX = 12


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
        const defaults = { period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true }
        base.setPoll({ ...defaults, action: 'keepAlive' })
        // base.setPoll({...defaults, action: 'getSource', enablePollFn: isPoweredOn})

        // PRESETS
        let preset_enums = ['Idle']
        for (let preset of config.presets) {
            preset_enums.push(preset.name)
        }
        if (preset_enums.length > 1) {
            base.createVariable({
                name: 'Preset',
                type: 'enum',
                enums: preset_enums,
                perform: {
                    action: 'Recall Preset',
                    params: {
                        Name: '$string'
                    }
                }
            })
        }

        // GAIN MODULES
        for (let gain of config.gains) {
            base.createVariable({
                name: legalName('AudioMute_', gain.name),
                type: 'enum',
                enums: ['Off', 'On'],
                perform: {
                    action: 'Set Audio Mute',
                    params: {
                        Name: gain.name,
                        Status: '$string'
                    }
                }
            })

            base.createVariable({
                name: legalName('AudioLevel_', gain.name),
                type: 'integer',
                minimum: 0,
                maximum: 100,
                perform: {
                    action: 'Set Audio Level',
                    params: {
                        Name: gain.name,
                        Level: '$value'
                    }
                }
            })

            base.setPoll({ ...defaults, action: 'getAudioMute', params: {Name: gain.name} })
            base.setPoll({ ...defaults, action: 'getAudioLevel', params: {Name: gain.name} })
        }
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
            logger.warn(`Type of data: ${data.constructor.toString()}`)
            if (data.length === 1 && data[0] === 0x06) {
                let pending = base.getPendingCommand()
                pending && logger.debug(`TCP DATA, Pending action = ${pending.action}). Params = ${pending.params}`)
            }
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
        let match // Used for regex below
        let pending = base.getPendingCommand()

        if (pending && pending.action === 'keepAlive' && /IP/.test(data)) {
            base.commandDone()
        }
        else if (pending) {
            logger.debug(`onFrame (pending = ${pending.action}): ${data}`)

            if (pending.action === 'getAudioMute') {
                match = data.match(/GA"(.+?)">2=(.+?)/)
                if (match) {
                    let module_name = match[1]
                    let val = match[2]
                    let var_name = legalName('AudioMute_', module_name)
                    if (val === 'F') {
                        base.getVar(var_name).string = 'Off'
                    }
                    else if (val === 'O') {
                        base.getVar(var_name).string = 'On'
                    }
                    base.commandDone()
                }
                else {
                    base.commandError('Unexpected response')
                }
            }
            else if (pending.action === 'getAudioLevel') {
                match = data.match(/GA"(.+?)">1=([0-9-.]+)/)
                if (match) {
                    let module_name = match[1]
                    let val = parseFloat(match[2])
                    let var_name = legalName('AudioLevel_', module_name)
                    if (!isNaN(val)) {
                        val = mapNum(val, LEVEL_MIN, LEVEL_MAX, 0, 100)
                        base.getVar(var_name).value = parseInt(val)
                        base.commandDone()
                    }
                    else  {
                        base.commandError('unable to process level response')
                    }

                }
                else {
                    base.commandError('Unexpected response')
                }
            }
            else {
                logger.warn(`onFrame data not processed: ${data}`)
            }
        }
        else {
            logger.warn(`Received data but no pending command: ${data}`)
        }
    }

    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getAudioMute(params) {
        sendDefer(`GA"${params.Name}">2\r`)
    }

    function getAudioLevel(params) {
        sendDefer(`GA"${params.Name}">1\r`)
    }

    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setPower(params) {
        if (params.Status == 'Off') sendDefer('*SCPOWR0000000000000000\n')
        else if (params.Status == 'On') sendDefer('*SCPOWR0000000000000001\n')
    }

    function setAudioMute(params) {
        if (params.Status == 'Off') sendDefer(`SA"${params.Name}">2=F\r`)
        else if (params.Status == 'On') sendDefer(`SA"${params.Name}">2=O\r`)
    }

    function setAudioLevel(params) {
        let levelSend = mapNum(params.Level, 0, 100, LEVEL_MIN, LEVEL_MAX)
        levelSend = roundHalf(levelSend)
        sendDefer(`SA"${params.Name}">1=${levelSend}\r`)
    }

    function recallPreset(params) {
        let result = config.presets.find(entry => entry.name === params.Name)
        // Equivalent to: entry => entry.name === params.Name
        // function(entry) {
        //     return (entry.name === params.Name)
        // }

        if (result) {
            sendDefer(`SS ${result.number}\r`)
        }
        else {
            logger.error(`Preset not found: ${params.Name}`)
        }
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function mapNum(num, inMin, inMax, outMin, outMax) {
        return ((num - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin
    }

    function roundHalf(num) {
        return Math.round(num*2)/2
    }

    function isConnected() {
        return base.getVar('Status').string == 'Connected'
    }

    function keepAlive() {
        sendDefer('IP\r')
    }

    function legalName(prefix, name) {
        return prefix + name.replace(/[^A-Za-z0-9_]/g, '')
    }

    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup, start, stop, tick,
        getAudioMute, getAudioLevel,
        setPower, setAudioMute, setAudioLevel,
        keepAlive,
        recallPreset
    }
}
