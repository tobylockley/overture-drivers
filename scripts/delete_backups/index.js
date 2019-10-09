const request = require('request-promise-native')
const UX_URL = 'https://avd.overture.barco.com'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXljbG9ha0lkIjoiY2FlNTU0NzMtYjc5OS00NGRlLTlkZjYtNjBlYWRlNGY2MDY5IiwiaWQiOiI1N2I3NTkxYWI0MWY1OTcwOGY3YTFiMTEiLCJuYW1lIjoiTWVkaWFsb24iLCJyb2xlcyI6W3siaWQiOiJzeXN0ZW0iLCJuYW1lIjoiU3lzdGVtIiwiYWx0bmFtZSI6InN5c3RlbSIsInN5c3RlbSI6dHJ1ZSwiaHJjX2FjY2Vzc19yaWdodHMiOjEwMCwiaHJjX2FsYXJtc19yaWdodHMiOjEwMCwicm9sZV9pZCI6InN5c3RlbSJ9XSwidXNlcm5hbWUiOiJtZWRpYWxvbiJ9.sK3ZbH2qsZyhatQL9DrpIW1Wk7SGJCrrAG9Kx7vh5wk'

for (let backup of require('./backups.json')) {
  
  request.del
  let options = {
    method: 'DELETE',
    uri: `${UX_URL}/backups/${backup.filename}`,
    headers: {
      Authorization: `Bearer ${TOKEN}`
    }
  }

  request(options)
    .then(function () {
      console.log('Successfully deleted', backup.filename)
    })
    .catch(function () {
      console.error('Error:', backup.filename)
    })
}