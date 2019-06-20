# Biamp Devio

## Overview
Driver for Biamp Devio.


## Setup
- "Host": The IP address or host name of the device.
- "Port": The port of TCP communication. (Default 4030)
- "Password": Password for TCP connection. (Default devio)


## Variables

### Status
[enum] The current connection status of the device.
- "Disconnected" : The device is not connected
- "Connected" : The device is connected, and able to receive commands

### MicMute
[enum] The current mute status of the microphone
- "Off" : The microphone is unmuted
- "On" : The microphone is muted

### UsbInputGain
[integer] Set the gain level of the USB audio input.
- minimum: 0
- maximum: 100

### HdmiInputGain
[integer] Set the gain level of the HDMI audio input.
- minimum: 0
- maximum: 100

### EnableAmpAdjustment
[enum] Enable/disable adjustment of the amp output level.
- "Off" : Adjustment disabled
- "On" : Adjustment enabled

### AmpAudioLevel
[integer] Set the audio level of the amp output.
- minimum: 0
- maximum: 100

### EnableLineAdjustment
[enum] Enable/disable adjustment of the line output level.
- "Off" : Adjustment disabled
- "On" : Adjustment enabled

### LineAudioLevel
[integer] Set the audio level of the line output.
- minimum: 0
- maximum: 100

### EnableHdmiOutputAdjustment
[enum] Enable/disable adjustment of the HDMI output level.
- "Off" : Adjustment disabled
- "On" : Adjustment enabled

### HdmiOutputAudioLevel
[integer] Set the audio level of the HDMI output.
- minimum: 0
- maximum: 100


## Commands

### Set Audio Level
Set the Audio level of the biamp devio variable
- "Channel": [string] name of biamp devio variable, e.g. ampOutputLevel
- "Level": [integer] audio level for the variable, 0-100

### Set Mic Mute
Set a biamp devio boolean variable to false/true
- "Channel": [string] name of biamp devio variable, e.g. masterMicMute
- "Status": [integer] 0/1


## Revisions

### 1.0.0
- Initial version

