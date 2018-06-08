// This is used to develop and test script commands

exports.execute = function (args) {
  // access VSCode API (s. https://code.visualstudio.com/Docs/extensionAPI/vscode-api)
  var vscode = require('vscode');
  var fs = require('fs');
  var path = require('path');
  var glob = require("glob")

  let mypath = path.dirname(vscode.window.activeTextEditor.document.fileName);
  let zpath = path.resolve(mypath, '../../release')

  args.log('---------- ./dev/scripts/info.js ----------');
  args.log(`mypath: ${mypath}`);
  args.log(`zip path: ${zpath}`)


  fs.readdir(mypath, function(err, items) {
    // only continue if no error
    if (!err) {
      const json = require(`${mypath}/package.json`)
      const zname = `${json.name}.${json.version}`
      args.log(zname)

      let files = glob.sync(`${zpath}/${json.name}*.zip`)
      if (files) {
        files.forEach(file => {
          args.log(`Deleting: ${file}`)
          //fs.unlinkSync(file)
        });
      }
    }
  });

  //vscode.window.showInformationMessage('Hello from my extension: ' + scriptFile);
}