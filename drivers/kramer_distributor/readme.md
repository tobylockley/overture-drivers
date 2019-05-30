# Kramer HDMI Distributor


## Overview

Driver for a Kramer HDMI Distributor


## Setup

- "Host": The IP address or host name of the globalcache rs232 device.
- "Port": The port of TCP communication. (Default 4999)
- "Machine Number": ID number of the device for RS232 purposes. (Default 1)


## Variables

### Status
[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Sources
[enum] List of input sources user can select from.
  - "None": Disconnect outputs
  - "Input1": Change input source to Input1
  - "Input2": Change input source to Input2


## Commands

### Select Source
Select the input source to display.
  - "Name": [string] The name of the input source (given by variable "Sources")


## Release Notes

### 1.0.0
- Initial working version
