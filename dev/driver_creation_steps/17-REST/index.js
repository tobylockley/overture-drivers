let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config 

  const setup = _config => {
    config = _config
  }

  const start = () => {    
    base.perform('Get Info', { EndPoint: '/people/1'} )
    base.perform('Get Info', { EndPoint: '/people/1000'} )
  }

  const stop = () => {
  }

  const getInfo = params => {
    return host.request.get(`https://swapi.co/api${params.EndPoint}`, { json: true })
      .then(answer => logger.info(answer.name))
      .catch(err => logger.error(err)) 
    // sendRequest('GET', param.endPoint)
  }

  const sendRequest = (method, endPoint, payload) => {
    base.commandDefer()
    const uri = `https://swapi.co/api${endPoint}` 
    const options = {
        method: method,
        uri,
        // auth: {
        //     user: config.user,
        //     pass: config.password,
        //     sendImmediately: false
        // },
        // rejectUnauthorized: false,
        json: true,
        timeout: 10000,
        body: payload
    };
    return host.request(options)
      .then( answer => {
        base.commandDone()
        logger.info(answer.name)
      })
      .catch(err => {
        base.commandError(`code ${err.message.split(' ')[0]}`)
      })
  }

  return {
    setup, start, stop, getInfo
  }
}