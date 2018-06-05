# NEC Display X-Series

## Overview
Driver for NEC X-Series Display. 
Tested over RJ-45 with the NEC X841UHD-2 display.

### Models included:

- X551UHD
- X651UHD-2
- X841UHD-2
- X981UHD-2  

## Protocol
- Interface: RS-232C
- Baud rate: 9600bps
- Data length: 8bits
- Parity: None
- Stop bit: 1 bit
- Communication code: ASCII

## Setup
- "Host": For LAN communication, the IP address or host name of the display. For Serial, the IP address or host name of the serial converter.
- "Port" : The port of TCP communication. For LAN communication, the default port is `7142`. For Serial, consult your serial adapter information.
## Commands
### Set Power
Turns the display on or off
- Status: [Enum] "On" or "Off" to turn the display on or off.
### Set Audio Mute
Mutes or unmutes the audio coming from the display.
- Status: [Enum] "On" mutes the audio, "Off" unmutes the audio.
### Set Audio Level
Adjusts the audio level(volume) coming from th display.
- Level: [Integer] The level to be set to in absolute value. Must be between 0 - 100.

### Select Source
Changes the input of the display.
- Name: [String] The name of input to be switched to. Available sources listed in "Sources" variable.

### Set Brightness
Lightens or darkens the image.
- Level: [Integer] The level to be set to in absolute value. Must be between 0 - 100.

### Set Contrast
Enhances or reduces the image's contrast
- Level: [Integer] The level to be set to in absolute value. Must be between 0 - 100.
## Variables

### Status
[Enum] The display's connection status.
- "Disconnected": Cannot connect to the display
- "Connected":  The connection to the display is good.

### Power
[Enum] The display's current power status.
- "Off": The display is currently off.
- "On":  The display is currently on.

### AudioMute
[Enum] The display's audio mute state.
- "Off": The display's audio is currently unmuted.
- "On":  The display's audio is currently muted.

### AudioLevel
[Integer] The current audio level(volume). 

### Sources
[Enum] The current source selected by the user.

- "Display Port",
- "DVI1",
- "DVI2",
- "HDMI 1",
- "HDMI 2",
- "HDMI 3",
- "HDMI 4",
- "Option"
        

### TemperatureStatus
[Integer] The current temperature in Celsius.


## Release Notes

### 1.0.3
- Added dynamic input sources according to the model entered at setup.

### 1.0.2
- Got rid of the `this.base.setCommandManagerOptions()` call, which was not compatible with CX 1.4.1.

### 1.0.1
- Modified the list of input sources in package.json.
- Fixed the readme accordingly.

### 1.0.0
- Initial Version

