# Install

- install git
- install node
- install vscode

- create drivers folder
- npm install mocha chai folder-zip
- create driver_training folder

# VSCode

- open driver folder in vscode
- copy launch.json

```json
    {
      "type": "node",
      "request": "launch",
      "name": "OvertureCS",
      // "program": "/Users/kimbui/shareddev/overture.git/controlserver/app/index.js",
      // "runtimeExecutable": "/Users/kimbui/shareddev/overture.git/controlserver/build/OvertureCS-darwin-x64/OvertureCS.app/Contents/MacOS/OvertureCS",
      "runtimeExecutable": "/Users/kimbui/shareddev/kim/build/OvertureCS-darwin-x64/OvertureCS.app/Contents/MacOS/OvertureCS",
      "windows": {
        "runtimeExecutable": "C:\\Program Files\\Barco\\Barco Overture Control Server\\OvertureCS.exe"
      },
      "protocol": "legacy",
      "env": {
        "UID": "Training",
        "UXURI": "http://localhost:8081",
        "DATA": "/Users/kimbui/shareddev/overture.git/controlserver/app/data",
        "DRIVERPATH": "${workspaceRoot}",
        "DEBUGDRIVER": "true",
        "LOGLEVEL": "debug"
      }
    },
```

# Use MacOS Electron Build

- DRIVERPATH=~/shareddev/overture.git/drivers  DEBUGDRIVER=true uid=Training UXURI=http://localhost:8081 ~/shareddev/overture.git/controlserver/build/OvertureCS-darwin-x64/OvertureCS.app/Contents/MacOS/OvertureCS

# DriverHub

- partners: user/pass
- upload drivers
- https://drivers.overture.barco.com (https://drivers-staging.overture.barco.com temp)