'use strict'

// Put some instructions here about how to generate credentials and enable google API

/** TODO
 * Delete files after upload
 * Only upload if folderId not in parents
 *
 * Overture User Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXljbG9ha0lkIjoiYWVmMDNhM2UtMDIxYy00ZjI3LTljNzUtNDdiOTI0OTE1ODI5IiwiaWQiOiI1YjcyMjdhNjdjMTQzYjAwMGU1YzY2ODAiLCJuYW1lIjoiQVBJIiwicm9sZXMiOlt7ImlkIjoic3lzdGVtIiwibmFtZSI6IlN5c3RlbSIsImFsdG5hbWUiOiJzeXN0ZW0iLCJzeXN0ZW0iOnRydWUsImhyY19hY2Nlc3NfcmlnaHRzIjoxMDAsImhyY19hbGFybXNfcmlnaHRzIjoxMDAsInJvbGVfaWQiOiJzeXN0ZW0ifV0sInVzZXJuYW1lIjoiYXBpIn0.1XM6YossFjF_LdmkJChKda5dWoFzjrBHQGtOZoI2ezg
 * Google Auth Code: 4/qQHO8KFOqRTRCTI8PKc0E_YGHjJZNb578XOkfXaI7L4zU2r6h_uf8iY
 * Driver Folder ID: 17Itlz9UpFlRYw_YcFVr4d7cWkGWd9Q2g
 */

