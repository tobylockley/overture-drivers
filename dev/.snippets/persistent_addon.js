const fs = require('fs');

module.exports = {

  loadPersistent: function(varName) {
    return new Promise((resolve, reject) => {
      if (typeof varName != 'string') reject(new TypeError('loadPersistent: varName must be a string'))
      // Read persistent.json and return as a resolved promise
      fs.readFile(`./persistent.json`, 'utf8', (err, data) => {
        if (err) {
          if (err.code == 'ENOENT') reject('persistent.json not yet created');  // File does not exist
          else reject(err);
        }
        else {
          let json = JSON.parse(data)
          if (json[varName]) resolve(json[varName]);  // Value found
          else reject('Value not found in file');
        }
      });
    });
  },

  savePersistent: function(varName, value) {
    if (typeof varName != 'string') throw new TypeError('savePersistent: varName must be a string')
    // Read current persistent file
    fs.readFile(`./persistent.json`, 'utf8', (err, data) => {
      if (err) data = '{}'  // No file exists, start fresh
      let json = JSON.parse(data)
      json[varName] = value  // Write the new value
      // Write data back to file
      data = JSON.stringify(json, null, 2)  // Indent with 2 spaces
      fs.writeFile(`./persistent.json`, data, (err) => {
        if (err) throw err;
      });
    });
  }

}
