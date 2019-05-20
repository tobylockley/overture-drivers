# Philips Hue


## Overview

Driver for Philips Hue lighting system. Uses the huejay npm module ([github.com/sqmk/huejay](https://github.com/sqmk/huejay)).


## Setup

- "Host": The IP address or host name of the hue bridge.
- "API Username": The API username to use. If you are new to the Philips Hue API, see [www.developers.meethue.com/documentation/getting-started](https://www.developers.meethue.com/documentation/getting-started).
- "Groups": An array of all group names configured in the system.


## Variables

### Status

[enum] The current connection status of the Hue Bridge.
- "Disconnected" : The bridge is not connected
- "Connected" : The bridge is connected, and able to receive commands

### Power (for each group)

[enum] Turn the group of lights on or off.
  - "Off": All lights are off
  - "On": All lights are on

### Level (for each group)

[integer] Set the brightness level for all lights in group.
  - minimum: 0
  - maximum: 254

### Color Temperature (for each group)

[integer] Set the color temperature in kelvin for all lights in group.
  - minimum: 2000
  - maximum: 6500


## Commands

### Set Power
Turn on or off the group of lights
  - "Group": [string] The name of the group to control
  - "Status": [enum] "On" or "Off" to turn lights on or off

### Set Level
Set brightness level of group.
  - "Group": [string] The name of the group to control
  - "Level": [integer] Brightness level

### Set Color Temperature
Set color temperature of group.
  - "Group": [string] The name of the group to control
  - "Level": [integer] Color temperature in kelvin


## Revisions

### 1.0.0
- Initial version.

### 1.0.1
- Fixed bug with command defer for set functions.
- Logging for "getall" function simplified.