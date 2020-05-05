# Template (CHANGE ME)

## Overview
Driver for a template (CHANGE ME).


## Setup
- "Host": The IP address or host name of the device.


## Variables

### Status
[enum] The current connection status of the device.
- "Disconnected" : The device is not connected
- "Connected" : The device is connected, and able to receive commands

### Power
[enum] The power status of the display.
- "Off": The display is off
- "On" : The display is on

### Sources
[enum] List of input sources user can select from.
- "DTV": Change input source to DTV
- "HDMI1": Change input source to HDMI1
- "HDMI2": Change input source to HDMI2
- "HDMI3": Change input source to HDMI3
- "HDMI4": Change input source to HDMI4

### Audio Level
[integer] Set the audio level of the device.
- minimum: 0
- maximum: 100


## Commands

### Set Power
Turn on or off the device power.
- "Status": [enum] "On" or "Off" to turn power on or off.

### Select Source
To select the input source to display.
- "Name": [string] the name of the input source (given by variable "Sources")

### Set Audio Level
Set Audio level of the device (between 0 and 100)
- "Level": [integer] audio level for the display.


## Revisions

### 1.0.0
- Initial version

