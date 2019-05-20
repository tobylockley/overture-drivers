# Arthur Holm Moving Display

## Overview
Driver for Arthur Holm Moving Display.
The Arthur Holm Moving Display is controlled via RS-422.
The driver speaks to a RAW convertor.

## Setup
 - "Host": The IP address or host name of the serial convertor.
 - "Port" : The port of TCP communication.Consult your serial adapter information.
 
 
## Commands

### Set Power
Turn on or off the display
- Status: [Enum] "On" or "Off" to turn the display on or off

### Select Source
Changes the input of the display.
- Name: [String] The name of input to be switched to. If input name is incorrect or not available, an error is returned. Available sources listed in "Sources" variable.

### Set Button Lock
Locks or unlocks the buttons on the display
- Status: [Enum] "On" locks the buttons. "Off" unlocks the buttons.

### Set Position
Changes the position of the display.
- Name: [String] The name of position to be switched to. If the position is incorrect or not available, an error is returned. Available positions listed in "Position" variable.
Note that the Position 1 will turn Off the device and the Position 2 will turn it On.

##Variables

###Status

[Enum] The display's connection status.

- "Disconnected": The display is not connected or connection is disrupted.
- "Connected":  The display is connected, and available to receive commands.

###Power

[Enum] The displays's current power status

- "Off": The display is currently off.
- "On":  The display is currently on.

###Sources

[Enum] The current source selected by the user. 

- "DVI": Content is coming from the DVI input.
- "VGA": Content is coming from the VGA input.
- "CVBS": Content is coming from the composite input.
- "Y/C": Content is coming from the component input.

###Position

[Enum] The current position of the display

- "Position 1": Go down, monitor bottom.
- "Position 2": Go up, , monitor inclined.
- "Position 3": Go down, monitor top.
- "Position 4": Go up, monitor 90 degrees.

###ButtonLock

[Enum] The displays's button's lock

- "Off": The buttons are unlocked.
- "On":  The buttons are locked.

###Error

[String] The displayed error returned from the display. Cleared after successful 'Select Source' or 'Set Position' command.

## Release Notes

### 1.0.0
- Initial version.

### 1.0.1
- Fixed: 'id' setup property is not supported. It has been renamed to 'identifier'.

### 1.0.2
- Fixed: 'Source' enum and its comamnd were not correct.
- Fixed: 'Error' variable is not cleared after successful 'Select Source' or 'Set Position' command.

### 1.0.3
- Fixed: A rebound can happen after a value change.