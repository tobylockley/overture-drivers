'use strict'

// Put some instructions here about how to generate credentials and enable google API

const CMD_DEFER_TIME = 3000        // Timeout when using commandDefer
const TICK_PERIOD = 5000           // In-built tick interval
const POLL_PERIOD = 5000           // Continuous polling function interval
const REQUEST_TIMEOUT = 3000       // Timeout for AJAX requests

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let googleAuth

  const fs = require('fs')
  const {google} = require('googleapis')
  // If modifying these scopes, delete token.json.
  const SCOPES = ['https://www.googleapis.com/auth/drive.file']
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  const TOKEN_PATH = 'token.json'

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    // Register polling functions
    // base.setPoll({ action: 'getPower', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    if (!config.authCode) {
      logger.info('Authorize this module by visiting this url:', authUrl)
      logger.info('Paste the supplied code into this modules setup')
    }
  }

  function start() {
    // base.startPolling()
    // tick()  // Get the connection state straight away
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
    base.clearPendingCommands()
    googleAuth = null
  }

  async function tick() {
    !googleAuth && initGoogleAuth()
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function initGoogleAuth() {
    // Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
      if (err) return logger.error('Error loading client secret file:', err.message)
      // Authorize a client with credentials, then call the Google Drive API.
      // authorize(JSON.parse(content), listFiles)
      authorize(JSON.parse(content), (auth) => {
        googleAuth = auth
        base.getVar('Status').string = 'Connected'
        base.startPolling()
      })
    })
  }

  async function req(cmdString) {
    base.commandDefer(CMD_DEFER_TIME)
    try {
      logger.silly(`Running REST request > ${cmdString}`)
      const options = {
        method: 'POST',
        uri: `http://${config.host}/rcCmd.php`,
        timeout: REQUEST_TIMEOUT,
        form: {
          commands: cmdString
        }
      }
      let response = await host.request(options)
      response = JSON.parse(response)
      let zyperResponse = response.responses[0]
      for (let warning of zyperResponse.warnings) logger.warn(`zyperCmd warning > ${warning}`)
      if (zyperResponse.errors.length > 0) throw new Error(zyperResponse.errors[0])
      base.commandDone()
      return zyperResponse
    }
    catch (error) {
      base.commandError(error.message)
      throw new Error(`zyperCmd failed > ${error.message}`)
    }
  }


  // ------------------------------ DRIVER FUNCTIONS ------------------------------

  function resetCredentials(params) {
    if (params.Status === 1) {
      logger.debug('Resetting Google Drive credentials...')
      fs.unlink(TOKEN_PATH, (err) => {
        if (err) throw err
        logger.debug('Google credentials successfully deleted!')
        stop()
      })
    }
  }


  // ------------------------------ GOOGLE API FUNCTIONS ------------------------------


  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oAuth2Client, callback)
      oAuth2Client.setCredentials(JSON.parse(token))
      callback(oAuth2Client)
    })
  }


  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function generateAuthUrl(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    })
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    })
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err)
      oAuth2Client.setCredentials(token)
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err)
        console.log('Token stored to', TOKEN_PATH)
      })
      callback(oAuth2Client)
    })
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    resetCredentials
  }
}