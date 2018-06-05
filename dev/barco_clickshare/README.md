#Barco Clickshare Overture Driver

## Overview
ClickShare by Barco is a wireless presentation system intended to replace wired setups and enhance meetings, conferences and presentations in a variety of ways. 
USB ClickShare buttons plug into your device, or for mobile devices an app is downloaded. 
Then, by clicking the button, you can wirelessly share your devices display through the central video screen.

*Note:*_ The `CSM-1` model doesn't support `restarting` status. It goes directly to `Disconnected` while restarting.  

## Setup

### Model
ModelName of the clickshare base.
Models supported: CSM-1, CSC-1, CSE-200, CSE-800

### Address
IP address or URL of the Clickshare device

### User
Username to login to the API. Default is `integrator`.

### Password
Password to login to the API. Default is `integrator`.

### Refresh Interval
Frequency of variables updates in ms.

### Temperatures Unit
Unit of the temperature variables and command parameters.
Default is Celsius.

## Variables

- ModelName [string]
- Status [enum] 
-- Values: Disconnected, Restarting, Warning, Error, Connected, Standby
- StatusMessage [string]
- SharingStatus [enum]
-- Values: Not Sharing, Sharing
- FirmwareVersion [string]
- CurrentUptime [integer]
- TotalUptime [integer]
- Location [string]
- MeetingRoomName [string]
- SerialNumber [string]
- CpuTemperature [real]
-- Unit defined at device setup (°C or °F). Only available for CSC-1, CSE-200, CSE-800.

## Commands

### Restart System
Restart the base unit.

### Shutdown System
Stop the base unit. Be careful, cannot start the base remotely when it is stopped. Not available on CSE-200 and CSE-800.

### Standby System
Put the base unit in standby mode.
In the CSE-800, only the displays output goes into standby mode.

### Awake System
Awake the base unit from standby mode.

##Release note

### 2.0.1
- Defining `cpuTemperature` variable in readme. 

### 2.0.0
- Support of CSE-800 model.
- Fixed typo on setup `Celsius` unit name.
- Fixed typo in setup `Address` word.


### 1.3.4
- Updated readme, now precise that CSM-1 model doesn't support `Restarting` status.
- Updated `package.json` to the add the new key `models`.

### 1.3.3
- Fix: Stop the request loop when the device is stopped/deleted.

### 1.3.2
- Increased the timeout of API requests from `6` to `10` secs.
- Fixed a typo in the html template reference.
- Changes subtype from `avconference` to `clickshare`.

### 1.3.1
- Added `SerialNumber` device variable.
- Fixed wording in `package.json`. Ex: `model` setup.
- Fixed restarting status which was passing in disconnected during restart.


### 1.3.0
- Adapted to *support CSE-200, and CSM-1*.
- Removed `port` in setup, but added `model`.
- Added this `Readme.md` file with release note.
- Removed unnecessary setup parameter `port`.
- Added `ModelName` device variable.
- Increased the *timeout* to 6s, cause CSM-1 seems slower. 
- Ability to choose the temperature unit via `temperatureUnit` in setup.

### 1.2.0
- Added ability to update location and meeting room by changing the variable values directly.

### 1.1.4
- Improvements and bug fixes about resetting values when the base restart.

### 1.1.3
- Added ability to restart, shutdown, standby and awake by changing the `status` variable directly.

