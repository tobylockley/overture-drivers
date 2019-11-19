/**
 * ToDo
 * - When initiating join, use host.perform instead of setVariable to send additional params (e.g. Slave = true)
 * - Make room timeout in seconds
 * - Group name optional, if blank, just use GroupX in enum vars
 * - Change status enum vars to Initiated: , Accepted: , Joined: etc with full group name (spaces ok)
 * - Error during setup if multiple groups contain exact same rooms
 * - Error during setup if multiple groups have same nickname
 */

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
    for (let i = 0; i < config.groups.length; i++) {
      const group = config.groups[i]
      if (group.name === '') group.name = `Group ${i+1}`
      joinEnums.push(`Initiated: ${group.name}`)
      joinEnums.push(`Accepted: ${group.name}`)
      joinEnums.push(`Joined: ${group.name}`)
    }
    base.getVar('JoinStatus').enums = joinEnums
  }

  function start() {
  }

  function stop() {
    // Unjoin all current rooms
    let currStatus = base.getVar('JoinStatus')
    if (currStatus.value > 0) {
      let match = currStatus.string.match(/^\w+: (.+)$/)  // Match group name
      let group = match && config.groups.find(x => x.name === match[1])
      group && unJoinGroup(group)
    }
  }

  function tick() {
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function setJoin(params) {
    // params.Status = "Unjoined", "Initiated: <GROUP NAME>", "Accepted: <GROUP NAME>", or "Joined: <GROUP NAME>"
    let currStatus = base.getVar('JoinStatus')
    let match = params.Status.match(/^([A-Za-z]+): (.+)$/)
    let group = match && config.groups.find(x => x.name === match[2])
    let status_init = group && `Initiated: ${group.name}`
    let status_acpt = group && `Accepted: ${group.name}`
    let status_join = group && `Joined: ${group.name}`

    /********************************* INITIATED *********************************/
    if (match && match[1] === 'Initiated') {
      if (group && currStatus.value === 0) {
        if (initCheck(group)) {  // Check all rooms are configured with same group
          currStatus.string = status_init  // Set join status first, to avoid infinite loop
          for (let room of group.rooms) {
            host.setVariable(`${room}.JoinStatus`, status_init)  // This triggers init state for all rooms in group
          }
          initJoinTimeout(group)
        }
      }
      else {
        logger.error(`Joins can only be initiated from an unjoined state: ${params.Status}`)
      }
    }

    /********************************* ACCEPTED *********************************/
    else if (match && match[1] === 'Accepted') {
      if (group && currStatus.string === status_init) {  // Current status must be "Initiated" and match group name
        if (acceptCheck(group)) {  // Check if all rooms in group have already accepted, then trigger room join
          if (group.joinTimeout) clearTimeout(group.joinTimeout)
          currStatus.string = status_join
          for (let room of group.rooms) {
            host.setVariable(`${room}.JoinStatus`, status_join)  // This will trigger the "Joined" code below for all rooms in group
          }
        }
        else {
          currStatus.string = status_acpt  // Set this room to Accepted
        }
      }
      else {
        logger.error(`Joins can only be accepted from an initiated state of the same group: ${params.Status}`)
      }
    }

    /********************************* JOINED *********************************/
    else if (match && match[1] === 'Joined') {
      if (group && currStatus.string === status_acpt && joinCheck(group)) {
        // Current status must be "Accepted" and match group name. Also other rooms in group must be either accepted or joined.
        if (group.joinTimeout) clearTimeout(group.joinTimeout)  // If timeout is active, clear it
        currStatus.string = status_join  // Set this room to Joined
      }
      else {
        logger.error(`JoinStatus can't be set to "Joined" manually, you must initiate the join first, then accept: ${params.Status}`)
      }
    }
    
    /********************************* UNJOINED *********************************/
    else if (params.Status === 'Unjoined') {
      let match_curr = currStatus.string.match(/^[A-Za-z]+: (.+)$/)
      if (match_curr) {
        let group_curr = config.groups.find(x => x.name === match_curr[1])
        group_curr && unJoinGroup(group_curr)
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
        if (roomStatus && roomStatus.enums && roomStatus.enums.includes(`Initiated: ${group.name}`)) {
          return acc && true
        }
        else {
          logger.error(`Could not initiate join, please ensure join group (${group.name}) has been configured for ${roomName}.`)
          return false
        }
      }, true)  // true = initial value
    }
    catch(error) {
      logger.error(`initCheck failed: ${error.message}`)
      return false
    }
  }

  function initJoinTimeout(group) {
    // If all rooms in group are not approved before timeout ends, rooms become unjoined
    let timeout_ms = group.timeout * 1000  // group.timeout is in seconds
    group.joinTimeout = setTimeout(() => {
      logger.debug(`Join Group ${group.name} has timed out, resetting to Unjoined state.`)
      unJoinGroup(group)
      group.joinTimeout = null
    }, timeout_ms)
    logger.debug(`Setting room join timeout for ${group.timeout} seconds`)
  }

  function acceptCheck(group) {
    // Return true if all rooms in group have accepted join request
    try {
      return group.rooms.reduce( (acc, roomName) => {
        let roomStatus = host.getVariable(`${roomName}.JoinStatus`)
        return acc && roomStatus.string === `Accepted: ${group.name}`
      }, true)  // true = initial value
    }
    catch(error) {
      logger.error(`acceptCheck failed: ${error.message}`)
      return false
    }
  }

  function joinCheck(group) {
    // Return true if all rooms in group have EITHER accepted join request, or already in joined mode
    try {
      return group.rooms.reduce( (acc, roomName) => {
        let roomStatus = host.getVariable(`${roomName}.JoinStatus`)
        let acceptedCheck = (roomStatus.string === `Accepted: ${group.name}`)
        let joinedCheck = (roomStatus.string === `Joined: ${group.name}`)
        return acc && (acceptedCheck || joinedCheck)
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
        if (host.getVariable(`${room}.JoinStatus`) > 0) {
          logger.debug(`Unjoining room ${room}`)
          host.setVariable(`${room}.JoinStatus`, 0)
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