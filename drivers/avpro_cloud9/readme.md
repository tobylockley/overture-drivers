# AV Pro Cloud 9

## Overview

Driver for AV Pro Cloud 9 HDBT 9x9 switcher.

## Setup
- "Host": The IP address or host name of the Cloud 9.
- "Port": The port of TCP communication. (Default 23)


## Variables

### Status
[enum] The current connection status of the device.
- "Disconnected" : The device is not connected.
- "Connected" : The device is connected, and able to receive commands.

### Multiview Mode
[enum] The current multiview mode.
- "2x2": 2x2 multiview mode.
- "3x3": 3x3 multiview mode.

### Sources (per output or quadview quadrant)
[enum] The list of possible sources for each output.

### Videowall Mode (per output)
[enum] The current videowall mode of the output.
- "None": Normal operating mode.
- "2x2 - TL": 2x2 mode, top left.
- "2x2 - TR": 2x2 mode, top right.
- "2x2 - BL": 2x2 mode, bottom left.
- "2x2 - BR": 2x2 mode, bottom right.
- "3x3 - TL": 3x3 mode, top left.
- "3x3 - TC": 3x3 mode, top center.
- "3x3 - TR": 3x3 mode, top right.
- "3x3 - ML": 3x3 mode, middle left.
- "3x3 - MC": 3x3 mode, middle center.
- "3x3 - MR": 3x3 mode, middle right.
- "3x3 - BL": 3x3 mode, bottom left.
- "3x3 - BC": 3x3 mode, bottom center.
- "3x3 - BR": 3x3 mode, bottom right.


## Commands

### Select Source
To select the input source to display.
- "Channel": [integer] Output number.
- "Name": [string] The name of the input source (given by variable "Sources").

## Revisions

### 1.0.0
- Initial version.

### 1.0.1
- Added videowall capability.