# TechLogix HDMI Switcher TL-4x1-HD2

## Overview

Driver for a TechLogix TL-4x1-HD2 HDMI switcher using RS232 via a ZeeVee Zyper Management Platform.
Before using the driver, the zyper devices being used must be configured for RS232 communication.

First, establish a telnet session with the Management Platform on port 23. This can be done with a free program called PuTTY, for example.
For each device, type the following commands, replacing <DEVICE> with your encoder/decoder name:
```
set device <DEVICE> rs232 9600 8-bits 1-stop none
set responses <DEVICE> rs232-term-chars \n\r
switch <DEVICE> server rs232
```
Afterwards, you will need to power cycle the zyper management platform for all settings to take effect.


## Setup
  - "Host": The IP address or host name of the Zyper management platform.
  - "Port": The port to communicate over.
  - "Switcher Nickname": A human readable name to label each switcher appropriately.
  - "Name of Zyper Encoder/Decoder": Configured name of zyper device, refer to MaestroZ.


## Variables

### Status
[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Sources (Per configured switcher)
[enum] List of input sources user can select from.
  - "HDMI1": Change input source to HDMI1
  - "HDMI2": Change input source to HDMI2
  - "HDMI3": Change input source to HDMI3
  - "HDMI4": Change input source to HDMI4


## Commands

### Select Source
Select the input source to display.
  - "Channel": [string] the name of the zyper device that is connected with RS232
  - "Name": [string] the name of the input source (given by variable "Sources")


## Revisions

### 1.0.0-beta.1
- Initial working version.

### 1.0.0
- First version ready for release.
- Removed dependency on external telnet module, now using base tcp.
