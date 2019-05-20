# ZeeVee ZVMXE

## Overview

Driver for a ZeeVee ZVMXE decoder

## Setup

  - "Host": The IP address or host name of the device.
  - "Port": The port of TCP communication. (Default 8080)
  - "Simulation Mode": If checked, device functions will be simulated without actually communicating to a device.
  - "Channels": Input all configured channels, as required.

## Variables

### Status

[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Channel

[enum] The current channel being decoded. This enum will be populated with the "Channels" from Setup.

### ChannelShift

[enum] Initiate a channel shift operation.
  - "Idle": This is the default state, ready to accept a command
  - "Down": Decrease the channel number (or loop around to last channel)
  - "Up": Increase the channel number (or loop around to the first channel)

## Commands

### Set Channel
Set the channel of the decoder.
  - "Name": [string] name of the channel

### Shift Channel
Shift the channel of the decoder up or down.
  - "Direction": [enum] "Up" or "Down" to change channel accordingly.

## Revisions

### 1.0.0
  - Initial version.

### 1.0.1
  - Added 'Shift Channel' functionality.
  - Device now stops polling when "stop()" is called.