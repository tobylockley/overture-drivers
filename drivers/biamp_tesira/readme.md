# Biamp Tesira

## Overview
Driver for a Biamp Tesira device over a TCP connection.


## Setup
- "Host": The IP address or host name of the device.
- "Port": The port of TCP communication (default 23).
- "Polling Interval": How often to refresh variables (default 5000ms).
- "Presets": List of all desired presets, can use number or name.
- "Levels": List of all desired level controls.
- "Mutes": List of all desired mute controls.
- "Logic States": List of all desired logic state controls.


## Variables

### Status
[enum] The current connection status of the device.
- "Disconnected" : The device is not connected.
- "Connected" : The device is connected, and able to receive commands.

### Presets
[enum] The presets that can be recalled, generated from config

### Audio Level (per configured level)
[real] Controls the configured audio level.
- minimum: 0
- maximum: 100

### Audio Mute (per configured mute)
[enum] Controls the configured mute state.
- "Off": Unmuted
- "On" : Muted

### Logic State (per configured logic state)
[enum] Controls the configured logic state.
- "False": Logic state set to false
- "True" : Logic state set to true


## Commands

### Recall Preset
Recall the selected preset.
- "Name": [string] the name of the input source (given by variable "Sources")

### Set Audio Level
Set Audio level (between 0 and 100), converted to min/max dB from config data.
- "InstanceTag": [string] Name of the tesira variable "Instance Tag"
- "Channel": [integer] Tesira variable channel number
- "Level": [real] Volume percentage, 0-100

### Set Audio Mute
Mute or unmute the configured variable
- "InstanceTag": [string] Name of the tesira variable "Instance Tag"
- "Channel": [integer] Tesira variable channel number
- "Status": [integer] Logical state, 0 or 1

### Set Logic State
Set configured logic state to false/true
- "InstanceTag": [string] Name of the tesira variable "Instance Tag"
- "Channel": [integer] Tesira variable channel number
- "Status": [integer] Logical state, 0 or 1


## Revisions

### 1.0.0
- Initial version, using hard coded variable names

### 1.0.1
- Updated to a configurable, generic driver for presets, levels, mutes and logic states