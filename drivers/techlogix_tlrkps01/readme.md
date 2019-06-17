# Techlogix TL-RKPS-01

## Overview
Driver for a Techlogix TL-RKPS-01.


## Setup
- "Host": The IP address or host name of the device
- "Port X Nickname": The nickname to give the port, or leave blank


## Variables

### Status
[enum] The current connection status of the device
- "Disconnected" : The device is not connected
- "Connected" : The device is connected, and able to receive commands

### Power (For each channel)
[enum] The power status of the port
- "Off": The power is off
- "On" : The power is on

### Voltage (For each channel)
[enum] List of possible voltages for each port. 5V, 12V, or 24V


## Commands

### Set Power
Turn on or off the port power
- "Channel": [integer] Channel of the port, 1-12
- "Status": [enum] "On" or "Off" to turn power on or off

### Set Voltage
Change the port voltage
- "Channel": [integer] Channel of the port, 1-12
- "Status": [enum] "5V", "12V" or "24V"


## Revisions

### 1.0.0
- Initial version

