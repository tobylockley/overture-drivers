# Device Network Monitor

## Overview

Driver to monitor network devices, and report online/offline status.
Can be chained with Overture alarms to automatically inform network managers/IT staff of disconnected devices.


## Setup

  - "Timeout": Ping timeout, in milliseconds.
  - "Frequency": Ping frequency, in milliseconds.
  - "Debouncing": Number of failed pings that need to happen in a row before declaring the device as offline. No debouncing is applied to online status.
  - "Devices": A dynamic array of devices that should be monitored.
    - "Host": Hostname/IP Address of device to be monitored.
    - "Friendly Name": Name to display in overture for this device. Can only contain letters, numbers, and underscores. Must start with a letter.

## Variables

### Status (Per Device)

[enum] The current connection status of the device. Will be added dynamically for each configured device.
  - "Disconnected" : The device is not connected to the network.
  - "Connected" : The device is connected to the network, and responding to pings.

## Revisions

### 1.0.0
  - Initial version

### 1.0.1
  - Added "Status" to device variable names to conform with overture standard
  - Moved ping checks into poll function that will stop when driver is disabled