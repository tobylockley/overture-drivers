# Zeevee Zyper (4K/UHD)

## Overview

Driver for a Zeevee Zyper Management Platform, controlling Zyper 4K and UHD devices, over a TCP connection.
After configuring IP address and decoder names, the driver will retrieve list of available sources automatically. Source lists will update automatically every 30 seconds.
When selecting video wall from source list, it will trigger the same source on the complete configured video wall (video wall must be pre-configured in MaestroZ).


## Setup

  - "Host": The IP address or host name of the management platform.
  - "Port": The port of TCP communication. (Default 23)

## Variables

### Status

[enum] The current connection status of the device.
  - "Disconnected" : The device is not connected.
  - "Connected" : The device is connected, and able to receive commands.

### Sources (per decoder)

[enum] The list of possible sources for each decoder, including "None", which will remove all joins.

## Commands

### Select Source
To select the input source to display.
  - "Channel": [string] the name of the decoder
  - "Name": [string] the name of the input source (given by variable "Sources")
  - "Index": [integer] index position of this source in the list - for retrieving join commands from a pre-built array

## Revisions

### 1.0.0
  - Initial version
  - Has hard coded logic for techlogix switchers in the demo rack, needs changing

### 1.0.1
  - Removed hard-coded switcher logic
  - Placed all available sources, including video-walls, in one enum list for simplicity
  - Now tracks when decoder is in video-wall mode

### 1.0.2
  - Removed dev files, added some info to readme