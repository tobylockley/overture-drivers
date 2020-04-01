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
    }

    function start() {
    }

    function stop() {
    }

    function tick() {
    }

    // ------------------------------ EXPORTED FUNCTIONS ------------------------------
    return {
        setup, start, stop, tick
    }
}