'use strict'

// Put some instructions here about how to generate credentials and enable google API

const TICK_PERIOD = 10000           // In-built tick interval
const POLL_PERIOD = 10000           // Continuous polling function interval

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let googleAuth = null

  const fs = require('fs')
  const path = require('path')
  const {google} = require('googleapis')
  const SCOPES = ['https://www.googleapis.com/auth/drive.file']
  const PKG_PATH = path.join(__dirname, 'package.json')
  const CRED_PATH = path.join(__dirname, 'credentials.json')
  const TOKEN_PATH = path.join(__dirname, 'token.json')
  // If modifying SCOPES, delete token.json.
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first time

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() { return base.getVar('Status').string === 'Connected' }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    // Register polling functions
    // base.setPoll({ action: 'listFiles', period: POLL_PERIOD, enablePollFn: isConnected, startImmediately: true })
    console.log(host)
    fs.readdir(path.join(__dirname, '../'), (err, files) => {
      if (err) return console.error(err)
      console.log(files)
    })
  }

  function start() {
    // base.startPolling()
    tick()  // Get the connection state straight away
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
    base.clearPendingCommands()
    googleAuth = null
  }

  async function tick() {
    console.log('tick')
    !googleAuth && initGoogleAuth()
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function initGoogleAuth() {
    // Load client secrets from a local file.
    fs.readFile(CRED_PATH, (err, content) => {
      if (err) return logger.error('Error loading client secret file:', err.message)
      // Authorize a client with credentials, and initialize status and auth object
      let credentials = JSON.parse(content)
      authorize(credentials, (auth) => {
        googleAuth = auth
        logger.debug('Google authentication successful')
        base.getVar('Status').string = 'Connected'
        base.startPolling()
      })
    })
  }


  // ------------------------------ DRIVER FUNCTIONS ----------------------------------

  function syncBackups() {
  }

  function listFiles() {
    if (!googleAuth) return logger.error('Module not authenticated with google.')
    
    const drive = google.drive({version: 'v3', auth: googleAuth})
    drive.files.list({
      fields: '*'
    }, (err, res) => {
      if (err) return logger.error('The Google API returned an error:', err.message)
      const files = res.data.files
      if (files.length) {
        console.log('Files:')
        files.map((file) => {
          console.log(`${file.name} (${file.id})`)
        })
      } else {
        console.log('No files found.')
      }
    })
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
    
    if (config.authCode) {
      // Auth code exists in config. Check for existing token, otherwise generate one.
      fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, config.authCode, callback)
        oAuth2Client.setCredentials(JSON.parse(token))
        callback(oAuth2Client)
      })
    }
    else {
      // No auth code supplied, or it has been deleted. If token.json exists, delete it
      fs.unlink(TOKEN_PATH, (err) => {
        if (err && err.code !== 'ENOENT') logger.error(err.message)
      })

      // Display auth URL in logs for user
      let authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      })
      let text = `To generate an authentication code, <b><a href='${authUrl}'>CLICK HERE</a></b>.`
      // updateConfigDescription('authCode', text)
      logger.info('Authorization required, please open this url:', authUrl)
      logger.info('Paste the generated code into this modules setup, under "Google Authentication Code"')
    }
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getAccessToken(oAuth2Client, code,  callback) {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return logger.error('Error retrieving access token:', err.message)
      oAuth2Client.setCredentials(token)
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), (err) => {
        if (err) return logger.error(err.message)
        logger.info('Google authentication token stored in', TOKEN_PATH)
      })
      callback(oAuth2Client)
    })
  }

  /**
   * Update config properties description.
   * @param {string} configProp Name of config property
   * @param {string} description Description text, can be html
   */
  function updateConfigDescription(configProp, description) {

    fs.readFile(PKG_PATH, (err, content) => {
      if (err) return logger.error('Error opening package.json file:', err.message)
      // Authorize a client with credentials, and initialize status and auth object
      let pkg = JSON.parse(content)
      let thisConfig = pkg.overture.pointSetupSchema.properties[configProp]
      if (thisConfig) {
        if (thisConfig.description && thisConfig.description !== description) {
          thisConfig.description = description
          fs.writeFile(PKG_PATH, JSON.stringify(pkg, null, 2), (err) => {
            if (err) logger.error(err.message)
            else logger.silly('Updated description of config property', configProp, 'to:', description)
          })
        }
      }
      else {
        logger.error('Could not find config property', configProp)
      }
    })
  }


  // ------------------------------ EXPORTED FUNCTIONS ------------------------------
  return {
    setup, start, stop, tick,
    syncBackups, listFiles
  }
}