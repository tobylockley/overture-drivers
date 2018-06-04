let host

exports.init = _host => host = _host

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config 
  let tcpClient
  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\n')
  frameParser.on('data', data => onFrame(data))

  const setup = _config => {
    config = _config
    pollers.forEach(x => base.setPoll(x.action, x.period, x.params))
  }

  const start = () => {
    tcpClient = tcpClient || initTcpClient()
    tcpClient.connect(config.port, config.host)
  }

  const stop = () => { 
    tcpClient && tcpClient.end() 
    disconnect()
  }

  const startPolling = () => {
    pollers.filter(x => x.immediate).forEach(x => base.perform(x.action, x.params))
    base.startPolling()
  }

  const matchers = []
  const pollers = []

  const setPower = params => isEnumParamValid('Power', params.Status) && sendDefer(`!Power ${params.Status}\r\n`)
  const getPower = () => sendDefer(`?Power\r\n`)
  pollers.push({ action: 'Get Power', period: 5000, immediate: true })
  matchers.push(matchExp(/^\?Power (\w+)\r$/, match => base.getVar('Power').string = match[1]))

  const selectSource = params => isEnumParamValid('Sources', params.Name) && sendDefer(`!Source ${params.Name}\r\n`)
  const getSource = () => sendDefer(`?Source\r\n`)
  pollers.push({ action: 'Get Source', period: 5000, immediate: true })
  matchers.push(matchExp(/^\?Source (\w+)\r$/, match => base.getVar('Sources').string = match[1]))

  const setAudioLevel = params => isIntegerParamValid('AudioLevel', params.Level) && sendDefer(`!Level ${params.Level}\r\n`)
  const getAudioLevel = () => sendDefer(`?Level\r\n`)
  pollers.push({ action: 'Get Audio Level', period: 5000, immediate: true })
  matchers.push(matchExp(/^\?Level (\w+)\r$/, match => base.getVar('AudioLevel').value = match[1]))
  
  matchers.push(matchExp(/^ACK\r$/, () => {}))

  function matchExp (exp, fn) {
    return data => {
      const match = data.match(exp)
      match && fn(match)
      return match
    }
  }

  const onFrame = data => {
    logger.silly(`onFrame ${data}`)
    base.commandDone()
    const matched = matchers.some(x => x(data))
    !matched && logger.silly('Unknown response')
  }

  const initTcpClient = () => {
    const tcpClient = host.createTCPClient()

    tcpClient.on('connect', () => {
      logger.silly(`TCPClient connected`)
      base.getVar('Status').string =  'Connected'
      startPolling()
    })

    tcpClient.on('data', data => {
      data = data.toString()
      logger.silly(`TCPClient data: ${data}`)
      frameParser.push(data)
    })

    tcpClient.on('close', () => {
      logger.silly(`TCPClient closed`)
      disconnect()
    })

    tcpClient.on('error', err => {
      logger.error(`TCPClient: ${err}`)
      disconnect()
    })
    return tcpClient
  }

  const sendDefer = data => {
    send(data) ? base.commandDefer() : base.commandError(`Data not sent`)
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  const isEnumParamValid = (varName, value) => {
    const variable = base.getVar(varName)
    const isValid = (variable && variable.enums && variable.enums.indexOf(value) >= 0)
    !isValid && logger.error(`Invalid parameter value ${varName} ${value}`)
    return isValid
  }

  const isIntegerParamValid = (varName, value) => {
    const variable = base.getVar(varName)
    let isValid = variable && typeof value === 'number'
      && (variable.min === undefined || value >= variable.min )
      && (variable.max === undefined || value <= variable.max )
    !isValid && logger.error(`Invalid parameter value ${varName} ${value}`)
    return isValid
  }

  return {
    setup, start, stop,
    setPower, selectSource, setAudioLevel, getPower, getSource, getAudioLevel
  }
}