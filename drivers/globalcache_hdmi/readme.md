# Global Cache HDMI

## Overview
Driver for the Global Cache GCHMX3 HDMI switching module.

## Setup
- "Host": For LAN communication, the IP address or host name of the Global Cache GCHMX3 HDMI switching module.
- "Port" : The port of TCP communication. The default port is `4998`.

## Commands

### Select Source
To select the input source to display.
  - "Name": [string] the name of the input source (given by variable "Sources")

## Variables

### Status

[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Sources

[enum] List of input sources user can select from
  - "HDMI1": Change input source to HDMI1
  - "HDMI2": Change input source to HDMI2
  - "HDMI3": Change input source to HDMI3

###Error

[string] The error returned by the device. Cleared after successful command or poll.

## Release Notes

### 1.0.0
- Initial version.

