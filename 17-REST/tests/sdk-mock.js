const {EventEmitter} = require('events') 

const camelize = str => {
  str = str || ''
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(letter, index) {
    return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
  }).replace(/\s+/g, '');
}

const createLogger = () => {
  let lastLog = undefined
  const log = level => msg => lastLog = `[${level}] ${msg}`
  return {
    error: log('error'),
    alarm: log('alarm'),
    warning: log('warning'),
    info: log('info'),
    debug: log('debug'),
    silly: log('silly'),
    getLastLog: () => lastLog
  }
}

const createTCPClient = () => {
  let  lastReceived = undefined

  const emitter = new EventEmitter
  const on = (event, fn) => emitter.on(event, fn)
  const end = () => {}
  const connect = (port, host) => emitter.emit('connect') 
  const write = data => {
    lastReceived = data
    return true
  }
  const getLastReceived = () => lastReceived
  const clearLastReceived = () => lastReceived = undefined
  const receive = data => emitter.emit('data', data)

  return {
    connect, write, on, end, 
    getLastReceived, receive, clearLastReceived,
  }
}

const createFrameParser = logger => {
  const emitter = new EventEmitter
  let separator = '\r\n'
  const push = data => {
    const frames = data.split(separator)
    frames.forEach(x => x && emitter.emit('data', x))    
  }
  const setSeparator = _separator => separator = _separator
  const on = (event, fn) => emitter.on(event, fn)

  return {
    push, on, setSeparator
  }
}

const createHost = () => {
  let tcpClient = createTCPClient()
  const logger = createLogger()
  return {
    createFrameParser,
    createTCPClient: () => tcpClient,
    logger,
    tcpClient
  }
}

const _createVariable = options => {
  const emitter = new EventEmitter
  let _name = options.name
  let _string
  let _value
  let _required
  let _requiredString
  let _enums = options.enums

  const setRequiredString = x => {
    if (x === undefined || x === null) return;
    if (isNaN(Number(x))) {
      _requiredString = x.toString(); _required = x; _enums && (_required = _enums.indexOf(x)) 
      emitter.emit('requiredchange', innerVariable)
    } else {
      setRequired(x)
    }
  }
  const setRequired = x => {
    if (x === undefined || x === null) return;
    if (isNaN(Number(x))) {
      setRequiredString(x)
    } else {
      x = Number(x)
      _required = x; _requiredString = x.toString(); _enums &&  (_requiredString = _enums[x])
      emitter.emit('requiredchange', innerVariable)
    }
  }

  const innerVariable = {
    get string() { return _string },
    set string(x) { 
      switch (options.type) {
        case 'string': 
          _string = x.toString(); _value = x.toString();
        case 'enum': 
          _string = x.toString(); _value = _enums.indexOf(x); 
          break;
        case 'integer':
        case 'real':
          _string = x.toString(); _value = Number(x); 
        break;
        case 'date':
        case 'time':
          _string = x.toString(); _value = new Date(x); 
      }
    },
    get value() { return _value },
    set value(x) {
      switch (options.type) {
        case 'string': 
          _string = x.toString(); _value = x.toString(); break
        case 'enum': 
          _string = _enums[x]; _value = x; break;
        case 'integer':
        case 'real':
          _string = x.toString(); _value = Number(x); break;
        case 'date':
        case 'time':
          _string = x.toString(); _value = new Date(x); break;
      }
    },
    get enums() { return _enums },
    set enums(x) { _enums = x },
    get name() { return _name },
    set name(x) { _name = x },

    get requiredString() { return _requiredString },
    set requiredString(x) { setRequiredString(x) }, 
    get required() { return _required },
    set required(x) { setRequired(x) },
    on: (event, fn) => emitter.on(event, fn),
  }
  return Object.assign(innerVariable, options)
}

const createBase = () => {
  const vars = {}
  const cmds = {}
  const polls = []
  let lastPerform = undefined
  let commandStatus = undefined
  let pendingCommandsCleared = undefined
  let device

  // setup 
  const processPackageJson = json => {
    json.overture.variables.forEach(createVariable)
    json.overture.commands.forEach(createCommand)
  }

  const onRequiredChange = variable => {
    if (variable.perform && variable.perform.params) {
      const params = Object.assign({}, variable.perform.params)
      Object.keys(params).forEach(key => {
        const param = params[key]
        param === '$value' && (params[key] = variable.required)
        param === '$string' && (params[key] = variable.requiredString)
      })
      if (device) {
        const fn = device[camelize(variable.perform.action)]
        if (fn) {
          fn(params)
        } else {
          device.perform(variable.perform.action, params)
        }
      } 
    }
  }

  const createCommand = options => {
    cmds[options.name] = (Object.assign({}, options))
  }

  const createVariable = options => {
    const variable = _createVariable(options)
    vars[variable.name] = variable
    variable.on('requiredchange', onRequiredChange)
    return variable
  }
  const setDevice = x => device = x
  const getDevice = () => device
  const getVar = name => vars[name]
  const createEnumVariable = (name, enums) => createVariable({type: 'enum', name, enums})
  const createIntegerVariable = (name, min, max) => createVariable({ type: 'integer', name, min, max})
  const createStringVariable = (name) => createVariable({ type: 'string', name })
  const createRealVariable = (name) =>  createVariable({ type: 'real', name })

  // polling
  const setPoll = (action, period, params) => polls.push({action, period, params})
  const startPolling = () => {}

  // commands
  const perform = (action, params) => {
    lastPerform = {action, params}
    const fn = device[action] || device[camelize(action)]
    if (fn) {
      fn(params)
    } else {
      device.perform(action, params)
    }
  }

  const commandError = () => commandStatus = 'error'
  const commandDone = () => commandStatus = 'done'
  const commandDefer = () => commandStatus = 'deferred'
  const clearPendingCommands = () => pendingCommandsCleared = true

  createEnumVariable('Activity', ['Off', 'On'])  

  return {
    setDevice,
    getDevice,
    getVar,
    createVariable,
    createEnumVariable,
    createIntegerVariable,
    createStringVariable,
    createRealVariable,
    
    setPoll,
    startPolling,

    perform,

    commandDefer,
    commandError,
    commandDone,
    clearPendingCommands,

    getLastPerform: () => lastPerform,
    getLastCommandStatus: () => commandStatus,
    getPendingCommandsCleared: () => pendingCommandsCleared,
    processPackageJson,
  }
}

exports.createHost = createHost
exports.createBase = createBase
exports.createTCPClient = createTCPClient