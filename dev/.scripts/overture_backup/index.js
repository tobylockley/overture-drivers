var request = require('request-promise-native');
var fs = require('fs');
var path = require('path');
var url = require('url');
var moment = require('moment');

const config = JSON.parse(fs.readFileSync('./config.json'));
!fs.existsSync(config.backupDirectory) && fs.mkdirSync(config.backupDirectory);  // Create backup directory if it doesn't exist

// !fs.existsSync('logs') && fs.mkdirSync('logs');  // Create logs directory if it doesn't exist
// let logfile = fs.createWriteStream( path.resolve('logs', moment().format("YYYY-MM-DD_kk-mm-ss.txt")) );
const TS = function() { return moment().format("YYYY-MM-DD kk:mm:ss") };

// server object must contain .url and .token objects (see config.json)


function createBackup(server) {
  return new Promise( function(resolve, reject) {
    console.log(`[${TS()}] (${server.url}) Creating backup ...`);

    request.post({ url: server.url + '/api/v2/backup', auth: {'bearer': server.token}, json: true })
    .then( response => {
      console.log(`[${TS()}] (${server.url}) Backup complete.`);
      (response.status == "completed") && resolve(response.archive);
      (response.status != "completed") && reject(response);
    })
    .catch( error => {
      console.error(`[${TS()}] (${server.url}) Error:`, error);
      reject(error);
    })
  });
}


function downloadBackup(server, filename) {
  console.log(`[${TS()}] (${server.url}) Fetching backup ${filename} ...`);

  let foldername = path.join(config.backupDirectory, url.parse(server.url).hostname);
  !fs.existsSync(foldername) && fs.mkdirSync(foldername);  // Create directory if it doesn't already exist
  let output = path.resolve(foldername, filename);

  request.get({ url: server.url + `/backups/${filename}`, auth: {'bearer': server.token} })
  .then( response => {
    fs.writeFileSync(output, response);
    console.log(`[${TS()}] (${server.url}) Backup saved to ${output}`);
  })
  .catch( error => {
    console.error(`[${TS()}] (${server.url}) Error:`, error);
  })
}


function syncBackups(server) {
  let request_basic = require('request');
  let doneCount = 0;
  console.log(`[${TS()}] (${server.url}) Syncing backups ...`);

  let foldername = path.join(config.backupDirectory, url.parse(server.url).hostname);
  !fs.existsSync(foldername) && fs.mkdirSync(foldername);  // Create directory if it doesn't already exist

  request.get({ url: server.url + '/api/v2/backup', auth: {'bearer': server.token} })
  .then( response => {
    let backupList = JSON.parse(response);
    console.log(`[${TS()}] (${server.url}) File list retrieved, downloading ${backupList.length} files ...`);
    backupList.forEach((backup, i) => {
      let output = path.resolve(foldername, backup.filename);
      request_basic.get({ url: server.url + `/backups/${backup.filename}`, auth: {'bearer': server.token} })
      .pipe(fs.createWriteStream(output))
      .on('finish', () => {
        if (++doneCount == backupList.length) console.log(`[${TS()}] (${server.url}) All backups saved to ${foldername}`)
      });

    });
  })
  .catch( error => {
    console.error(`[${TS()}] (${server.url}) Error:`, error);
  })
}


function downloadAllBackups(server) {
  let request_basic = require('request');
  let doneCount = 0;
  console.log(`[${TS()}] (${server.url}) Syncing backups ...`);

  let foldername = path.join(config.backupDirectory, url.parse(server.url).hostname);
  !fs.existsSync(foldername) && fs.mkdirSync(foldername);  // Create directory if it doesn't already exist

  request.get({ url: server.url + '/api/v2/backup', auth: {'bearer': server.token} })
  .then( response => {
    let backupList = JSON.parse(response);
    console.log(`[${TS()}] (${server.url}) File list retrieved, downloading ${backupList.length} files ...`);
    backupList.forEach((backup, i) => {
      let output = path.resolve(foldername, backup.filename);
      request_basic.get({ url: server.url + `/backups/${backup.filename}`, auth: {'bearer': server.token} })
      .pipe(fs.createWriteStream(output))
      .on('finish', () => {
        if (++doneCount == backupList.length) console.log(`[${TS()}] (${server.url}) All backups saved to ${foldername}`)
      });

    });
  })
  .catch( error => {
    console.error(`[${TS()}] (${server.url}) Error:`, error);
  })
}


function deleteBackup(server, filename) {
  // Not yet used
  console.log(`[${TS()}] (${server.url}) Deleting backup ${filename} ...`);

  request.delete({ url: server.url + `/backups/${filename}`, auth: {'bearer': server.token}, })
  .then( response => {
    console.log(response)
  })
  .catch( error => {
    console.error(`[${TS()}] (${server.url}) Error:`, error);
  })
}


// CODE EXECUTION BEGINS HERE ------------------------------------------------------------------------------------------

config.servers.forEach(server => {
  config.performNewBackup && createBackup(server).then(filename => downloadBackup(server, filename));
  config.syncBackups && syncBackups(server);
});