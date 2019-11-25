'use strict'

//---------------------------------------------------------------------------------------- CONSTANTS
const CMD_DEFER_TIME = 3000       // Timeout when using commandDefer
const MAX_LOGS = 100000           // Trim after this many logs accumulated
const USER_TIMEOUT = 60000        // Lockout functions to specific user for this time

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  const io = require('socket.io-client')
  let config
  let socket
  let userId
  let userTimeout
  let unreadLogs = []

  //------------------------------------------------------------------------- STANDARD SDK FUNCTIONS
  function setup(_config) {
    config = _config
  }

  function start() {
    initSocket()
  }

  function stop() {
    socket && socket.close()
    socket = null
  }

  //-------------------------------------------------------------------------- SEND/RECEIVE HANDLERS
  function initSocket() {
    if (socket) stop()  // If socket already exists, throw it out
    socket = io(`http://localhost:${config.port}`)

    socket.on('connect', () => {
      logger.debug('Socket Connected')
    })
    
    socket.on('disconnect', (reason) => {
      logger.debug(`Socket Disconnected: ${reason}`)
    })

    socket.on('error', onError)
    socket.on('connect_error', onError)
    socket.on('reconnect_error', onError)
    function onError(error) {
      logger.error(`Socket Error: ${error.message}`)
    }
    
    // Ensure all logs are enabled, at max verbose level (silly)
    socket.on('opencap.logconfigchange', (data) => {
      let needsUpdating = false
      if (data.core.level != 'silly' || !data.core.enable) {
        data.core.level = 'silly'
        data.core.enable = true
        needsUpdating = true
      }
      for (let device of data.devices) {
        if (device.level != 'silly' || !device.enable) {
          device.level = 'silly'
          device.enable = true
          needsUpdating = true
        }
      }
      for (let driver of data.drivers) {
        if (driver.level != 'silly' || !driver.enable) {
          driver.level = 'silly'
          driver.enable = true
          needsUpdating = true
        }
      }
      if (needsUpdating) {
        logger.debug('Setting CS log config to most verbose')
        socket.emit('opencap.setlogconfig', data)
      }
    })
    
    socket.on('opencap.getproject', (data) => {
      if (base.getPendingCommand().action == 'getProject') {
        base.commandDone(data)
      }
      else {
        logger.debug('Received project but no pending', data)
      }
    })
    
    socket.on('opencap.log', (data) => {
      for (let log of data) {
        if ( !/(?:Get Logs|cs_relay)/.test(log.msg) ) {
          // Filter out logs from this behaviour
          unreadLogs.push(log)
        }
      }
      // Throw out any old logs over max count
      let overCount = unreadLogs.length - MAX_LOGS
      if (overCount > 0) unreadLogs.splice(0, overCount)
    })
  }

  //---------------------------------------------------------------------------------- GET FUNCTIONS
  function getProject(params) {
    base.commandDefer(CMD_DEFER_TIME)
    checkUser(params.Identifier)
      .then(() => {
        socket.emit('opencap.getproject')
      })
      .catch((reason) => {
        base.commandError(reason)
      })
  }
  
  function getLogs(params) {
    base.commandDefer(CMD_DEFER_TIME)
    checkUser(params.Identifier)
      .then(() => {
        // Return all logs in array, and reset array to empty
        base.commandDone(unreadLogs)
        unreadLogs = []
      })
      .catch((reason) => {
        base.commandError(reason)
      })
  }

  //------------------------------------------------------------------------------- HELPER FUNCTIONS
  function checkUser(id) {
    return new Promise((resolve, reject) => {
      if (id) {
        if (!userId || userId === id) {
          updateUser(id)
          resolve()
        }
        else {
          reject(`Resource is secured by another user for the next ${getTimeLeft(userTimeout)} seconds`)
        }
      }
      else {
        reject('Please provide "Identifier" parameter, with a unique string for the session')
      }
    })
  }

  function updateUser(id) {
    userId = id
    if (userTimeout) {
      userTimeout.refresh()
    }
    else {
      userTimeout = setTimeout(() => {
        clearTimeout(userTimeout)
        userTimeout = null
        userId = null
      }, USER_TIMEOUT)
    }
  }

  function getTimeLeft(timeout) {
    if (!timeout) return 0
    else return Math.ceil((timeout._idleStart + timeout._idleTimeout)/1000 - process.uptime())
  }

  //----------------------------------------------------------------------------- EXPORTED FUNCTIONS
  return {
    setup, start, stop,
    getProject, getLogs
  }
}