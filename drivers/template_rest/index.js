//------------------------------------------------------------------------------------------ CONSTANTS
const CMD_DEFER_TIME = 3000         // Timeout when using commandDefer
const POLL_PERIOD = 5000            // Polling function interval
const TICK_PERIOD = 5000            // In-built tick interval
const REQUEST_TIMEOUT = 2000       // Timeout for AJAX requests

let host
exports.init = _host => {
    host = _host
}

exports.createDevice = base => {
    const logger = base.logger || host.logger
    let config

    //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
    function setup(_config) {
        config = _config
        base.setTickPeriod(TICK_PERIOD)
        // Register polling functions
        const defaults = {period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true}
        base.setPoll({...defaults, action: 'getPower'})
    }

    function start() {
        tick()  // Get the connection state straight away
        base.startPolling()
    }

    async function tick() {
        try {
            await restGet('/v1.0/Software/FirmwareVersion')  // If no error is thrown, connection is valid
            if (base.getVar('Status').string === 'Disconnected') {
                base.getVar('Status').string = 'Connected'
            }
        }
        catch (error) {
            base.getVar('Status').string === 'Disconnected'
            logger.error(`tick > ${error.message}`)
        }
    }

    function stop() {
        base.getVar('Status').string = 'Disconnected'
        base.stopPolling()
        base.clearPendingCommands()
    }

    //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
    async function restGet(path) {
        base.commandDefer(CMD_DEFER_TIME)
        try {
            logger.silly('GET request:', path)
            const options = {
                method: 'GET',
                uri: `http://${config.host}${path}`,
                timeout: REQUEST_TIMEOUT
            }
            let response = await host.request(options)
            response = JSON.parse(response)
            logger.silly('GET response:', response)
            base.commandDone()
            return response
        }
        catch (error) {
            base.commandError(error.message)
            throw new Error(`req failed > ${error.message}`)
        }
    }

    async function restPut(path, value) {
        base.commandDefer(CMD_DEFER_TIME)
        try {
            logger.silly('PUT request:', path, value)
            const options = {
                method: 'PUT',
                uri: `http://${config.host}${path}`,
                timeout: REQUEST_TIMEOUT,
                form: {
                    value: value
                }
            }
            let response = await host.request(options)
            response = JSON.parse(response)
            logger.silly('PUT response:', response)
            base.commandDone()
            return response
        }
        catch (error) {
            base.commandError(error.message)
            throw new Error(`restPut failed: ${error.message}`)
        }
    }

    //---------------------------------------------------------------------------------- GET FUNCTIONS
    function getPower() {
        restGet('/v1.0/Display/StandbyState').then(response => {
            // Process response
        })
    }

    //---------------------------------------------------------------------------------- SET FUNCTIONS
    function setPower(params) {
        let state
        if (params.Status == 'Off') state = false
        else if (params.Status == 'On') state = true
        restPut('/v1.0/Display/StandbyState', state).then(response => {
            // Process response
            // base.getVar('Power').string == 'Off'
        })
    }

    //------------------------------------------------------------------------------- HELPER FUNCTIONS
    function isConnected() {
        return base.getVar('Status').string == 'Connected'
    }

    //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
    return {
        setup, start, stop, tick,
        getPower,
        setPower
    }
}
