# Extron USB Switcher


## Overview

Driver for a Extron USB switcher using RS232 via a GlobalCache or ZeeVee Zyper device.


## Setup

  - "Host": The IP address or host name of the RS232 device (or Zyper management platform).
  - "Port": The port to communicate over.
  - "Zyper Encoder/Decoder": When Zyper mode is selected, which device is used to route RS232 commands.


## Variables

### Status

[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### UsbHost

[integer] Select which USB host the clients should attach to.
  - 0: No host selected
  - 1-n: Host number to connect to (dependant on model)


## Commands

### Select Host
Select the USB host to route to.
  - "Name": [string] the name of the input source (given by variable "Sources")


## Revisions

### 1.0.0

- Initial working version, using only GlobalCache devices.

### 1.0.1

- Added Zyper functionality.