//------------------------------------------------------------------------------------------ CONSTANTS
const CMD_DEFER_TIME = 1000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const TCP_TIMEOUT = 30000          // Will timeout after this length of inactivity
const TCP_RECONNECT_DELAY = 3000   // How long to wait before attempting to reconnect

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


    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function isConnected() { return base.getVar('Status').string == 'Connected' }


    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)

        config.controls.forEach(control => {
            let human_name = control.name ? `_${control.name}` : ''

            if (control.type == 'Level Fader') {
                let varname = `AudioLevel_${control.channel}${human_name}`

                base.createVariable({
                    name: varname,
                    type: 'integer',
                    min: 0,
                    max: 112,
                    perform: {
                        action: 'setAudioLevel',
                        params: {
                            InstanceId: control.instance,
                            Channel: control.channel,
                            Level: '$value',
                            OvertureVar: varname
                        }
                    }
                })

                base.setPoll({
                    action: 'getAudioLevel',
                    params: { InstanceId: control.instance, Channel: control.channel, OvertureVar: varname },
                    period: POLL_PERIOD,
                    enablePollFn: isConnected,
                    startImmediately: true
                })
            }
            else if (control.type == 'Mute Fader' || control.type === 'Logic State') {
                let varname, attribute
                if (control.type === 'Mute Fader') {
                    varname = `AudioMute_${control.channel}${human_name}`
                    attribute = 'FDRMUTE'
                }
                else if (control.type === 'Logic State') {
                    varname = `LogicState_${control.channel}${human_name}`
                    attribute = 'LGSTATE'
                }

                base.createVariable({
                    name: varname,
                    type: 'enum',
                    enums: ['Off', 'On'],
                    perform: {
                        action: 'setBinary',
                        params: {
                            InstanceId: control.instance,
                            Channel: control.channel,
                            Status: '$string',
                            Attribute: attribute,
                            OvertureVar: varname
                        }
                    }
                })

                base.setPoll({
                    action: 'getBinary',
                    params: { InstanceId: control.instance, Channel: control.channel, Attribute: attribute, OvertureVar: varname },
                    period: POLL_PERIOD,
                    enablePollFn: isConnected,
                    startImmediately: true
                })
            }
        })
    }

    function start() {
        initTcpClient()
    }

    function tick() {
        if (!tcpClient) initTcpClient()
    }

    function stop() {
        base.getVar('Status').string = 'Disconnected'
        tcpClient && tcpClient.end()
        tcpClient = null
    }

    function initTcpClient() {
        if (tcpClient) return  // Abort if tcpClient already exists

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
            tcpClient.write(Buffer.from([0xFF, 0xFE, 0x01]))  // Turn off echo, see Nexia.chm pg. 230
        })

        tcpClient.on('data', data => {
            frameParser.push(data.toString())
        })

        tcpClient.on('close', () => {
            logger.silly('TCPClient closed')
            base.getVar('Status').string = 'Disconnected'  // Triggered on timeout, this allows auto reconnect
        })

        tcpClient.on('error', err => {
            logger.error(`TCPClient: ${err}`)
            stop()  // Throw out the tcpClient and get a fresh connection
        })
    }


    //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
    function send(data) {
        logger.silly(`TCPClient send: ${data}`)
        return tcpClient && tcpClient.write(data)
    }

    function sendDefer(data) {
        if (send(data)) base.commandDefer(CMD_DEFER_TIME)
        else base.commandError('Data not sent')
    }

    function onFrame(data) {
        let match  // Used for regex matching below
        const pendingCommand = base.getPendingCommand()
        logger.silly(`onFrame (pending = ${pendingCommand && pendingCommand.action}): ${data}`)

        if ( pendingCommand && pendingCommand.action == 'getAudioLevel' ) {
            match = data.match(/(\d+)/)
            if (match) {
                base.getVar(pendingCommand.params.OvertureVar).value = parseInt(match[1]) / 10
                base.commandDone()
            }
        }
        else if ( pendingCommand && pendingCommand.action == 'getBinary' ) {
            match = data.match(/(\d+)/)
            if (match) {
                base.getVar(pendingCommand.params.OvertureVar).value = parseInt(match[1])
                base.commandDone()
            }
        }
        else if ( pendingCommand && pendingCommand.action == 'setAudioLevel' ) {
            match = data.match(/\+OK/)
            if (match) {
                base.getVar(pendingCommand.params.OvertureVar).value = pendingCommand.params.Level
                base.commandDone()
            }
        }
        else if ( pendingCommand && pendingCommand.action == 'setBinary' ) {
            match = data.match(/\+OK/)
            if (match) {
                base.getVar(pendingCommand.params.OvertureVar).string = pendingCommand.params.Status
                base.commandDone()
            }
        }
    }


    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getAudioLevel(params) {
        sendDefer(`GETL ${config.device} FDRLVL ${params.InstanceId} ${params.Channel}\n`)
    }

    function getBinary(params) {
        sendDefer(`GET ${config.device} ${params.Attribute} ${params.InstanceId} ${params.Channel}\n`)
    }


    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setAudioLevel(params) {
        sendDefer(`SETL ${config.device} FDRLVL ${params.InstanceId} ${params.Channel} ${params.Level * 10}\n`)
    }

    function setBinary(params) {
        const val = params.Status == 'On' ? 1 : 0
        sendDefer(`SET ${config.device} ${params.Attribute} ${params.InstanceId} ${params.Channel} ${val}\n`)
    }


    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup, start, stop, tick,
        getAudioLevel, getBinary,
        setAudioLevel, setBinary
    }
}