//------------------------------------------------------------------------------------------ CONSTANTS
const CMD_DEFER_TIME = 3000         // Timeout when using commandDefer
const POLL_PERIOD = 5000            // Polling function interval
const TICK_PERIOD = 5000            // In-built tick interval
const TCP_TIMEOUT = 30000           // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 5000    // How long to wait before attempting to reconnect
const LEVEL_MIN = -60
const LEVEL_MAX = 12
const EQLEVEL_MIN = -15
const EQLEVEL_MAX = 15
const EQLEVEL_RANGE = EQLEVEL_MAX - EQLEVEL_MIN


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

        // Source MODULES
        let source_enums = ['Idle']
        for (let source of config.sourceselectors) {
            source_enums.push(source.name)
            let source_array = ['idle']
            let source_number = source.number
            let source_name = legalName('SourceSelect_', source.name)
            let i=1
            while (i <= source_number) {
                source_array.push(i)
                i++
            }
            if (source_enums.length > 0) {
                base.createVariable({
                    name: source_name,
                    type: 'enum',
                    enums: source_array,
                    perform: {
                        action: 'Set Source',
                        params: {
                            Name: source.name,
                            Input: '$value'
                        }
                    }
                })

                base.setPoll({ ...defaults, action: 'getSource', params: {Name: source.name} })
            }
        }

        // TONE MODULES
        for (let tone of config.tonecontrols) {
            base.createVariable({
                name: legalName('BassLevel_', tone.name),
                type: 'integer',
                minimum: 0,
                maximum: 100,
                perform: {
                    action: 'Set Bass Level',
                    params: {
                        Name: tone.name,
                        Level: '$value'
                    }
                }
            })
            base.createVariable({
                name: legalName('MidLevel_', tone.name),
                type: 'integer',
                minimum: 0,
                maximum: 100,
                perform: {
                    action: 'Set Mid Level',
                    params: {
                        Name: tone.name,
                        Level: '$value'
                    }
                }
            })
            base.createVariable({
                name: legalName('HighLevel_', tone.name),
                type: 'integer',
                minimum: 0,
                maximum: 100,
                perform: {
                    action: 'Set High Level',
                    params: {
                        Name: tone.name,
                        Level: '$value'
                    }
                }
            })

            base.createVariable({
                name: legalName('EqBypass_', tone.name),
                type: 'enum',
                enums: ['Off', 'On'],
                perform: {
                    action: 'Set Eq Bypass',
                    params: {
                        Name: tone.name,
                        Status: '$value'
                    }
                }
            })

            base.setPoll({ ...defaults, action: 'getBassLevel', params: {Name: tone.name} })
            base.setPoll({ ...defaults, action: 'getMidLevel', params: {Name: tone.name} })
            base.setPoll({ ...defaults, action: 'getHighLevel', params: {Name: tone.name} })
            base.setPoll({ ...defaults, action: 'getEqBypass', params: {Name: tone.name} })
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
            if (data.length === 1 && data[0] === 0x06) {
                onAck()
            }
            else {
                frameParser.push(data.toString())
            }
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
            // logger.debug(`onFrame (pending = ${pending.action}): ${data}`)

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
            else if (pending.action === 'getSource') {
                match = data.match(/GA"(.+?)">1=([0-9-.]+)/)
                if (match) {
                    let module_name = match[1]
                    let val = match[2]
                    let var_name = legalName('SourceSelect_', module_name)
                    if (!isNaN(val)) {
                        base.getVar(var_name).value = parseInt(val)
                        base.commandDone()
                    }
                    else  {
                        base.commandError('unable to process source response')
                    }

                }
                else {
                    base.commandError('Unexpected response')
                }
            }
            else if (pending.action === 'getBassLevel' || pending.action === 'getMidLevel' || pending.action === 'getHighLevel') {
                match = data.match(/GA"(.+?)">([0-9-.]+)=([0-9-.]+)/)
                let level_name
                if (match[2] == 1){
                    level_name = 'BassLevel_'
                }
                else if (match[2] == 3){
                    level_name = 'MidLevel_'
                }
                else if (match[2] == 5){
                    level_name = 'HighLevel_'
                }
                if (match) {
                    let module_name = match[1]
                    let val = match[3]
                    //logger.warn(`eq level ${val}`)
                    let var_name = legalName(`${level_name}`,`${module_name}`)
                    if (!isNaN(val)) {
                        val = mapNumFromEq(val)
                        //logger.warn(`eq postlevel ${val}`)
                        base.getVar(var_name).value = parseInt(val)
                        base.commandDone()
                    }
                    else  {
                        base.commandError('unable to process source response')
                    }

                }
                else {
                    base.commandError('Unexpected response EQ')
                }
            }
            else if (pending.action === 'getEqBypass') {
                match = data.match(/GA"(.+?)">([0-9-.]+)=(.+?)/)
                if (match) {
                    let module_name = match[1]
                    let val = match[3]
                    let var_name = legalName('EqBypass_', module_name)
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
            else if (pending.action === 'recallPreset'){
                base.commandDone()
            }

            else {
                logger.warn(`onFrame data not processed: ${data}`)
            }
        }
        else {
            logger.warn(`Received data but no pending command: ${data}`)
        }
    }

    function onAck() {
        let pending = base.getPendingCommand()
        if (pending) {
            base.commandDone()
            logger.silly(`ACK (${pending.action})`, pending.params)
            if (pending.action === 'setAudioMute') {
                let var_name = legalName('AudioMute_', pending.params.Name)
                base.getVar(var_name).string = pending.params.Status
            }
            else if (pending.action === 'setAudioLevel') {
                let var_name = legalName('AudioLevel_', pending.params.Name)
                base.getVar(var_name).value = pending.params.Level
            }
            else if (pending.action === 'setSource') {
                let var_name = legalName('SourceSelect_', pending.params.Name)
                base.getVar(var_name).value = pending.params.Input
            }
            else if (pending.action === 'setBassLevel' || pending.action === 'setMidLevel' || pending.action === 'setHighLevel') {
                let name_prefix = 'BassLevel_'
                if(pending.action === 'setMidLevel') {name_prefix = 'MidLevel_'}
                if(pending.action === 'setHighLevel') {name_prefix = 'HighLevel_'}
                let var_name = legalName(name_prefix, pending.params.Name)
                base.getVar(var_name).value = pending.params.Level
            }
            if (pending.action === 'setEqBypass') {
                //logger.warn(`here seteqbypass received${pending.Status}`)
                let var_name = legalName('EqBypass_', pending.params.Name)
                base.getVar(var_name).string = pending.params.Status
            }

        }
        else {
            logger.warn('ACK received, but nothing pending!')
        }
    }

    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getAudioMute(params) {
        sendDefer(`GA"${params.Name}">2\r`)
    }

    function getAudioLevel(params) {
        sendDefer(`GA"${params.Name}">1\r`)
    }

    function getSource(params) {
        sendDefer(`GA"${params.Name}">1\r`)
    }

    function getHighLevel(params) {
        sendDefer(`GA"${params.Name}">5\r`)
    }

    function getMidLevel(params) {
        sendDefer(`GA"${params.Name}">3\r`)
    }

    function getBassLevel(params) {
        sendDefer(`GA"${params.Name}">1\r`)
    }

    function getEqBypass(params) {
        sendDefer(`GA"${params.Name}">2\r`)
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

    function setSource(params) {
        sendDefer(`SA"${params.Name}">1=${params.Input}\r`)
    }

    function setBassLevel(params) {
        let levelSend = mapNumToEq(params.Level)
        sendDefer(`SA"${params.Name}">1=${levelSend}\r`)
    }

    function setMidLevel(params) {
        let levelSend = mapNumToEq(params.Level)
        sendDefer(`SA"${params.Name}">3=${levelSend}\r`)
    }

    function setHighLevel(params) {
        let levelSend = mapNumToEq(params.Level)
        sendDefer(`SA"${params.Name}">5=${levelSend}\r`)
    }

    function setEqBypass(params) {
        // logger.warn(params.Status)
        if (params.Status == 0) {
            sendDefer(`SA"${params.Name}">2=F\rSA"${params.Name}">4=F\rSA"${params.Name}">6=F\r`)

        }
        else if (params.Status == 1) {
            sendDefer(`SA"${params.Name}">2=O\rSA"${params.Name}">4=O\rSA"${params.Name}">6=O\r`)
            // logger.warn(`HERE IT IS SA"${params.Name}">2=O\r`)
        }

    }

    function recallPreset(params) {
        let result = config.presets.find(entry => entry.name === params.Name)
        // Equivalent to: entry => entry.name === params.Name
        // function(entry) {
        //     return (entry.name === params.Name)
        // }

        if (result) {
            sendDefer(`SS ${result.number}\rGS\r`)
        }
        else {
            logger.error(`Preset not found: ${params.Name}`)
        }
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function mapNum(num, inMin, inMax, outMin, outMax) {
        return ((num - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin
    }

    function mapNumToEq(num){
        return ((num/(100/EQLEVEL_RANGE))-15)
    }

    function mapNumFromEq(lev){
        let level = parseFloat(lev)
        return parseInt(((level+15)*(100/EQLEVEL_RANGE)))

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
        getAudioMute, getAudioLevel, getSource, getBassLevel, getHighLevel, getMidLevel, getEqBypass,
        setPower, setAudioMute, setAudioLevel, setSource, setBassLevel, setHighLevel, setMidLevel, setEqBypass,
        keepAlive,
        recallPreset
    }
}
