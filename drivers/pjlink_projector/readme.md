# PJLink Projector

## Overview
Driver for a PJLink Projector.


## Setup
- "Host": The IP address or host name of the device
- "Port": The port of TCP communication (Default 4352)


## Variables

### Status
[enum] The current connection status of the device.
- "Disconnected" : The device is not connected
- "Connected" : The device is connected, and able to receive commands

### Power
[enum] The power status of the projector.
- "Off": The projector is off
- "On" : The projector is on
- "Powering Off" : The projector is powering down
- "Powering On" : The projector is warming up

### Sources
[enum] List of input sources user can select from. Retrieved from device upon connection.

### Audio Mute
[enum] Set the audio mute status of the projector.
- "Off": Audio mute is off
- "On" : Audio is muted

### Video Mute
[enum] Set the video mute status of the projector.
- "Off": Video mute is off
- "On" : Video is muted


## Commands

### Set Power
Turn on or off the device power.
- "Status": [enum] "On" or "Off" to turn power on or off

### Select Source
To select the input source to display.
- "Name": [string] the name of the input source (given by variable "Sources")

### Set Audio Mute
Turn on or off audio mute.
- "Status": [enum] "On" or "Off" to turn audio mute on or off

### Set Video Mute
Turn on or off video mute.
- "Status": [enum] "On" or "Off" to turn video mute on or off


## Revisions

### 1.0.0
- Initial version

