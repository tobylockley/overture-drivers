# Barco Clickshare Overture Driver

## Overview
ClickShare by Barco is a wireless presentation system intended to replace wired setups and enhance meetings, conferences and presentations in a variety of ways.
USB ClickShare buttons plug into your device, or for mobile devices an app is downloaded.
Then, by clicking the button, you can wirelessly share your devices display through the central video screen.
Modified by AVD: Added Show/Hide Wallpaper functionality.

Tested remotely on Clickshare CSE-800, CSC-1, CSE-200 and CSM-1.  

**Note:**
- Minimum required CX version is 1.2.0.
- The `CSM-1` model doesn't support `restarting` status. It goes directly to `Disconnected` while restarting.
- The `IsSingleDisplay` and `DisplayMode` variables/functionalities are only supported by the `CSE-800` model.

## Setup
- `Model`: ModelName of the clickshare base (CSM-1, CSC-1, CSE-200, CSE-800).
- `Address`: IP address or URL of the Clickshare device.
- `User`: Username to login to the API. Default is `integrator`.
- `Password`: Password to login to the API. Default is `integrator`.
- `Refresh Interval`: Frequency of variables updates in ms.
- `Temperature Units`: Unit of the temperature variables and command parameters. Default is `Celsius`.

## Variables

### Status 
[Enum] The connection status of the device.*   
- `Disconnected`: Device is not connected  
- `Restarting`: Device is in the process of restarting.  
- `Warning`  
- `Error`  
- `Connected`: Device is connected and login succeeded  
- `Standby`

### ModelName   
[string] Name of the currently connected model.

### FirmwareVersion  
[string] The firmware version of the Button.  

### StatusMessage  
[string] Any relevent message that the device sends to the UI.

### InUseStatus  
[enum] Indicates if at least one source (Button, Link, mobile app, ...) is currently connected.  
- `Disconnected`: No one is using the clickshare.  
- `Connected`: At least one user is connected to the clickshare.  

### WallpaperStatus
[enum] Controls wallpaper mode.
- `Hide`: Wallpaper is hidden in idle mode, no hdmi output.
- `Show`: Wallpaper is shown in idle mode.

### IsSingleDisplay   
[String] Shows if more than one display is connected to the base. *Internal use only*

### DisplayMode  
[enum] If more than one screens are connected to a `CSE-800` Base Unit, this parameter defines if the sources are spread over the screens (`Extended`) or copied on all screens (`Clone`).   
- `Clone`  
- `Extended`  

### SharingStatus  
[enum] Indicates if at least one of the connected sources (Button, Link, mobile app, ...) is currently sharing content on the display.  
- `Not Sharing`  
- `Sharing`  

### CurrentUptime  
[integer] The number of hours since this Base Unit was last booted.  

### TotalUptime  
[integer] The total number of hours that this Base Unit has been running.  

### Location  
[string] The meeting room location that will be displayed in the left top corner of the screen when no content is being shared.  

### MeetingRoomName  
[string] The meeting room name that will be displayed in the left top corner of the screen when no content is being shared.  

### SerialNumber  
[string] The serial number of the Button.  

### CpuTemperature  
[real] The current temperature of the CPU in degrees (unit defined at device setup (`°C` or `°F`)). *Only available for CSC-1, CSE-200, CSE-800*.  

## Commands 

### Restart System  
Restart the server.

### Shutdown System  
Stop the server. Be careful, cannot start the base remotely when it is stopped. Not available on CSE-200 and CSE-800.

### Standby System  
Put the server in standby mode.  
In the CSE-800, only the displays output goes into standby mode.

### Awake System  
Awake the server from standby mode.

### Set Display Mode  
Lets you show the source content either spread out over two screens (`Extended`), either copied on both screens (`Clone`). Only available on `CSE-800` units.  
- `Extended`  
- `Clone`

## Release notes

### 2.2.2-hotfix1
- Added show/hide wallpaper.

### 2.2.2
- Fixed a wrongly formatted setTimeout function call.
- Removed access to the `Shutdown System` command from the control panel.
- Made the `CpuTemperature` variable dynamic and corrected its range according to selected unit.

### 2.2.1
- Fixed an error when using CSE-200 and CSM-1 that was due to incompatible `Display Mode` query being sent.

### 2.2.0
- Added the `DisplayMode` + `IsSingleDisplay` variables. If two screens are connected to the Base Unit, this parameter defines if the sources are spread over both screens (’Extended’) or copied on both screens (’Clone’).

### 2.1.0
- Added the `InUseStatus` variable in order to determine if any device or endpoint is connected to the server.

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