const TICK_PERIOD = 5000 // In-built tick interval
const REQUEST_TIMEOUT = 5000 // Timeout for AJAX requests
const DEBUG_URL = 'http://localhost:8000' // This is used during development

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let googleAuth = null
  let uxUrl

  const fs = require('fs')
  const path = require('path')
  const { google } = require('googleapis')
  const SCOPES = ['https://www.googleapis.com/auth/drive.file']
  const CRED_PATH = path.join(__dirname, 'credentials.json')
  const TOKEN_PATH = path.join(__dirname, 'token.json')
  // If modifying SCOPES, delete token.json.
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first time

  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function isConnected() {
    return base.getVar('Status').string === 'Connected'
  }

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)
    // Register polling functions
  }

  function start() {
    // base.startPolling()
    tick() // Get the connection state straight away
    getUxUrl()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    base.stopPolling()
    base.clearPendingCommands()
    googleAuth = null
  }

  async function tick() {
    !googleAuth && base.getVar('Activity').value && initGoogleAuth()
  }

  /* #region DRIVER FUNCTIONS *********************************************************************/

  async function syncBackups() {
    if (!googleAuth)
      return logger.error('Module not authenticated with google.')
    if (!config.folderId) return logger.error('Please specify a folder ID.')
    try {
      let backupList = JSON.parse(
        await apiCall(`${uxUrl}/api/v2/backup`, 'GET')
      )
      backupList = backupList.map(x => x.filename)
      // console.log(backupList)

      // Get list of all files in google drive folder
      let cloudList = await getCloudBackups()
      console.log('cloudList:', cloudList)

      let uploadList = backupList.filter(filename => {
        // If it does not exist in google drive folder, add to list
        let cloudFile = cloudList.find(x => x.name === filename)
        return !(cloudFile && cloudFile.parents.includes(config.folderId))
      })
      console.log('uploadList:', uploadList)

      if (uploadList.length === 0) {
        logger.info('All Overture backups have been synced to Google Drive.')
      }
      else {
        for (let filename of uploadList) {
          syncFile(filename) // Download from UX, then upload to cloud
        }
      }
    }
    catch (err) {
      logger.error('Error syncing backups:', err.message)
    }
  }

  /* #endregion */

  /* #region HELPER FUNCTIONS ***************************************************************/

  /**
   * Get UX URL from this control servers config.json
   */
  function getUxUrl() {
    try {
      let content = fs.readFileSync(path.join(__dirname, '../../config.json'))
      uxUrl = JSON.parse(content).UXURI
      logger.silly('uxUrl:', uxUrl)
    }
    catch (err) {
      uxUrl = DEBUG_URL
      logger.error('Error loading config.json, using DEBUG_URL:', DEBUG_URL)
    }
  }

  /**
   * Make a REST request using config token, return response data (async)
   */
  async function apiCall(url, method, data) {
    // Issue an API request using Bearer token, and pass optional data (e.g. using POST)
    try {
      const options = {
        method: method,
        uri: url,
        timeout: REQUEST_TIMEOUT,
        headers: {
          Authorization: `Bearer ${config.uxToken}`
        },
        body: data
      }
      let response = await host.request(options)
      return response
    }
    catch (err) {
      logger.error('apiCall error:', err.message)
    }
  }

  /**
   * Retrieve a list of files in google drive for configured folder ID
   */
  function getCloudBackups() {
    if (!config.folderId) return logger.error('Please specify a folder ID.')
    return new Promise((resolve, reject) => {
      if (!googleAuth) {
        return reject(new Error('Module not authenticated with google.'))
      }
      const drive = google.drive({ version: 'v3', auth: googleAuth })
      drive.files.list(
        {
          q: `'${config.folderId}' in parents`,
          fields: '*'
        },
        (err, res) => {
          if (err) {
            return reject(err)
          }
          resolve(res.data.files)
        }
      )
    })
  }

  /**
   * Download file from UX, then upload to google drive
   */
  async function syncFile(filename) {
    if (!config.folderId) return logger.error('Please specify a folder ID.')
    const options = {
      method: 'GET',
      uri: `${uxUrl}/backups/${filename}`,
      timeout: REQUEST_TIMEOUT,
      headers: {
        Authorization: `Bearer ${config.uxToken}`
      }
    }
    const req = host.request(options)
    req.on('error', err => {
      console.error(err)
    })
    req.on('close', () => {
      logger.silly('File downloaded from UX:', filename)
      cloudUpload(filename, config.folderId)
    })
    req.on('response', res => {
      if (res.statusCode === 200) {
        req.pipe(fs.createWriteStream(path.join(__dirname, filename)))
      }
    })
  }

  /**
   * Upload local file to google drive, using configured folder ID
   * @param {string} filename
   * @param {string} folderId
   */
  function cloudUpload(filename, folderId) {
    return new Promise((resolve, reject) => {
      if (!googleAuth) {
        return reject(new Error('Module not authenticated with google.'))
      }
      const drive = google.drive({ version: 'v3', auth: googleAuth })
      drive.files.create(
        {
          resource: {
            name: filename,
            parents: [folderId]
          },
          media: {
            mimeType: 'application/zip',
            body: fs.createReadStream(path.join(__dirname, filename))
          },
          fields: '*'
        },
        (err, file) => {
          if (err) {
            return reject(err)
          }
          if (file.status == 200) {
            logger.debug(`File uploaded to Google Drive: ${filename}`)
          }
          else {
            logger.error(
              `Error uploading backup (${filename}): ${file.statusText}`
            )
          }
          resolve(file)
        }
      )
    })
  }

  // fs.createReadStream('ice.jpg').pipe(request.post('https://myserver.com/upload'))

  // return new Promise((resolve, reject) => {
  //   // Download file from UX
  //   apiCall(`${uxUrl}/backups/${filename}`, 'GET')
  //     .then(data => {
  //       console.log('backup downloaded')
  //     })
  // })

  /* #endregion */

  /* #region GOOGLE API FUNCTIONS *****************************************************************/

  /**
   * Initialize google authentication using stored credentials
   */
  function initGoogleAuth() {
    // Load client secrets from a local file.
    fs.readFile(CRED_PATH, (err, content) => {
      if (err)
        return logger.error('Error loading client secret file:', err.message)
      // Authorize a client with credentials, and initialize status and auth object
      let credentials = JSON.parse(content)
      authorize(credentials, auth => {
        googleAuth = auth
        logger.debug('Google authentication successful')
        base.getVar('Status').string = 'Connected'
        base.startPolling()
      })
    })
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    )

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
      fs.unlink(TOKEN_PATH, err => {
        if (err && err.code !== 'ENOENT') logger.error(err.message)
      })

      // Display auth URL in logs for user
      let authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
      })
      logger.info('Authorization required, please open this url:', authUrl)
      logger.info(
        'Paste the generated code into this modules setup, under "Google Authentication Code"'
      )
    }
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getAccessToken(oAuth2Client, code, callback) {
    oAuth2Client.getToken(code, (err, token) => {
      if (err)
        return logger.error('Error retrieving access token:', err.message)
      oAuth2Client.setCredentials(token)
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), err => {
        if (err) return logger.error(err.message)
        logger.info('Google authentication token stored in', TOKEN_PATH)
      })
      callback(oAuth2Client)
    })
  }

  /* #endregion */

  /* #region EXPORTED FUNCTIONS *******************************************************************/

  return {
    setup,
    start,
    stop,
    tick,
    syncBackups
  }

  /* #endregion */
}
