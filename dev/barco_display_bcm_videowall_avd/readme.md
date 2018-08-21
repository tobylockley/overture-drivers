# Barco Display BCM VideoWall

## Overview
Driver for Barco BCM Routers to control Video Walls
It uses the raw TCP CLI API.
It has a limit of how many connections it allows in and will error if too many connections to it are iniated.

## Setup
- "Host":  The IP address or host name of the BCMrouter.
- "Port": The port to connecot to the BCM. Default is 23500.
- "DeviceID": ID of the videowall you want to control. Default is MyWall.

## Commands

### Set Power
Turns the display wall on or off
- Status: [Enum] "On" or "Off" to turn the display wall on or off.

### Select Source
Changes the input of the display wall.
- Name: [String] The name of input to be switched to. If input name is incorrect or not available, an error is returned. Available sources listed in "Sources" variable.

##Variables

###Status

[Enum] The display wall's connection status.

- "Disconnected": Cannot connect to the BCM
- "Connected":  The connection to the BCM is good.

###Power

[Enum] The displays wall's current power status.

- "Off": The display wall is currently off/idle.
- "On":  The display wall is currently on.

###Sources
[Enum] The current source selected by the user. 

- "DisplayPort1": Content is coming from the DisplayPort1 input.
- "HDMI1": Content is coming from the HDMI1 input.
- "DVI1": Content is coming from the DVI1 input.
- "DVI2": Content is coming from the DVI2 input.
- "OPS1": Content is coming from the OPS1 input.

###Error

[String] The displayed error returned from the router. Cleared after successful command or poll.

## Release Notes
### 1.0.0
- Initial version.

