# GlobalCache IR Template
## Overview
Template driver for a globalcache IR device.

## Setup
- "Host": The IP address or host name of the device.
- "Port": The port of TCP communication. (Default 4998)
- "GlobalCache Module": iTach = 1. Use iHelp if unsure.
- "GlobaclCache IR Port": IR port being used, 1-3.

## Variables
### Status
[enum] The current connection status of the device.
- "Disconnected" : The device is not connected
- "Connected" : The device is connected, and able to receive commands

### IR_Commands
[enum] All available IR commands to send to device, populated from ir_codes.json
- "Idle": Device is ready to send

## Commands
### Send Command
Send IR command to device
- "Index": [integer] Index of IR_Commands enum of the command to send

## Revisions
### 1.0.0
- Initial version
