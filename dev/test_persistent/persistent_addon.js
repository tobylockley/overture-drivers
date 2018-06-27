const fs = require('fs');

module.exports = {

  loadPersistent: function(varName, callback) {
    if (typeof varName != 'string') throw new TypeError('loadPersistent: varName must be a string')
    if (typeof callback != 'function') throw new TypeError('loadPersistent: callback must be a function')
    // Read persistent.json and execute callback with retrieved value
    fs.readFile(`${__dirname}/persistent.json`, 'utf8', (err, data) => {
      if (err) {
        if (err.code == 'ENOENT') callback(null);  // File does not exist
        else throw err;
      }
      else {
        let json = JSON.parse(data)
        if (json[varName]) callback(json[varName]);  // Value found
        else callback(null);  // Value not found in file
      }
    });
  },

  savePersistent: function(varName, value) {
    if (typeof varName != 'string') throw new TypeError('savePersistent: varName must be a string')
    // Read current persistent file
    fs.readFile(`${__dirname}/persistent.json`, 'utf8', (err, data) => {
      if (err) data = '{}'  // No file exists, start fresh
      let json = JSON.parse(data)
      json[varName] = value  // Write the new value
      // Write data back to file
      data = JSON.stringify(json, null, 2)  // Indent with 2 spaces
      fs.writeFile(`${__dirname}/persistent.json`, data, (err) => {
        if (err) throw err;
      });
    });
  }

}
