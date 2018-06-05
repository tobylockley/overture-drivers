
const { stringToObject } = require('./stringToObject.js')

exports.createUtils = (host, base) => {
  const _ = host.lodash
  const logger = base.logger || host.logger
  let timeouts = []

  //const perform = (object, action, parameters) => { return host.perform(object, action, parameters) }
  const setProperty = (object, property, value) => { return host.setProperty(object, property, value) }
  const setVariable = (object, value) => { return host.setVariable(object, value) }

  const getStringByPlusNotation = ref => {
    const match = (typeof ref === 'string') && ref.match(/^\+(.*)/)
    return match && match.length == 2 ? `${base.name}${match[1]}` : undefined
  }

  /**
   * return a variable by dot notation. ex: `.Power` => `Malaga.Power`
   * @param {string} ref 
   */
  const getVariableByDotNotation = ref => {
    const match = (typeof ref === 'string') && ref.match(/^\.(.*)/)
    return match && match.length == 2 ? base.getVar(match[1]) : undefined
  }

  /**
   * return a variable by plus notation. ex: '+_Projector.Power' => 'Malaga_Projector.Power'
   * @param {string} ref 
   */
  const getVariableByPlusNotation = ref => {
    const stringRef = getStringByPlusNotation(ref)
    return stringRef ? host.getVariable(stringRef) : undefined
  }

  /**
   * return a variable which is specified by ref
   * @param {string} ref Can be absolute, device var (.), postfix var (+)
   */
  const getVar = ref => {
    const variable = getVariableByDotNotation(ref) || getVariableByPlusNotation(ref) || host.getVariable(ref)
    return variable
  }

  /**
   * Sets a property of a variable which matches the specified ref 
   * Supports the point filter syntax
   * @param {*} ref 
   * @param {*} prop 
   * @param {*} value 
   */
  const setVariablePropByRef = (ref, prop, value) => {
    try {
      const pointFilter = stringToObject(ref, base.name)
      if (pointFilter.parent === 'point') {
        pointFilter.parent = base.name
      }
      host.setVariable(pointFilter, value)
    } catch (err) {
      setVariableProp(getVar(ref), prop, value)
    }
  }

  /**
   * Eval an expression in the room lexical scope. 
   * Note the expression can be a simple string: in that case the string is returned
   * @param {*} exp 
   * @param {*} elapsedTime Optional, the time elapsed since the start of the transition (for power)
   * @param {*} $value
   * @param {*} $string
   */
  const evalExpression = (exp, elapsedTime, $value, $string) => {
    const point = `${base.name}` // might be used in filter expressions  
    try {
      // it can be a number or an expression
      return eval(exp)
    }
    catch (err) {
      try {
        // string between ( ) characters should be evaluated without adding ""
        if (!(typeof exp === 'string' && (exp.trim().match(/^\(.*\)$/)))) {
          return eval(`'${exp}'`)
        }
        logger.error(`Expression: ${err} in ${exp}`)
      }
      catch (err) {
        logger.error(`Expression: ${err} in ${exp}`)
      }
    }
  }

  /**
   * Executes an action
   * @param {*} action action.exp is either a string or a JS expression (inferred when enclosed in parenthesis)
   * @param {*} $value The value of the variable which has triggered the action
   * @param {*} $string The string value of the variable which has triggered the action
   */
  const executeAction = (action, $value, $string) => {
    try {
      let result = evalExpression(action.exp, 0, $value, $string)
      // convert to number if possible (for enums)
      const resultNumber = Number(result)
      if (isNaN(resultNumber) && typeof result === 'string') {
        logger.debug(`executeAction("${action.variable}","${result}")`)
        setVarRequiredString(action.variable, result)
      } else {
        logger.debug(`executeAction("${action.variable}",${resultNumber})`)
        setVarRequiredValue(action.variable, resultNumber)
      }
    } catch (err) {
      logger.error(err)
    }
  }

  /**
   * 
   * @param {*} action action.exp is a statement (ie: `perform('toto','titi')`)
   * @param {*} $value The value of the variable which has triggered the action
   * @param {*} $string The string value of the variable which has triggered the action
   */
  const executeStatement = (action, $value, $string) => {
    try {
      logger.debug(`executeAction("${action.variable}","${action.exp}")`)
      evalExpression(action.exp, 0, $value, $string)
    } catch (err) {
      logger.error(err)
    }
  }

  const isEmptyCondition = trigger => trigger.value === undefined || trigger.value === ''

  const doesValueMatchCondition = (trigger, variable) => {
    const value = evalExpression(trigger.value, 0, variable.value, variable.string)
    return (value === true ||
      variable.value === value ||
      variable.string === value ||
      variable.value.toString() === value)
  }

  const convertActionsToCues = (variable, _actions) => {
    let cues = []
    for (let action of _actions) {
      switch (action.type) {
        case 'waitfor':
        case 'wait': {
          if (Number(action.exp) !== NaN) {
            cues.push({
              "condition": action.condition,
              "command": action.type,
              "delay": action.exp
            })
          }
          else {
            // even if we expect to have a number, acue is create in order to display an error during the runtime
            // + it allows to keep the same cue count between the setup & the debug interface (cue index must match)
            cues.push({
              "condition": action.condition,
              "command": "exp",
              "exp": action.exp,
              "evalCue": () => {
                return executeAction(action, variable ? variable.value : undefined, variable ? variable.string : undefined)
              }
            })
          }
        } break;
        case 'stop': {
          cues.push({
            "condition": action.condition,
            "command": "stop",
            "exp": ''
          })
        } break;
        case 'if': {
          cues.push({
            "condition": action.condition,
            "command": "if",
            "exp": action.exp,
            "evalCue": !variable ? undefined : () => {
              return evalExpression(action.exp, 0, variable ? variable.value : undefined, variable ? variable.string : undefined)
            }
          })
        } break;
        case 'else':
        case 'endif': {
          cues.push({
            "condition": action.condition,
            "command": action.variable,
            "exp": ''
          })
        } break;
        case 'setvariable': {
          cues.push({
            "condition": action.condition,
            "command": "exp",
            "exp": action.exp,
            "evalCue": () => {
              return executeAction(action, variable ? variable.value : undefined, variable ? variable.string : undefined)
            }
          })
        } break;
        case 'exp': {
          cues.push({
            "condition": action.condition,
            "command": "exp",
            "exp": action.exp,
            "evalCue": () => {
              return executeStatement(action, variable ? variable.value : undefined, variable ? variable.string : undefined)
            }
          })
        } break;
        default: {
          cues.push({
            "condition": action.condition,
            "command": "exp",
            "exp": action.exp,
            "evalCue": () => {
              return executeAction(action, variable ? variable.value : undefined, variable ? variable.string : undefined)
            }
          })
        } break;
      }
    }
    return cues
  }

  const createTask = (name, actions = [], variable = undefined) => {
    const task = base.createTask({
      name,
      cues: convertActionsToCues(variable, actions),
      getVariableFn: getVar,
    })
    return task
  }

  const createTrigger = (name, rules = { condition: 'AND', rules: [] }, options = {}, tasks = []) => {
    const trigger = base.createTrigger({
      name,
      rules,
      options: Object.assign({}, options, { getVariableFn: getVar }),
      tasks
    })
    return trigger
  }

  // various variable prop access functions
  const getVariableProp = (variable, prop) => variable ? variable[prop] : undefined
  const getVarValue = ref => getVariableProp(getVar(ref), 'value')
  const getVarString = ref => getVariableProp(getVar(ref), 'string')
  const getVarRequiredValue = ref => getVariableProp(getVar(ref), 'required')
  const getVarRequiredString = ref => getVariableProp(getVar(ref), 'requiredString')

  const setVariableProp = (variable, prop, value) => variable ? variable[prop] = value : undefined
  const setVarValue = (ref, value) => setVariableProp(getVar(ref), 'value', value)
  const setVarString = (ref, value) => setVariableProp(getVar(ref), 'string', value)
  const setVarRequiredValue = (ref, value) => setVariablePropByRef(ref, 'required', value)
  const setVarRequiredString = (ref, value) => setVariablePropByRef(ref, 'requiredString', value)

  const str = (variable, value) => value === undefined ? getVarString(variable) : setVarRequiredString(variable, value)
  const val = (variable, value) => value === undefined ? getVarValue(variable) : setVarRequiredValue(variable, value)

  const perform = (_ref, action, params) => {
    let ref = _.cloneDeep(_ref)
    if (typeof ref === 'string') {
      ref = getStringByPlusNotation(ref) || ref
    }
    host.perform(ref, action, params)
  }

  return {
    evalExpression,
    getVar,
    getVarValue,
    getVarString,
    getVarRequiredValue,
    getVarRequiredString,
    setVarValue,
    setVarString,
    setVarRequiredValue,
    setVarRequiredString,
    perform,
    convertActionsToCues,
    createTask,
    createTrigger,
    str,
    val,

    // test
    getVariableByDotNotation,
    getVariableByPlusNotation,
  }
} 