# LG Display


## Overview
Driver for an LG display, with optional videowall capability.


## Setup
- "Host": The IP address or host name of the device.
- "Port": The port of TCP communication. (Default 9761)
- "MAC Address": The MAC Address of the device, required for Wake On Lan functionality.
- "Set ID": Found in General Settings.
- "Enable Videowall Control": Enabled tile mode controls. Will only work on videowall capable displays.
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

### Temperature
[integer] Temperature of the display.

### Tile Mode (If Enabled)
[enum] The displays tile mode status
- "Off": Tile mode disabled
- "1x2" : 1 row, 2 columns
- "2x2" : 2 row, 2 columns
- "3x3" : 3 row, 3 columns
- "4x4" : 4 row, 4 columns
- "5x5" : 5 row, 5 columns

### Tile ID (If Enabled)
[integer] This screens position in videowall. Top left = 1, Bottom right = rows x columns (e.g. 3x3 = 9)
- minimum: 1
- maximum: rows x columns


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

### Set Tile Mode
Turn tile mode on or off
- "Status": [enum] "Off" for disabled, or choose the videowall size

### Set Tile ID
Set this screens tile ID (position in the videowall, top left = 1)
- "Value": [integer] Tile ID


## Revisions

### 1.0.0
- Initial version, forked from lg_display

### 1.0.1
- No longer using getMacAddress and persistent variables due to stability issues.

### 1.0.2
- Added screen mute functionality for faster sleep/wake cycles.

### 1.0.3
- Removed Brightness and Contrast controls for simplicity.
- Changed WOL module to a newer version.
- Increased WOL reliability.
- Available sources are now selected as part of config.

### 1.0.4
- Added videowall functionality. Must be enabled in config.

### 1.0.5
- Added an alternative DVI input source for hex code 0x80
