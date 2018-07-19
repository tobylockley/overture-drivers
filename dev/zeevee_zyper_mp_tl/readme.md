# ZeeVee Zyper Management Platform


## Overview

Driver for ZeeVee Zyper Management Platform. User can switch decoder sources, and initiate video walls. This particular driver utilises TechLogix HDMI switchers for a demo room.


## Setup

- "Host": The IP address or host name of the device. (Default 192.168.1.)
- "Port": The port of TCP communication. (Default 9761)
- "Encoders": Add any encoders, and choose the type/model. USB options not implemented yet (they won't do anything!).
- "Decoders": Add any decoders, and choose the type/model. USB options not implemented yet (they won't do anything!).
- "Multiviews": Add any multiviews (4K only).
- "Video-Walls": Add any videowalls, and choose the type/model.


## Variables

### Status

[enum] The current connection status of the management platform.
- "Disconnected" : The device is not connected.
- "Connected" : The device is connected, and able to receive commands.

### ScreenMode{n}

1 = Top Left
2 = Top Right
3 = Bottom Left
4 = Bottom Right
[enum] List of input sources user can select for the appropriate TechLogix HDMI switcher.
- "Unknown": Input has not been selected yet, and as the driver does not support status polling, so state is unknown.
- "UHD": Change input source to HDMI1 (UHD decoder)
- "4K": Change input source to HDMI2 (4K decoder)
- "Sleep": Change input source to HDMI3 (no input), so displays go to sleep

### EncodersUHD

[enum] List of UHD encoders that is generated from setup information. Purely for UI/information purposes.

### Encoders4K

[enum] List of 4K encoders that is generated from setup information. Purely for UI/information purposes.

### Multiviews

[enum] List of multiviews that is generated from setup information. Purely for UI/information purposes.

### VideoWall_{name}

[enum] List of available videowalls that can be selected, generated dynamically from setup information.
Due to the nature of videowalls, when an option is selected, the videowall will be initialised on all displays,

### Decoder_{name}

[enum] List of available input sources that can be selected for a particular decoder, generated dynamically from setup information.
Selecting an input source will trigger the assosciated HDMI switcher to display the current decoder on screen.

### DecoderUSB_{name}

[enum] List of available USB sources (encoders) that can be selected, generated dynamically from setup information.
'none' will detach all USB clients.


## Commands

### Set Screen Mode
Select the assosciated TechLogix HDMI switcher input to show on screen.
- "ScreenId": [integer] 1-4, select the screen
- "Mode": Which decoder to show on screen, or sleep

### Set Decoder Usb
Selects which encoder to attach to and use as a USB client
- "Name": [string] the name of the decoder (attached to USB host)
- "Source": [string] Name of the encoder (attached to USB client)

### Set Decoder
Selects which encoder/multiview to attach to for video output
- "Name": [string] Name of the decoder
- "Source": [string] Input source (encoder/multiview) to use

### Start Video Wall
Initialise a video wall.
- "Name": [string] Name of the video wall to start
- "Source": [string] Input source (encoder) to use

### Get Info
Get current encoder/decoder information.


## Revisions

### 1.0.0-beta.1

- Initial version.

### 1.0.0-beta.7

- Final stable version for demo room.

### 1.0.0-beta.8

- Added 'Sleep' option to ScreenMode variable.

### 1.0.0-beta.9

- Added tick function to reconnect automatically.
