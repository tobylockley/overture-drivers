# Techlogix TL-4x1-HD HDMI Switcher


## Overview

Driver for a Techlogix TL-4x1-HD HDMI switcher


## Setup

- "Host": The IP address or host name of the globalcache device.
- "Port": The port of TCP communication. (Default 4999)


## Variables

### Status

[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Sources

[enum] List of input sources user can select from.
  - "HDMI1": Change input source to HDMI1
  - "HDMI2": Change input source to HDMI2
  - "HDMI3": Change input source to HDMI3
  - "HDMI4": Change input source to HDMI4

### Mute

[enum] The mute status of the switchers output.
- "Off": Switch off output
- "On" : Switch on output


## Commands

### Select Source
Select the input source to display.
  - "Name": [string] the name of the input source (given by variable "Sources")

### Set Mute
Mute or unmute the output.
- "Status": [enum] "On" or "Off" to mute or unmute the output


## Release Notes

### 1.0.0-beta.3
- Initial working version

### 1.0.1
- Small update, changed reconnection logic slightly to avoid possible socket timeouts
- Removed power variable/command as it is not documented and not supported in API
- Updated readme
