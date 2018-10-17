# Philips Hue Color Ambiance

## Overview

Driver for a Philips Hue Color Ambiance device
https://developers.meethue.com/documentation/how-hue-works

Tested locally on a Hue Bridge with E26 bulbs.

Models include
- E26

## Setup

 - "Host": For LAN communication, the IP address or host name of the Philips bridge.
 - "User name" : The user name allowing to be identified through the Philips bridge.
 - "Lamps": Each lamp is defined via an identifier provided by the Philips bridge configuration. Generally, the bridge is pre-configured with an identifier 1 for the light1, identifier 2 for the light2...

 Notes:
 The WinHue3 application (https://hyrules.github.io/WinHue3/) can be used to `Detect Bridges` on the network. Once the IP address is found, it is possible to pair the application and the bidge in order to obtain the API key.
 This API Key is used as User name in the device setup.
 

## Variables

### Status

The current connection status of the device.

Type: Enum
Enums: "Disconnected", "Connected"
Access: Read Only

### Presets

It allows to choose a scene in the list provided by the bridge.
But this variable does not display the current selected scene.

Type: Enum
Access: Write Only

### State

The current state of the light.

Type: Enum
Enums: "Off", "On"
Access: Read Write

### Level

The current brightness of the light (0 to 100)

Type: Integer
Access: Read Write

### Color

The current color of the light in hex format

Type: String
Access: Read Write

### ColorTemperature

The current color temperature of the light between 2000 (warm) and 6500 (cool). The color temperature is in Kelvin.

Type: Integer
Access: Read Write

## Commands

### Recall Preset
Recall a specific scene.
- Name: [String] scene's name.

### Set State
Set the state of the light.
- Channel: [Integer] The light's index.
- State: [Enum]:
  - "Off": turn the light off.
  - "On":  turn the light on.

### Set Level
Set the brightness of the light.
- Channel: [Integer] The light's index.
- Level: [Integer] The level must be between 0 and 100%.

### Set Color
Set the color of the light.
- Channel: [Integer] The light's index.
- Color: [String] The color is formatted in hex, for example #ff2a06

### Set Color Temperature
Set the color temperature of the light.
- Channel: [Integer] The light's index.
- ColorTemperature: [Integer] The color temperature must be between 2000 (warm) and 6500 (cool). The color temperature is in Kelvin.
  
## Revisions

### 1.0.2

- Preset selection defaults to "Select One Preset"
- custom controlpanel template
- display lamp reachability

### 1.0.1

- fix minor ReferenceError in recallPreset

### 1.0.0

- initial version



