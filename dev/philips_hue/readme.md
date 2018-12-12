# Philips Hue


## Overview

Driver for Philips Hue lighting system. Uses the huejay npm module ([github.com/sqmk/huejay](https://github.com/sqmk/huejay)).


## Setup

- "Host": The IP address or host name of the hue bridge.
- "API Username": The API username to use. If you are new to the Philips Hue API, see [www.developers.meethue.com/documentation/getting-started](https://www.developers.meethue.com/documentation/getting-started).
- "Button Timeout": The time after which the button variables will revert back to "Idle" state.
- "Sensors": Add information for each sensor. "Identifier" is the integer assosciated with /api/<username>/sensors/ json structure. "Friendly Name" will be used as overture variable name.


## Variables

### Status

[enum] The current connection status of the Hue Bridge.
- "Disconnected" : The bridge is not connected.
- "Connected" : The bridge is connected, and able to receive commands.

### Motion Sensor Variables

These will be added dynamically based on the sensors specified in the setup dialog.
Variable name will be taken from config.name (Friendly Name).

### Dimmer Switch Variable

As above, these are added dynamically from setup information.
This variable will update with each button press event (short, long, hold), and revert to "Idle" after "Button Timeout" set during setup (default 3 seconds).


## Commands

No user commands available.


## Revisions

### 1.0.0

- Initial version
