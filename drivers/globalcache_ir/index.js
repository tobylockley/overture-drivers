'use strict'

const CMD_DEFER_TIME = 1000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 30000          // Continuous polling function interval
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

    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function isConnected() { return base.getVar('Status').string === 'Connected' }

    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)
        base.setPoll({ action: 'keepAlive', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })

        // Construct commands enum
        let cmdEnums = ['Idle']
        for (let cmd of config.commands) {
            cmdEnums.push(cmd.name)
        }

        for (let i = 1; i <= 3; i++) {
            if (!config[`ir${i}_enabled`]) continue // Continue to next port if not enabled
            const nickname = config[`ir${i}_name`]
            const varname = nickname ? `Commands_${nickname}` : `Commands_Port${i}`
            base.createVariable({
                name: varname,
                type: 'enum',
                enums: cmdEnums,
                perform: {
                    action: 'sendCommand',
                    params: { Port: i, Name: '$string' }
                }
            })
        }
    }

    function start() {
        initTcpClient()
    }

    function stop() {
        base.getVar('Status').string = 'Disconnected'
        tcpClient && tcpClient.end()
        tcpClient = null
        base.stopPolling()
        base.clearPendingCommands()
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
            base.getVar('Status').string = 'Disconnected'  // Triggered on timeout, this allows auto reconnect
        })

        tcpClient.on('error', err => {
            logger.error(`TCPClient: ${err}`)
            base.getVar('Status').string = 'Disconnected'
            tcpClient && tcpClient.end()
            tcpClient = null // Throw out the tcpClient and get a fresh connection
        })

        // Finally, initiate connection
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
        logger.silly(`Frame received: ${data}`)
        base.commandDone()
    }

    function sendCommand(params) {
        let search = config.commands.filter(cmd => cmd.name === params.Name)
        if (search.length === 1) {
            sendDefer(`sendir,${config.module}:${params.Port},${search[0].code}\r`)
        }
        else if (search.length > 1) {
            logger.error(`Function sendCommand(): Multiple commands configured for '${params.Name}', please check device configuration.`)
        }
        else {
            logger.error(`Function sendCommand() could not find '${params.Name}' in configured commands.`)
        }
    }

    function keepAlive() {
        sendDefer('getversion\r')
    }

    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup, start, stop, tick,
        keepAlive, sendCommand
    }
}