# TOA M9000-M2

## Overview

Driver for a TOA Power amplifier using GlobalCache RS232.
  
## Setup

 - "Host": The IP address or host name of the GlobalCache device. (Default 192.168.1.1)
 - "Port": The port of TCP communication. (Default 4999)

## Variables

### Status

[enum] The current connection status of the device.
 - "Disconnected" : The device is not connected.
 - "Connected" : The device is connected, and able to receive commands.

### Power

[enum] The power status of the device.
 - "Off": The device is off.
 - "On" : The device is on.

### Preset

[enum] List of built-in presets.
 - "Preset 1" ... "Preset 32"

### Audio Level Input X

[integer] Set the audio level of input X
 - minimum: 0
 - maximum: 100

### Audio Mute Input X

[enum] The mute status of input X.
 - "Off": The input is unmuted.
 - "On" : The input is muted.

### Audio Level X

[integer] Set the audio level of output X.
 - minimum: 0
 - maximum: 100

### Audio Mute X

[enum] The mute status of output X.
 - "Off": The output is unmuted.
 - "On" : The output is muted.

## Commands

### Set Power
Turn on or off the device power.
 - "Status": [enum] "On" or "Off" to turn power on or off.

### Recall Preset
Load the previously saved preset.
 - "Name": [string] the name of the preset to load (E.g. "Preset1")

### Set Audio Level In
Set Audio level of the specified input (between 0 and 100)
 - "Channel": [integer] input channel to adjust.
 - "Level": [integer] audio level for the input.

### Set Audio Mute In
Mute or unmute the specified input.
 - "Channel": [integer] input channel to adjust.
 - "Status": [enum] "On" or "Off" to mute or unmute the input.

### Set Audio Level
Set Audio level of the specified output (between 0 and 100)
 - "Channel": [integer] output channel to adjust.
 - "Level": [integer] audio level for the output.

### Set Audio Mute
Mute or unmute the specified output.
 - "Channel": [integer] output channel to adjust.
 - "Status": [enum] "On" or "Off" to mute or unmute the output.

### Get Audio Level In
Get the current level for the specified input. Not fully supported by hardware API, using a workaround to lower and raise the level by 0.5dB, then receiving the current level in response.
 - "Channel": [integer] input channel level  to retrieve.

### Get Audio Level
Get the current level for the specified output. Not fully supported by hardware API, using a workaround to lower and raise the level by 0.5dB, then receiving the current level in response.
 - "Channel": [integer] output channel level to retrieve.

### Get All Levels
Initiates GetAudioLevelIn and GetAudioLevel for every input and output.

## Revisions

### 1.0.0-beta6

- Initial version, testing.

### 1.0.0-beta7

- Ironing out some initial bugs/typos.
- Removed getAllLevels() during startup.

### 1.0.0-beta8

- Fixed off-by-one error within "set" functions.
- Removed some unecessary logger.silly prints.

### 1.0.0-beta9

- Mute function was implemented backwards, fixed.
- Moved base.commandDone() to inside each validating if statement.

### 1.0.0-beta10

- Changed response parsing logic, now validates response buffer and attempts to extract a valid message hidden within.
- Added "Preset" variables (Preset1 - Preset32).

### 1.0.0-beta11

- Added Power variable and appropriate declarations in package.json.
- Updated readme.

### 1.0.0-beta12

- Fixed parseInt bug in recallPreset

### 1.0.0-beta13

- Removed getAllLevels() from recallPreset

### 1.0.0-beta14

- Added variables and functions for crosspoint gains
- Restructured variable layout for ease of use
- Removed all 'get' functions, as not needed

### 1.0.0-beta15

- Fixed a bug with TCP timeout
- Added TCP keepAlive function