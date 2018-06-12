# LG Display

## Overview

Driver for an LG display.
  
## Setup

 - "Host": The IP address or host name of the device. (Default 192.168.99.178)
 - "Port": The port of TCP communication. (Default 9761)

## Variables

### Status

[enum] The current connection status of the device.
 - "Disconnected" : The device is not connected.
 - "Connected" : The device is connected, and able to receive commands.

### Mac Address

[string] Used for wake on lan purposes.

### Power

[enum] The power status of the display.
 - "Off": The display is off.
 - "On" : The display is on.

### Sources

[enum] List of input sources user can select from
 - "RGB": Change input source to RGB
 - "HDMI1": Change input source to HDMI1
 - "HDMI2": Change input source to HDMI2
 - "DisplayPort": Change input source to DisplayPort
 - "OPS/DVI": Change input source to OPS/DVI

### Audio Mute

[enum] The mute status of the device.
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

### Set Audio Mute
Mute or unmute the device.
 - "Status": [enum] "On" or "Off" to mute or unmute the display.

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
- Uses a questionable method to retrieve persistent variables, need clarification from Barco.
