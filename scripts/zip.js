'use strict'

const ARCHIVE_OLD_FILES = true

const fs = require('fs')
const path = require('path')
const glob = require('glob')
const archiver = require('archiver')

if (process.argv.length < 3) throw new Error('Please provide path to zip as command line argument')

const driverPath = process.argv[2]
if (!fs.statSync(driverPath).isDirectory()) throw new Error(`${driverPath} must be a directory`)

const pkg = require(path.join(driverPath, 'package.json'))

if ( !(pkg.name && pkg.version && pkg.overture) ) throw new Error(`${driverPath} does not contain an overture driver`)

let zipPath = path.resolve(driverPath, '../../zip')
let zipFilePath = path.join(zipPath, `${pkg.name}.${pkg.version}.zip`)

// Archive old versions
let files = glob.sync(`${zipPath}/${pkg.name}.*.zip`)
if (files && ARCHIVE_OLD_FILES) {
  for (let file of files) {
    if (file !== zipFilePath) {
      let filename = path.basename(file)
      console.log('Moving to zip/archive:', filename)
      fs.renameSync(file, path.join(zipPath, 'archive', filename))
      // fs.unlinkSync(file)  // Delete old file
    }
  }
}


// Zip all contents of folder, ignoring docs

// create a file to stream archive data to.
var outputStream = fs.createWriteStream(zipFilePath);
var archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});
 
// listen for all archive data to be written
// 'close' event is fired only when a file descriptor is involved
outputStream.on('close', function() {
  console.log(`Driver files archived to ${zipFilePath} (${archive.pointer()} bytes)`);
});
 
// This event is fired when the data source is drained no matter what was the data source.
// It is not part of this library but rather from the NodeJS Stream API.
// @see: https://nodejs.org/api/stream.html#stream_event_end
outputStream.on('end', function() {
  console.log('Data has been drained');
});
 
// good practice to catch warnings (ie stat failures and other non-blocking errors)
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err.message)
  } else {
    throw err;
  }
});
 
// good practice to catch this error explicitly
archive.on('error', function(err) {
  throw err;
});
 
// pipe archive data to the file
archive.pipe(outputStream);
 
// Archive everything inside the drivers folder except docs
archive.glob('**/*.*', {
  cwd: driverPath,
  ignore: ['docs/**/*.*']
});
 
// finalize the archive (ie we are done appending files but streams have to finish yet)
// 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
archive.finalize();
