# AV Pro Connect Matrix Switcher Driver

## Overview
Driver for an AV Pro Connect matrix switcher. Current models supported:
- AC-MX42-AUHD
- AC-MX44-AUHD
- AC-MX44-AUHD-HDBT
- AC-MX88-UHD
- AC-MX88-AUHD-GEN2
- AC-MX88-AUHD-HDBT

## Setup
- "Host": The IP address or host name of the GlobalCache device. (Default 192.168.1.239)
- "Port": The port of TCP communication. (Default 23)
- "Model": The model being installed. This will dictate number of inputs/outputs.

## Variables

### Status
[enum] The current connection status of the device.
- "Disconnected": The device is not connected.
- "Connected": The device is connected, and able to receive commands.

### Sources_OUT{N}
[enum] Which input is being switched to this output.

### Sources_AUDIO_OUT{N}
[enum] Which input is being switched to this audio output.

## Commands

### Select Source
Set the specified output to display the specified input.
- "Channel": [integer] the output to assign the input to.
- "Name": [string] the input to take the source from.

### Select Audio Source
Set the specified audio output to the specified input.
- "Channel": [integer] the output to assign the input to.
- "Name": [string] the input to take the source from.

### Get All Outputs
Returns all current input -> output assignments. Used when polling.

## Revisions

### 1.0.0-beta1
- Initial version, testing.
- Allows dynamic variable creation on setup for different models.

### 1.0.0
- Added polling function (GetAllOutputs) at 10 sec intervals.

### 1.0.1
- Changed json setup schema to allow input/output nicknames
- Refactored code to update TCP timeout/reconnect handling
- Changed setup and variable logic to allow nicknames to function
- Added option for simulation mode

### 1.0.2
- Fixed bug where function name for setting outputs was wrong.
- Removed nicknames to keep it simple.

### 1.0.3
- Added support for audio switching