# TechLogix Power Amplifier

## Overview

Driver for a TechLogix Power Amplifier device over a TCP connection or GlobalCache serial module.
  
## Setup

 - "Host": The IP address or host name of the device. (Default 192.168.3.20).
 - "Port": The port of TCP communication. (Defaults ... GlobalCache RS232: 4999, TechLogix: 4001).
 - "Model": The model of the device being used.

## Variables

### Status

[enum] The current connection status of the device.
 - "Disconnected" : The device is not connected.
 - "Connected" : The device is connected, and able to receive commands.

### Sources

[enum] List of input sources user can select from (total inputs will differ between models).
 - "Input1": Change input source to Input1.
 - "Input2": Change input source to Input2.
 - "Input3": Change input source to Input3.

### Audio Mute

[enum] The mute status of the line out.
 - "Off": Line out is unmuted.
 - "On" : Line out is muted.

### Audio Level

[integer] Set the audio level of the line out.
 - minimum: 0.
 - maximum: 60.

### Bass

[integer] Set the bass level of the device.
 - minimum: 0.
 - maximum: 8.

### Treble

[integer] Set the treble level of the device.
 - minimum: 0.
 - maximum: 8.

### Audio Mute Input

[enum] The mute status of the microphone.
 - "Off": The microphone is unmuted.
 - "On" : The microphone is muted.

### Audio Level Input

[integer] Set the audio level of the microphone.
 - minimum: 0.
 - maximum: 60.

### Ducking Function

[enum] The ducking function status of the device.
 - "Off": Ducking is off.
 - "On" : Ducking is on.

### Ducking Level

[integer] Set the ducking level of the device.
 - minimum: 0.
 - maximum: 60.

## Commands

### Select Source
To select the input source.
 - "Name": [string] the name of the input source (given by variable "Sources").

### Set Audio Level
Set audio level of the line out (between 0 and 60).
 - "Level": [integer] audio level for the line out.

### Set Audio Mute
Mute or unmute the line out.
 - "Status": [enum] "On" or "Off" to mute or unmute the line out.

### Set Bass
Set bass level of the device (between 0 and 8).
 - "Level": [integer] bass level for the device.

### Set Treble
Set treble level of the device (between 0 and 8).
 - "Level": [integer] treble level for the device.

### Toggle Ducking
Toggle the ducking function on or off. This is the only function in the API.

### Set Ducking Level
Set ducking level of the device (between 0 and 60).
 - "Level": [integer] ducking level for the device.

## Revisions

### 1.0.0

- Initial version.

### 1.0.1

- Added dropdown selection for model during setup.
- Create dynamic variables for sources, microphone and ducking function based on model selected.

### 1.0.2

- Fixed mute functions to allow muting of line in and microphone separately.
- Added AudioMuteInput as a dynamic variable.
- Updated readme.

