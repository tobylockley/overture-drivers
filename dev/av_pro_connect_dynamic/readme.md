# AV Pro Connect Dynamic Driver

## Overview

Driver for an AV Pro Connect NxN switcher (E.g. MX44)
  
## Setup

 - "Host": The IP address or host name of the GlobalCache device. (Default 192.168.10.120)
 - "Port": The port of TCP communication. (Default 21)
 - "Model": The model being installed.

## Variables

### Status

[enum] The current connection status of the device.
 - "Disconnected" : The device is not connected.
 - "Connected" : The device is connected, and able to receive commands.

### Power

[enum] The power status of the device.
 - "Off": The device is off.
 - "On" : The device is on.

### Output{N}

[integer] Which input is being pushed to this output.
 - minimum: 1
 - maximum: number of inputs

## Commands

### Set Power
Turn on or off the device power.
 - "Status": [enum] "On" or "Off" to turn power on or off.

### Set Output
Set the specified output to display the specified input.
 - "Output": [integer] the output to assign the input to.
 - "Input": [integer] the input to take the source from.

### Get Output
Get the input currently set to this specified output.
 - "Output": [integer] the output channel to retrieve.

### Get All Outputs
Returns all current input -> output assignments. Used when polling.

## Revisions

### 1.0.0-beta1

- Initial version, testing.
- Allows dynamic variable creation on setup for different models.

### 1.0.0-beta2

- Added polling function (GetAllOutputs) at 10 sec intervals.
