# Global Cache IR

## Overview
Generic driver for controlling any IR device using a Global Cache IR module.


## Setup
  - "Host": The IP address or host name of the device. (Default 192.168.3.20)
  - "Port": The port of TCP communication. (Default 20060)
  - "Module": Global Cache module to connect to. 1 for iTach.
  - "IR Port": IR blaster port in use (1-3)
  - "Commands": A dynamic list of all IR commands. Format is in global cache IR code.

### Example IR Code
IR codes should be in Global Cache format similar to below. If using iLearn, this is the default format:
1,38000,1,69,342,171,21,21,21,21,21,21,21,21... (etc) ...21,21,64,21,1490,342,85,21,3660


## Variables

### Status
[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Commands
[enum] List of all available IR commands to send. These are configured through driver settings.
  - "Idle": After issuing a command, this enum will always return to "Idle", allowing multiple repeat commands to be sent.


## Commands

### Send Command
Send the selected command to the Global Cache IR blaster
  - "Name": [string] the name of the command to send (given by variable "Commands")


## Revisions

### 1.0.0
  - Initial version