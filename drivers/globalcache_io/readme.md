# Global Cache I/O

## Overview
Driver for the Global Cache Relay Products including:
- GC-100
- iTach
- iTach Flex

Make sure devices are using the newest firmware and configured according their documentation.
**Note**: This driver doesn't support Double Throw mode in the iTach Flex.
**Note**: There is a known bug on `iTachFlexEthernetPoE` firmware version `710-3000-19` and prior: The relays won't work until you save the configuration on the device interface.

## Setup
- "Host": For LAN communication, the IP address or host name of the Global Cache Relay.
- "Port" : The port of TCP communication. The default port is `4998`. 
- "Relay Module": The Module # of the relay component. This is 1 for the  iTach and iTach Flex models. 
- "Input Module": The Module # of the input component. This is 2 for the iTach Flex model. 
- "Relays" : The number of relays the Global Cache is dealing with. 3 for the iTach, 4 for iTach Flex models. 
- "Inputs" : The number of inputs the Global Cache is dealing with. 3 for the iTach, 4 for iTach Flex models. 
 
## Commands

### Set Power
Open or close a contact
- Channel: [Integer] The relay number you wish to control.
- Status: [Enum] "On" or "Off" to turn the relay on(close) or off(open).


##Variables

###Status

[Enum] The relay's connection status.

- "Disconnected": The relay is not connected or connection is disrupted.
- "Connected":  The relay is connected, and available to receive commands.

###Power (Per Channel)

[Enum] The relay's current power status.

- "Off": The relay is open.
- "On":  The relay is closed.

###Input (Per Channel)

[Enum] The input's current power status. This is read only.

- "Off": The input is open.
- "On":  The input is closed.

###Error

[String] The error returned by the device. Cleared after successful command or poll.

## Release Notes

### 1.1.4
- Updated syntax and tcp reconnect logic

### 1.1.3
- Added note in `readme.md` to explain known device bug, causing need to save device config.

### 1.1.2
- Displays error when relays are disabled or unavailable.

### 1.1.1
- Internal fix

### 1.1.0
- Added support for Inputs.

### 1.0.0
- Initial version.

