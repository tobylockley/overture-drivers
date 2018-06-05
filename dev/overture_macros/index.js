// @ts-check
const { createUtils } = require('./lib/utils.js')

// init
let host
let _
exports.init = function init(_host) {
  host = _host
  _ = host.lodash
}

// variable persistence management
const persistentVariableValues = {}

const storeVariableValue = (deviceName, variableName, value) => {
  variableName !== 'Activity' && _.set(persistentVariableValues, `${deviceName}.${variableName}`, value)
}

const loadVariableValue = (deviceName, variableName) => {
  return _.get(persistentVariableValues, `${deviceName}.${variableName}`)
}

// create a device
exports.createDevice = function createDevice(base) {
  const logger = base.logger || host.logger
  const {
    evalExpression,
    getVar,
    getVarValue,
    getVarString,
    setVarValue,
    setVarString,
    setVarRequiredValue,
    setVarRequiredString,
    convertActionsToCues,
    createTask,
    createTrigger
  } = createUtils(host, base)

  let config
  let triggeredVarActions

  // macro
  // {
  // "name": "test",
  // "type": "integer",
  // "values": [
  //   {
  //     "value": "100",
  //     "actions": [
  //       {
  //         "type": "wait",
  //         "variable": "wait",
  //         "exp": "100",
  //         "condition": ""
  //       }
  //     ],
  //     "options": {
  //       "cancelOthers": false
  //     },
  //   }

  const createVariables = config => {
    config.variables.forEach((v) => {
      let variable = base.createVariable({
        name: v.name,
        type: v.type,
        enums: v.type === 'enum' ? v.values.map(x => x.value) : undefined,
        perform: {
          action: `onSetVariable`,
          params: {
            Name: v.name,
            Value: '$string'
          }
        },
        hidden: v.hidden
      })
    })
  }

  const createMacros = config => {
    triggeredVarActions = []
    config.variables.forEach((v) => {

      let variable = base.getVar(v.name)
      if (variable) {
        v.values.forEach((macro, index) => {
          let task = createTask(`Task_${v.name}_${index}`, macro.actions, variable)

          let ruleGroup = {
            condition: 'AND',
            rules: []
          }
          if (macro.value === undefined || macro.value === '') {
            ruleGroup.rules.push({
              "operator": "#",
              "variable": variable.fullName,
              "value": ""
            })
          }
          else {
            ruleGroup.rules.push({
              "operator": "=",
              "variable": variable.fullName,
              "value": macro.value
            })
          }
          let trigger = createTrigger(`Trigger_${v.name}_${index}`,
            ruleGroup,
            {
              //evaluate: _.get(triggeredTask, 'trigger.options.evaluate') || 'onchange',
              //mindelay: _.get(triggeredTask, 'trigger.options.mindelay'),
              expressionResultChangedFn: expressionResultChangedFn
            },
            [task]
          )

          triggeredVarActions.push({ trigger, task, config: macro })
        })
      }
    })
  }

  const expressionResultChangedFn = (trigger, result) => {
    let triggeredTask = triggeredVarActions.find(x => x.trigger === trigger)
    if (result && triggeredTask && _.get(triggeredTask, 'options.cancelOthers')) {
      triggeredVarActions.forEach(x => x.task.stop())
    }
  }

  // called when a room variable required value is changed
  const onSetVariable = (params) => {
    logger.debug(`onSetVariable('${params.Name}','${params.Value}')`)
    setVarString(`.${params.Name}`, params.Value)
  }

  // driver device standard API -------------------------

  // called when the device needs to be setup 
  const setup = (_config) => {
    config = _config
    config.variables = config.variables || []
    createVariables(config)
  }

  const start = () => {
    createMacros(config)
    restoreVariables()
  }

  const stop = () => {
    backupVariables()
  }

  const backupVariables = () => {
    base.variables && base.variables.forEach(x => storeVariableValue(base.name, x.name, x.string))
  }

  const restoreVariables = () => {
    base.variables && base.variables.forEach(x => {
      const string = loadVariableValue(base.name, x.name)
      const variable = base.getVar(x.name)
      if (string && variable) {
        variable.string = string
      }
    })
  }
  
  const device = {
    setup,
    start,
    stop,
    onSetVariable
  }
  return device
}
