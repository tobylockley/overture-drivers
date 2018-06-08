# VS Code Helper Scripts

## zip.js

Combines all **.js, .json and .md** files in a zip folder in the **/release/** folder.
Pulls the driver name and version from the package.json file, so ensure it is correct.

### Setup

Open a terminal in the **/.scripts/** folder, and run `npm install`.
Next, install the **Script Commands** VS Code extension.
Copy the following into your user settings:
```javascript
"script.commands": {
    "commands": [
        {
            "id": "myscripts.zip",
            "script": "./.scripts/zip.js"
        }
    ],
    "showOutput": true
}
```

Then, go to your keyboard bindings `Ctrl+K, Ctrl+S`, and open keybindings.json.
Make your file look similar to below (you can use any binding you like):
```javascript
[
    {
        "key": "shift+alt+z",
        "command": "myscripts.zip"
    }
]
```
  
### Usage

Open any file in the driver directory. Use your key binding to launch the script.
Output zip file can be found in the **/release/** folder.
If you would like to delete all older driver versions, edit the top line in the zip.js file:
```javascript
const DELETE_OLD_FILES = false
```
