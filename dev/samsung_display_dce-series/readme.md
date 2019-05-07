# Samsung DCE Display

## Overview
Driver for Samsung DCE Displays using MDC Protocol.

Tested locally over RJ45 on a DC55E display.

For best results, use Control Server version 1.2.0 or higher. 

_**Beware, MDC does not allow for multiple control softwares to be connected simultaneously**_

### Models include:

- ED65E/ED75E
- EM65E/EM75E
- DC32E/DC40E/DC48E/DC55E
- DC32E-M/DC40E-M/DC48E-M/DC55E-M
- DC40E-H/DC48E-H

## Setup
- "Host": For LAN communication, the IP address or host name of the display. For Serial, the IP address or host name of the serial converter.
- "Port" : The port of TCP communication. For LAN communication, the default port is `1515`. For Serial, consult your serial adapter information.
- "ID": The ID of the display. Found in 'Multi-Control' menu setting.
 
## Commands

### Set Power
Turns the display on or off
- Status: [Enum] "On" or "Off" to turn the display on or off.

### Set Network Standby
Changes the displays Network Standby setting
- Status: [Enum] "On" network standby enabled, "Off" network standby disabled

### Set Audio Mute
Mutes or unmutes the audio coming from the display.
- Status: [Enum] "On" mutes the audio, "Off" unmutes the audio.

### Set Audio Level
Adjusts the audio level(volume) coming from the display.
- Level: [Integer] The level to be set to in absolute value. Must be between 0 - 100 or an error is returned.

### Select Source
Changes the input of the display.
- Name: [String] The name of input to be switched to. If input name is incorrect or not available, an error is returned. Available sources listed in "Sources" variable.

### Set Contrast
Adjusts the contrast of the source content. **Only available when Source is DTV, A/V, S-Video, Component, or HDMI**
- Level: [Integer] The contrast to be set to in absolute value. Must be between 1 - 100 or an error is returned.

### Set Brightness
Adjusts the brightness of the source content. **Only available when Source is DTV, A/V, S-Video, Component, or HDMI**
- Level: [Integer] The brightness to be set to in absolute value. Must be between 1 - 100 or an error is returned.

### Set Sharpness
Adjusts the sharpness of the source content. **Only available when Source is DTV, A/V, Component, or HDMI**
- Level: [Integer] The sharpness to be set to in absolute value. Must be between 1 - 100 or an error is returned.

## Variables

### Status

[Enum] The display's connection status.

- "Disconnected": The display is not connected or connection is disrupted.
- "Connected":  The display is connected, and available to receive commands.

### Power

[Enum] The displays's current power status.

- "Off": The display is currently off
- "On":  The display is currently on

### Network Standby
[Enum] The display's network standby setting.
- "Off": The display won't power on from network.
- "On": The display will power on from network.

### AudioMute

[Enum] The display's audio mute state.

- "Off": The display's audio is currently unmuted.
- "On":  The display's audio is currently muted.

### AudioLevel

[Integer] The current audio level(volume). 


### Sources
[Enum] The current source selected by the user. Please see your product documentation for the sources available for each model.

- "PC": Content is coming from the PC input.
- "DVI": Content is coming from the DVI input.
- "A/V": Content is coming from the A/V input.
- "Component": Content is coming from the Component input.
- "Magicinfo": Content is coming from the Magicinfo source.
- "DVI-V": Content is coming from the DVI-V source. **This is read only-source, and cannot be set to**
- "TV": Content is coming from the TV (RF) input.
- "DTV": Content is coming from the DTV input.
- "HDMI1": Content is coming from the HDMI1 input.
- "HDMI2": Content is coming from the HDMI2 input.
- "HDBT": Content is coming from the HDBT input.

### Contrast

[Integer] The current contrast value

### Brightness

[Integer] The current brightness value

### Sharpness

[Integer] The current sharpness value

### Temperature

[Enum] The current state of the display's temperature alarm

- "Normal": The display is currently operating at a normal temperature
- "Error":  The display currently has a temperature issue.

### CurrentTemp

[Integer] The current temperature value in celsius

### Fan

[Enum] The display's fan status.

- "Normal": The display fan is currently operating
- "Error":  The display fan currently has an issue.

### Sync

[Enum] The display's sync status.

- "Normal": The display video input is currently synced
- "Error,  No Sync":  The display video input sync currently has an issue.

### MDCConnectionType

[Enum] The display's Multi Display Control (MDC) connection type

- "RS232": The display is controled from the RS232 serial port
- "RJ45": The display is controlled from the RJ45 network port  

### Model

[String] The display model

### Serial

[String] The display serial number

### SWVersion

[String] The display internal software version

### DeviceName

[String] The display's network device name

### Error

[String] The displayed error returned from the display. Cleared after successful command or poll.

## Release Notes

### 1.0.0
- Initial version.

### 1.0.0-hotfix1
- Edit by AVD, attempt to fix TCP reconnect error