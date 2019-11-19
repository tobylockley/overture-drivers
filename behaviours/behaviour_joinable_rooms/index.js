'use strict'

let host
exports.init = _host => {
  host = _host
}


exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config


  // ------------------------------ BASE FUNCTIONS ------------------------------

  function setup(_config) {
    config = _config

    // config.groups = [ { name: "Group Name", rooms: ["room1", "room2", ...] }, ... ]
    let joinEnums = ['Unjoined']
    for (let group of config.groups) {
      joinEnums.push(`Initiated_${group.name}`)
      joinEnums.push(`Accepted_${group.name}`)
      joinEnums.push(`Joined_${group.name}`)
    }
    base.getVar('JoinStatus').enums = joinEnums

  }

  function start() {
  }

  function stop() {
    // Unjoin all current rooms
    let currStatus = base.getVar('JoinStatus')
    if (currStatus.value > 0) {
      let match = currStatus.string.match(/^\w+_(.+)$/)
      let group = match && config.groups.find(x => x.name === match[1])
      group && unJoinGroup(group)
    }
  }

  function tick() {
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function setJoin(params) {
    // params.Status = "Unjoined", "Initiated_<GROUP_NAME>", "Accepted_<GROUP_NAME>", or "Joined_<GROUP_NAME>"
    let currStatus = base.getVar('JoinStatus')
    let match_init = params.Status.match(/Initiated_(.+)/)
    let match_accept = params.Status.match(/Accepted_(.+)/)
    let match_joined = params.Status.match(/Joined_(.+)/)

    /********************************* INITIATED *********************************/
    if (match_init) {
      if (currStatus.value === 0) {
        let group = config.groups.find(x => x.name === match_init[1])
        // Check all rooms for valid JoinStatus enums
        if (initCheck(group)) {
          currStatus.string = params.Status  // Set join status first, to avoid infinite loop
          // All rooms have been configured properly, continue with initiating join
          for (let room of group.rooms) {
            let roomStatus = host.getVariable(`${room}.JoinStatus`)
            if (roomStatus.value === 0) roomStatus.string = `Initiated_${group.name}`
          }
          initJoinTimeout(group)
        }
      }
      else {
        logger.error(`Joins can only be initiated from an unjoined state: ${params.Status}`)
      }
    }

    /********************************* ACCEPTED *********************************/
    else if (match_accept) {
      if (currStatus.string === `Initiated_${match_accept[1]}`) {
        // Current status must be "Initiated" and match group name
        currStatus.string = params.Status  // Set to Accepted
        let group = config.groups.find(x => x.name === match_accept[1])
        // Check all rooms in group, and if all have accepted, set all rooms as joined
        if (acceptCheck(group)) {
          if (group.joinTimeout) clearTimeout(group.joinTimeout)
          currStatus.string = `Joined_${group.name}`
          for (let room of group.rooms) {
            host.setVariable(`${room}.JoinStatus`, `Joined_${group.name}`)
          }
        }
      }
      else {
        logger.error(`Joins can only be accepted from an initiated state for that group: ${params.Status}`)
      }
    }

    /********************************* JOINED *********************************/
    else if (match_joined) {
      let group = config.groups.find(x => x.name === match_joined[1])
      // This will only be set from other room behaviours. To safeguard, check that all rooms in group are accepted or joined already
      if (currStatus.string === `Accepted_${match_joined[1]}` && joinedCheck(group)) {
        // Current status must be "Accepted" and match group name. Also other rooms in group must be either accepted or joined.
        currStatus.string = params.Status  // Set to Joined
        if (group.joinTimeout) clearTimeout(group.joinTimeout)  // If timeout is active, clear it
      }
      else {
        logger.error(`JoinStatus can't be set to "Joined" manually, you must initiate the join first, then accept: ${params.Status}`)
      }
    }
    
    /********************************* UNJOINED *********************************/
    else if (params.Status === 'Unjoined') {
      let match = currStatus.string.match(/^\w+_(.+)$/)
      if (match) {
        let group = config.groups.find(x => x.name === match[1])
        unJoinGroup(group)
      }
    }
    
    /********************************* ERROR *********************************/
    else {
      logger.error(`Could not process JoinStatus: ${params.Status}`)
    }
  }


  // ------------------------------ HELPER FUNCTIONS ------------------------------

  function initCheck(group) {
    // Make sure all rooms in the group possess a JoinStatus enum variable with a matching group name
    try {
      return group.rooms.reduce( (acc, roomName) => {
        let roomStatus = host.getVariable(`${roomName}.JoinStatus`)
        if ( roomStatus.enums && roomStatus.enums.includes(`Initiated_${group.name}`) ) {
          return acc && true
        }
        else {
          logger.error(`Could not initiate join for ${roomName}, please ensure join-group ${group.name} has been configured correctly.`)
          return false
        }
      }, true)
    }
    catch(error) {
      logger.error(`initCheck failed: ${error.message}`)
      return false
    }
  }

  function initJoinTimeout(group) {
    // If all rooms in group are not approved before timeout ends, rooms become unjoined
    let timeout_ms = group.timeout * 60 * 1000  // group.timeout is in minutes
    group.joinTimeout = setTimeout(() => {
      logger.debug(`Join Group ${group.name} has timed out, resetting to Unjoined state.`)
      unJoinGroup(group)
      group.joinTimeout = null
    }, timeout_ms)
    logger.debug(`Setting room join timeout for ${timeout_ms}ms`)
  }

  function acceptCheck(group) {
    // Return true if all rooms in group have accepted join request
    try {
      return group.rooms.reduce( (acc, roomName) => {
        let roomStatus = host.getVariable(`${roomName}.JoinStatus`)
        return acc && roomStatus.string === `Accepted_${group.name}`
      }, true)
    }
    catch(error) {
      logger.error(`acceptCheck failed: ${error.message}`)
      return false
    }
  }

  function joinedCheck(group) {
    // Return true if all rooms in group have EITHER accepted join request, or already in joined mode
    try {
      return group.rooms.reduce( (acc, roomName) => {
        let roomStatus = host.getVariable(`${roomName}.JoinStatus`)
        let acceptCheck = (roomStatus.string === `Accepted_${group.name}`)
        let joinedCheck = (roomStatus.string === `Joined_${group.name}`)
        return acc && (acceptCheck || joinedCheck)
      }, true)
    }
    catch(error) {
      logger.error(`joinedCheck failed: ${error.message}`)
      return false
    }
  }

  function unJoinGroup(group) {
    // First, ensure this rooms JoinStatus is reset. Then set all rooms in group to unjoined.
    try {
      base.getVar('JoinStatus').value = 0
      for (let room of group.rooms) {
        let roomStatus = host.getVariable(`${room}.JoinStatus`)
        if (roomStatus.value > 0) {
          logger.debug(`Unjoining room ${room}`)
          roomStatus.value = 0
        }
      }
      if (group.joinTimeout) clearTimeout(group.joinTimeout)
    }
    catch(error) {
      logger.error(`unJoinGroup ${group.name} failed: ${error.message}`)
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    setJoin
  }
}