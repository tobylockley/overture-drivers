var request = require('request-promise-native');
var fs = require('fs');
var path = require('path');
var moment = require('moment');

const config = JSON.parse(fs.readFileSync('./config.json'));
!fs.existsSync(config.backupDirectory) && fs.mkdirSync(config.backupDirectory);  // Create backup directory if it doesn't exist

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
  return new Promise( function(resolve, reject) {
    console.log(`[${TS()}] (${server.url}) Fetching backup ${filename} ...`);

    let foldername = path.join(config.backupDirectory, server.folder);
    !fs.existsSync(foldername) && fs.mkdirSync(foldername);  // Create directory if it doesn't already exist
    let output = path.resolve(foldername, filename);

    request.get({ url: server.url + `/backups/${filename}`, auth: {'bearer': server.token} })
    .then( response => {
      fs.writeFileSync(output, response);
      console.log(`[${TS()}] (${server.url}) Backup saved to ${output}`);
      resolve(output);
    })
    .catch( error => {
      console.error(`[${TS()}] (${server.url}) Error:`, error);
      reject(error);
    })
  });
}


function syncBackups(server) {
  return new Promise( function(resolve, reject) {
    let request_basic = require('request');
    let doneCount = 0;
    console.log(`[${TS()}] (${server.url}) Syncing backups ...`);

    let foldername = path.join(config.backupDirectory, server.folder);
    !fs.existsSync(foldername) && fs.mkdirSync(foldername);  // Create directory if it doesn't already exist

    request.get({ url: server.url + '/api/v2/backup', auth: {'bearer': server.token} })
    .then( response => {
      let backupList = JSON.parse(response);
      console.log(`[${TS()}] (${server.url}) File list retrieved, syncing ${backupList.length} files ...`);
      backupList.forEach(backup => {
        let output = path.resolve(foldername, backup.filename);
        if (fs.existsSync(output) == false) {
          request_basic.get({ url: server.url + `/backups/${backup.filename}`, auth: {'bearer': server.token} })
          .pipe(fs.createWriteStream(output))
          .on('finish', () => {
            if (++doneCount === backupList.length) {
              console.log(`[${TS()}] (${server.url}) All backups synced to ${foldername}`);
              resolve();
            }
          });
        }
        else if (++doneCount === backupList.length) {
          // FILE ALREADY EXISTS, JUST CHECK THE DONECOUNT
          console.log(`[${TS()}] (${server.url}) All backups synced to ${foldername}`);
          resolve();
        }
      });
    })
    .catch( error => {
      console.error(`[${TS()}] (${server.url}) Error:`, error);
      reject(error);
    })
  });
}


function deleteBackup(server, filename) {
  return new Promise( function(resolve, reject) {
    // Not yet used
    console.log(`[${TS()}] (${server.url}) Deleting backup ${filename} ...`);

    request.delete({ url: server.url + `/backups/${filename}`, auth: {'bearer': server.token}, })
    .then( response => {
      console.log(response);
      resolve();
    })
    .catch( error => {
      console.error(`[${TS()}] (${server.url}) Error:`, error);
      reject(error);
    })
  });
}


// CODE EXECUTION BEGINS HERE ------------------------------------------------------------------------------------------

config.servers.forEach(server => {
  if (config.performNewBackup) {
    createBackup(server)
    // .then(filename => { return downloadBackup(server, filename) })
    .then(() => { syncBackups(server) });  // Only sync after backup is complete
  }
  else syncBackups(server);  // Just sync
});