# AV Pro Connect Switcher Driver

## Overview

Driver for an AV Pro Connect NxN switcher (E.g. MX44)

## Setup

- "Host": The IP address or host name of the GlobalCache device. (Default 192.168.10.120)
- "Port": The port of TCP communication. (Default 21)
- "Model": The model being installed.
- "Nicknames": Optional, can assign nicknames to inputs and/or outputs

## Variables

### Status

[enum] The current connection status of the device.
- "Disconnected" : The device is not connected.
- "Connected" : The device is connected, and able to receive commands.

### Sources_Output{N}

[enum] Which input is being pushed to this output.

## Commands

### Select Source
Set the specified output to display the specified input.
- "Channel": [integer] the output to assign the input to.
- "Name": [string] the input to take the source from.

### Get All Outputs
Returns all current input -> output assignments. Used when polling.

## Revisions

### 1.0.0-beta1

- Initial version, testing.
- Allows dynamic variable creation on setup for different models.

### 1.0.0

- Added polling function (GetAllOutputs) at 10 sec intervals.

### 1.0.1

- Changed json setup schema to allow input/output nicknames
- Refactored code to update TCP timeout/reconnect handling
- Changed setup and variable logic to allow nicknames to function
- Added option for simulation mode
