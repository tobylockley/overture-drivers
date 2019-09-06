'use strict'

// This file should be run from terminal
// Will generate an auth URL


const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')
const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const CRED_PATH = path.join(__dirname, 'credentials.json')

fs.readFile(CRED_PATH, (err, content) => {
  if (err) return console.error('Error loading client secret file:', err.message)

  const credentials = JSON.parse(content)
  const { client_secret, client_id, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })

  console.log('\nCopy URL below:\n', authUrl)
})