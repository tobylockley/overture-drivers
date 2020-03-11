# Yamaha MusicCast WX-50 series

## Overview
Driver for Yamaha MusicCast WX-50 series audiosystem using YXC API.

Tested remotely on a WXA-50 .

### Models include:

- WXA-50
- WXC-50

## Setup
- "Host":The IP address or host name of the MusicCast device.
 
## Commands

### Set Power
Turns the MusicCast device on or off
- Status: [Enum] "On" or "Off" to turn the audiosystem on or off (standby).

### Set Audio Mute
Mutes or unmutes the audio coming from the MusicCast device.
- Status: [Enum] "On" mutes the audio, "Off" unmutes the audio.

### Set Audio Level
Adjusts the audio level(volume) coming from the MusicCast device.
- Level: [Integer] The level to be set to in absolute value. The volume level range is fetched dynamically from the MusicCast device.

### Select Source
Changes the input of the MusicCast device.
- Name: [String] The name of input to be switched to. Available sources listed in "Sources" variable.

## Variables

### Status
[Enum] The MusicCast connection status.

- "Disconnected": The MusicCast device is not connected or connection is disrupted.
- "Connected":  The MusicCast device is connected, and available to receive commands.

### Power
[Enum] The MusicCast devices current power status.

- "Off": The MusicCast device is currently off (standby mode)
- "On":  The MusicCast device is currently on

### AudioMute
[Enum] The MusicCast device audio mute state.

- "Off": The MusicCast device audio is currently unmuted.
- "On":  The MusicCast device audio is currently muted.

### AudioLevel
[Integer] The current audio level(volume). 

### Sources
[Enum] The current source selected by the user.  The Sources list is built dynamically from the device information. Please see your product documentation for the sources available for each model.

## Release Notes

### 1.0.1
- AudioLevel variable in dB

### 1.0.0
- Initial version.

