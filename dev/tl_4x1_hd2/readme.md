# TechLogix HDMI Switcher TL-4x1-HD2


## Overview

Driver for a TechLogix TL-4x1-HD2 HDMI switcher using RS232 via a GlobalCache or ZeeVee Zyper device.


## Setup

  - "Host": The IP address or host name of the device (or Zyper management platform).
  - "Port": The port to communicate over.
  - "Zyper Encoder/Decoder": When Zyper mode is selected, which device is used to route RS232 commands.


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


## Commands

### Select Source
Select the input source to display.
  - "Name": [string] the name of the input source (given by variable "Sources")


## Revisions

### 1.0.0-beta.1

- Initial working version, using only GlobalCache devices.

### 1.0.0-beta.6

- Added Zyper functionality.

### 1.0.0-beta.7

- Fixed 

