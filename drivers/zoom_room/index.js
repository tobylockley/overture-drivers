'use strict'

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 30000           // Continuous polling function interval

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let sshClient
  let sshStream

  let frameParser = host.createFrameParser()
  frameParser.setSeparator(/^\{$[\s\S]+^\}$/m)
  // frameParser.setSeparator('}\r\n')
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }
  function isInMeeting() { return base.getVar('MeetingStatus').string === 'In Meeting' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    // Register polling functions
    base.setPoll({
      action: 'getMeetingStatus',
      period: POLL_PERIOD,
      enablePollFn: isConnected,
      startImmediately: true,
      params: {}
    })
  }

  function start() {
    // initSshClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    sshClient && sshClient.end()
    sshClient = null
    sshStream && sshStream.end()
    sshStream = null
    base.stopPolling()
    base.clearPendingCommands()
  }

  function tick() {
    // if (!sshClient) initSshClient()
  }

  function initSshClient() {
    if (sshClient) return  // Return if sshClient already exists

    sshClient = new require('ssh2').Client()
    sshClient.on('ready', () => {
      
      sshClient.shell( (err, stream) => {
        if (err) {
          logger.error('sshClient shell error:', err.message)
          stop()
          return
        }

        sshStream = stream

        stream.on('close', () => {
          console.log('sshStream :: close')
          stop()
        })

        stream.on('data', (data) => {
          // console.log('sshStream data: ' + data.toString().replace(/\n/g, '{N}\n').replace(/\r/g, '{R}\r'))
          frameParser.push(data.toString())
        })
        
        logger.debug('sshClient connected. Sending initial config commands')

        // Set initial settings, and also enable polling after a delay
        setTimeout( () => {
          send('format json')
          send('echo off')
          send('zFeedback Deregister Path: /Event/InfoResult/info/callin_country_list')
          send('zConfiguration Client deviceSystem: Overture')
          base.getVar('Status').string = 'Connected'
          base.startPolling()
        }, 1000)
      })
    })

    sshClient.on('continue', () => {
      logger.debug('sshClient continue')
    })

    sshClient.on('data', data => {
      logger.debug('sshClient data', data)
      // frameParser.push(data.toString())
    })

    sshClient.on('end', () => {
      logger.debug('sshClient end')
    })

    sshClient.on('close', () => {
      logger.debug('sshClient close')
    })

    sshClient.on('error', err => {
      logger.error(`sshClient: ${err.message}`)
      stop()  // Throw out the sshClient and get a fresh connection
    })

    sshClient.connect({
      host: config.host,
      port: config.port,
      username: 'zoom',
      password: config.password
    })
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function send(data) {
    logger.silly(`sshClient send: ${data}`)
    return sshStream && sshStream.write(data + '\r')
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError('Data not sent')
  }

  function onFrame(data) {
    const pendingCommand = base.getPendingCommand()
    let json
    try {
      json = JSON.parse(data)
    }
    catch (error) {
      logger.error('onFrame error parsing JSON:', error.message)
    }

    if (json) {
      logger.debug(`onFrame (${pendingCommand && pendingCommand.action}): \n${data}`)

      if (json.type == 'zCommand') {

        if (json.topKey == 'CallDisconnectResult' && json.Status.state == 'OK') {
          pendingCommand && base.commandDone()
        }
        else if (json.topKey == 'DialStartPmiResult' && json.Status.state === 'OK') {
          pendingCommand && base.commandDone()
        }

        // getCallInfo
        else if (json.topKey == 'InfoResult' && json.Status.state === 'OK') {
          pendingCommand && json.Sync === true && base.commandDone(json.InfoResult)
          base.getVar('MeetingId').string = json.InfoResult.meeting_id
        }

        // getPhonebook
        else if (json.topKey == 'PhonebookListResult' && json.Status.state === 'OK') {
          pendingCommand && json.Sync === true && base.commandDone(json.PhonebookListResult.Contacts)
        }

        // getParticipants
        else if (json.topKey == 'ListParticipantsResult' && json.Status.state === 'OK') {
          pendingCommand && json.Sync === true && base.commandDone(json.ListParticipantsResult)
        }

        // joinMeeting
        else if (json.topKey == 'DialJoinResult' && json.Status.state === 'OK') {
          pendingCommand && json.Sync === true && base.commandDone()
        }

      }
      else if (json.type == 'zConfiguration') {

        // let micMute = checkJson(json, ['Call', 'Microphone', 'Mute'])
        // if ()

      }
      else if (json.type == 'zStatus') {

        // MeetingStatus, could be syncronous or event driven
        if (json.topKey == 'Call' && json.Call.Status == 'NOT_IN_MEETING') {
          base.getVar('MeetingStatus').string = 'Not In Meeting'
          base.getVar('MeetingId').string = ''
          pendingCommand && base.commandDone()
        }
        else if (json.topKey == 'Call' && json.Call.Status == 'CONNECTING_MEETING') {
          base.getVar('MeetingStatus').string = 'Connecting Meeting'
          pendingCommand && base.commandDone()
        }
        else if (json.topKey == 'Call' && json.Call.Status == 'IN_MEETING') {
          base.getVar('MeetingStatus').string = 'In Meeting'
          pendingCommand && base.commandDone()
        }
        else if (json.topKey == 'Call' && (json.Call.Status == 'LOGGED_OUT' || json.Call.Status == 'UNKNOWN')) {
          base.getVar('MeetingStatus').string = 'Unknown'
          base.getVar('MeetingId').string = ''
          pendingCommand && base.commandDone()
        }

      }
      else if (json.type == 'zEvent') {
  
        // getBookings
        if (json.topKey == 'BookingsListResult' && json.Status.state == 'OK' && json.Sync === true) {
          pendingCommand && base.commandDone(json.BookingsListResult)
        }
  
      }

    }
    else {
      logger.warn('onFrame data not processed:', data)
    }
  }


  // ------------------------------ GET FUNCTIONS ------------------------------

  function getMeetingStatus() {
    sendDefer('zStatus Call Status')
  }

  function getCallInfo() {
    if (isInMeeting()) {
      sendDefer('zCommand Call Info')
    }
    else {
      logger.error('Could not run getCallInfo, not in a meeting')
      return 'Error: Not In Meeting'
    }
  }

  function getBookings() {
    sendDefer('zCommand Bookings List')
  }

  function getPhonebook() {
    sendDefer('zCommand Phonebook List Offset: 0 Limit: 1000')
  }

  function getParticipants() {
    if (isInMeeting()) {
      sendDefer('zCommand Call ListParticipants')
    }
    else {
      logger.error('Could not run getParticipants, not in a meeting')
      return 'Error: Not In Meeting'
    }
  }


  // ------------------------------ SET FUNCTIONS ------------------------------

  function startMeeting(params) {
    sendDefer(`zCommand Dial Start meetingNumber: ${params.MeetingNumber}`)
  }

  function startInstantMeeting(params) {
    sendDefer(`zCommand Dial StartPmi Duration: ${params.Duration}`)
  }

  function joinMeeting(params) {
    sendDefer(`zCommand Dial Join meetingNumber: ${params.MeetingNumber}`)
  }

  function endMeeting() {
    if (base.getVar('MeetingStatus').string != 'In Meeting') {
      logger.error('Can\'t end meeting, not in meeting')
    }
    else {
      sendDefer('zCommand Call Disconnect')
    }
  }


  // ------------------------------ HELPER FUNCTIONS ------------------------------

  function checkJson(json, keys, value) {
    // Accepts an array of possibly nested keys, and returns true if value matches
    let ref = json
    const lastKey = keys[keys.length - 1]
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (ref.constructor.name === 'Object' && ref[key]) {
        if (key === lastKey && value) {
          if (ref[key] === value) return true
          else return false
        }
        else if (key === lastKey) {
          return ref[key]
        }
        else {
          ref = ref[key]
        }
      }
      else {
        return false
      }
    }
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    getMeetingStatus, getCallInfo, getBookings, getPhonebook, getParticipants,
    startMeeting, startInstantMeeting, joinMeeting, endMeeting
  }
}