# Epson Projector G6 Series Driver

## Overview

Projector Driver
This Epson Projector G6 Series Driver supports the following projectors:
- G6970WU
- G6770WU
- G6570WU
- G6470WU
- G6270W
- G6070W
- G6870
- G6370
- G6170


## Setup

It is required to define IP Address and IP Port of the projector to control.

IP Address: The IP address of the remote projector.

IP Port: The Port used by the projector to communicate. By default its value is 3629.

## Variables

### Status

[Enum] The projector's connection status.

- "Disconnected": The projector is not connected or connection is disrupted.
- "Connected":  The projector is connected, and available to receive commands.

### Power

[Enum] The projector's current power status.

- "Off": The projector is currently off, cooling, or warming up.
- "On":  The projector is currently on or warming
- "Powering Off": Cooling
- "Powering On": Warm up

### Sources

[Enum] Current input source type.

- "RGB": The projector displaying content from its RGB input.
- "HDMI1": The projector displaying content from its HDMI1 input.
- "VIDEO": The projector displaying content from its VIDEO input.
- "HDMI2": The projector displaying content from its HDMI2 input.

##VideoMute

[Enum] Video mute state. (A/V Mute)

- "Off": Mute off
- "On": Mute on

### Brightness

[Integer] The current brightness value (in percent).

### Contrast

[Integer] The current contrast value (in percent).

### Error

[String] The displayed error returned from the projector.

Type: `string`

##HoursLamp1

[Integer] Current operating time of the lamp (in hours).


## Commands

### Set Power
Turn on or off the projector
- Status: [Enum] "On" or "Off" to turn the projector on or off. 

### Select Source
Changes the input of the video projector.
- Name: [String] The name of input to be switched to. If input name is incorrect or not available, an error is returned. Available sources listed in "Sources" variable.

### Set Video Mute
Turns on or off the display of video black instead of source content and mute the sound.
- Status: [Enum] "On" turns on video black and mute the sound, "Off" returns back to source content and unmute the sound.

### Set Brightness
Adjusts the brightness of the source content. 

- Level: [Integer] The brightness to be set (in percent).

### Set Contrast
Adjusts the contrast of the source content.

- Level: [Integer] The contrast to be set (in percent).


## Revisions

### 1.0.0

- initial version