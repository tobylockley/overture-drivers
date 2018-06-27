const ps = require(`./persistent_addon.js`)

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config

  let persistent_variables = []

  const setup = _config => {
    config = _config

    for (let i = 1; i <= 5; i++) {
      base.createVariable({
        name: `Output${i}`,
        type: 'integer',
        min: 1,
        max: 10,
        perform: {
          action: 'Set Output',
          params: {
            Output: i,
            Input: '$value'
          }
        }
      })
      persistent_variables.push(`Output${i}`)
    }

    for (let i = 1; i <= 3; i++) {
      base.createVariable({
        name: `Text${i}`,
        type: 'string',
        perform: {
          action: 'Set Text',
          params: {
            Number: i,
            Text: '$string'
          }
        }
      })
      persistent_variables.push(`Text${i}`)
    }
  }

  const start = () => {
    // Load persistent variables
    persistent_variables.forEach(name => {
      ps.loadPersistent(name, data => {
        base.getVar(name).value = data
      })
    });
  }

  const stop = () => {
  }

  const setOutput = params => {
    logger.debug(`Changing variable and saving to persistent.json ... Output${params.Output}: ${params.Input}`);
    base.getVar(`Output${params.Output}`).value = params.Input
    ps.savePersistent(`Output${params.Output}`, params.Input)
  }

  const setText = params => {
    logger.debug(`Changing variable and saving to persistent.json ... Text${params.Number}: ${params.Text}`);
    base.getVar(`Text${params.Number}`).value = params.Text
    ps.savePersistent(`Text${params.Number}`, params.Text)
  }

  return {
    setup, start, stop, setOutput, setText
  }
}