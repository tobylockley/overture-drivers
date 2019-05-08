# LG Display


## Overview

Driver for an LG display.


## Setup

- "Host": The IP address or host name of the device. (Default 192.168.1.)
- "MAC Address": The MAC Address of the device, needed for Wake On Lan functionality. (Default 38:8C:50:)
- "Port": The port of TCP communication. (Default 9761)


## Variables

### Status

[enum] The current connection status of the device.
- "Disconnected" : The device is not connected.
- "Connected" : The device is connected, and able to receive commands.

### Power

[enum] The power status of the display.
- "Off": The power is off.
- "On" : The power is on.

### Sources

[enum] List of input sources user can select from
- "RGB": Change input source to RGB
- "HDMI1": Change input source to HDMI1
- "HDMI2": Change input source to HDMI2
- "DisplayPort": Change input source to DisplayPort
- "OPS/DVI": Change input source to OPS/DVI

### Screen Mute

[enum] The displays screen mute status (screen mute = display off, but internals still on).
- "Off": The screen is unmuted.
- "On" : The screen is muted.

### Audio Mute

[enum] The mute status of the displays audio.
- "Off": The device is unmuted.
- "On" : The device is muted.

### Audio Level

[integer] Set the audio level of the device.
- minimum: 0
- maximum: 100

### Brightness

[integer] Set the brightness of the display.
- minimum: 0
- maximum: 100

### Contrast

[integer] Set the contrast of the display.
- minimum: 0
- maximum: 100

### Temperature

[integer] Temperature of the display.


## Commands

### Set Power
Turn on or off the device power.
- "Status": [enum] "On" or "Off" to turn power on or off.

### Select Source
To select the input source to display.
- "Name": [string] the name of the input source (given by variable "Sources")

### Set Screen Mute
Mute or unmute the screen.
- "Status": [enum] "On" or "Off" to mute or unmute the screen.

### Set Audio Mute
Mute or unmute the sound.
- "Status": [enum] "On" or "Off" to mute or unmute the sound.

### Set Audio Level
Set Audio level of the device (between 0 and 100)
- "Level": [integer] audio level for the display.

### Set Brightness
Set brightness of the device (between 0 and 100)
- "Level": [integer] brightness for the display.

### Set Contrast
Set contrast of the device (between 0 and 100)
- "Level": [integer] contrast for the display.


## Revisions

### 1.0.0

- Initial version.

### 1.0.1

- No longer using getMacAddress and persistent variables due to stability issues.

### 1.0.2

- Added screen mute functionality for faster sleep/wake cycles.
