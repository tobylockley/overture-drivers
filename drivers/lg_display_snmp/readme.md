# LG Display - SNMP


## Overview
Driver for a Commercial LG display using SNMP Protocol


## Setup
- "Host": The IP address or host name of the device.
- "Port": The port for SNMP communication. (Default 161)
- "MAC Address": The MAC Address of the device, required for Wake On Lan functionality.
- "Available Inputs": The inputs enabled on this display.


## Variables

### Status
[enum] The current connection status of the device.
- "Disconnected" : The device is not connected.
- "Connected" : The device is connected, and able to receive commands.

### Power
[enum] The power status of the display.
- "Off": The power is off.
- "On" : The power is on.

### Screen Mute
[enum] The displays screen mute status (screen mute = display off, but internals still on).
- "Off": The screen is unmuted.
- "On" : The screen is muted.

### Sources
[enum] List of input sources user can select from. Must be enabled in driver config.

### Audio Mute
[enum] The mute status of the displays audio.
- "Off": The device is unmuted.
- "On" : The device is muted.

### Audio Level
[integer] Set the audio level of the device.
- minimum: 0
- maximum: 100


## Commands

### Set Power
Turn on or off the device power.
- "Status": [enum] "On" or "Off" to turn power on or off.

### Set Screen Mute
Mute or unmute the screen.
- "Status": [enum] "On" or "Off" to mute or unmute the screen.

### Select Source
To select the input source to display.
- "Name": [string] the name of the input source (given by variable "Sources")

### Set Audio Mute
Mute or unmute the sound.
- "Status": [enum] "On" or "Off" to mute or unmute the sound.

### Set Audio Level
Set Audio level of the device (between 0 and 100)
- "Level": [integer] audio level for the display.


## Revisions

### 1.0.0
- Initial version, forked from lg_display

### 1.0.1
- Added channel up/down IR commands

### 1.0.2
- Added custom input hex code in config
