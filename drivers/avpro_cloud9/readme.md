# AV Pro Cloud 9

## Overview

Driver for AV Pro Cloud 9 HDBT 9x9 switcher.


## Setup
  - "Host": The IP address or host name of the Cloud 9.
  - "Port": The port of TCP communication. (Default 23)


## Variables

### Status
[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Power
[enum] The power status of the device.
  - "Off": The device is off.
  - "On" : The device is on.

### Multiview Mode
[enum] The current multiview mode
  - "3x3": 3x3 multiview mode.
  - "4x4": 4x4 multiview mode.

### Sources (per output)
[enum] The list of possible sources for each output


## Commands

### Select Source
To select the input source to display.
  - "Channel": [integer] Output number
  - "Name": [string] the name of the input source (given by variable "Sources")

## Revisions

### 1.0.0
  - Initial version.