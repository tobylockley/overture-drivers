# Zoom Room Video Conference System

## Overview

Driver for a Zoom Room Video Conferencing System connected thru CS-API & REST-API.

Tested locally on a Zoom Room running software v4.3.1104.0404.

For best results, use Control Server version 1.4.0 or higher.

### Models include

- Zoom Room

## Setup

- "User Email": The developer email account used for REST API access.
- "Room Name": The Zoom Room Name.
- "Use Proxy": Use the Control Server Proxy setting to access the Zoom Room REST API.  Default: 'No Proxy'.
- "API Key": The REST API Key.
- "API Secret": The REST API Secret.
- "CS API Host": The Zoom Room Hostname or IP Address.
- "CS API Port": The Zoom Room CS-API Port.  Default `2244`.
- "CS API Pass": The Zoom Room CS-API Password.  Default 'zoomus123'.

## Commands

### Call Number

Joins the given Meeting ID number.

- Number: [String] The Meeting ID to join.

### Call Name

Dials a contact name.

- Name: [String] The contact name to dial.  The Contacts names can be found in the 'AddressBook' variable.

### Start Meeting

Start a scheduled Meeting.

- Name: [String] The Meeting Name to join.  The Meetings names can be found in the 'Meetings' variable.

### Create Meeting

Creates a new Instant Meeting and place its ID in the MeetingNumber Variable

### Answer

Accepts an incoming call.

- Name: [String] The name of the caller to accept.  The Callers names can be found in the 'Callers' variable.

### Reject

Rejects an incoming call.

- Name: [String] The name of the caller to reject.  The Callers names can be found in the 'Callers' variable.

### Hangup

Leave the current Meeting without ending it.

### End Meeting

End the current Meeting.

### Start Presentation

Start a presentation only meeting.

- Display: [Enum] The sharing informations to display on screen.
  - Off:  Display no sharing information.
  - Laptop:  Display Laptop devices sharing informations.
  - iOS:  Display iOS devices sharing informations.

### Stop Presentation

Stop the Presentation only meeting and converts it to a normal meeting.

### Set Instructions

Show the on screen instruction for sharing.

- Display: [Enum] The sharing informations to display on screen.
  - "Off":  Display no sharing information.
  - "Laptop":  Display Laptop devices sharing informations.
  - "iOS":  Display iOS devices sharing informations.

### Set Sharing

Sets the sharing status.

- Status: [Enum]
  - "Off":  Turns sharing off.
  - "On":  Turns sharing on.

### Set Recording

Turns meeting recording On or Off.  Recording is only supported for meeting hosted by the Zoom Room that were scheduled through calendar apps.

- Status: [Enum]
  - "Off":  Turns recording off.
  - "On":  Turns recording on.

### Set Layout

Sets the screen layout.  The available layout selection depends on the current sharing/meeting state.

- Name: [Enum] The layout name to use.
  - "Gallery":  Participants will be displayed in Gallery layout.
  - "Speaker": The participant currently speaking will be displayed.
  - "Strip":  Participants will be displayed in Strip layout.
  - "ShareAll":  The shared content will be displayed.


### Turn Page

Flip participants thumbnails pages forward or back.

- Direction: [Enum]
  - "Backward": Flip page back.
  - "Forward":  Flip page forward.

### Set Call Locked

Locks meeting so no new participants are allowed to join.

- Status: [Enum]
  - "Off":  Unlocks the meeting.
  - "On":  Locks the meeting.

### Select Camera

Selects the camera used by the Zoom Room.

- Camera: [String]  The camera name.  The valid camera names list can be found in the `Cameras` variable.

### Set Whiteboard

Share the given camera as a meeting whiteboard.

- Camera: [String] The camera name.  The valid camera names list can be found in the `Whiteboard` variable.

### Set Video Mute

Mutes or Unmutes the video output of the Zoom Room.

- Status: [Enum] "On" mutes the output, "Off" unmutes the output.

### Set Audio Level In

Adjusts the gain of the audio input.

- Level: [Integer] The level to be set to in absolute value.

### Set Audio Level Out

Adjusts the gain of the audio output.

- Level: [Integer] The level to be set to in absolute value.

### Set Audio Mute 

Mutes or Unmutes the audio output of the Zoom Room.

- Status: [Enum] "On" mutes the output, "Off" unmutes the output.

### Restart

Restart the Zoom Room Software.

## Variables

### Status

[Enum] The system's connection status.

- "Disconnected": The system is not connected or connection is disrupted.
- "Connected":  The system is connected, and available to receive commands.
- "REST API Only": Only the 'REST API' part of the system is connected.
- "CS API Only": Only the 'CS-API' part of the system is connected.
- "REST OK - CS Busy": The 'REST API' is connected while the CS API is connected but unavailable.
- "REST Off - CS Busy": The 'REST API' is disconnected while the CS API is connected but unavailable.

### InUse

[Enum] The device infered usage state.  The device is considered busy while in a presentation/meeting.

- "Idle": The device is not in use.
- "Busy":  The device is used.

### FirmwareVersion

[String] The Zoom Room software version.

### DeviceName

[String] The configured device name.

### CallStatus

[Enum] The current call status.

- "Idle":  The Zoom Room is not currently in a Meeting.
- "On Call":  The Zoom Room is currently in a Meeting.
- "Connecting":  The Zoom Room is currently connecting to a Meeting.
- "Unknown":  The call status is Unknown.

### AddressBook

[Enum] The address book contacts names

- Filled dynamically from the Zoom REST API.

### Meetings

[Enum] The Rooms's scheduled Meetings names

- Filled dynamically from the Zoom REST API.

### Callers

[Enum] The Callers names

- Filled dynamically from the Zoom REST API.

### Participants

[Enum] The current calling Participants names

- Filled dynamically from the Zoom REST API.

### Cameras

[Enum] The available cameras

- Filled dynamically from the Zoom REST API.

### Whiteboard

[Enum] The available cameras

- Filled dynamically from the Zoom REST API.

### HDMISource

[Enum] The HDMI source status

- "Disconnected": No HDMI source is connected.
- 'Connected":  An HDMI source is connected.

### HDMISignal

[Enum] The HDMI source signal presence.

- "Unavalaible":  HDMI signal is not present.
- "Avalaible":  HDMI signal is present.

### Number

[String] The Meeting number to dial.

### MeetingNumber

[String] The current Meeting number.

### CallLocked

[Enum] The meeting's locked status.

- "Off":  The meeting is unlocked.
- "On":  The meeting is locked.

### CallType

[Enum] The meeting type.

- "None":  No type or unknown state.
- "Normal":  The meeting is a normal meeting.
- "Sharing":  The meeting is a presentation meeting.
- "PSTN":  The meeting is a phone meeting.

### Sharing

[Enum] The sharing status.

- "None":  Sharing is not active.
- "Direct":  Sharing directly using the sharing key.
- "AirPlay":  Sharing from MacOS/iOS using AirPlay.
- "HDMI":  Sharing the HDMI device source.
- "Whiteboard":  Sharing the whiteboard camera.

### SharingKey

[String] The current sharing key, to be used for Direct sharing.

### AirplayPassword

[String] The current password to be used for Airplay sharing.

### WifiName

[String] The wifi network used for Airplay sharing.

### PairingCode

[String] The current pairing code fro sharing.

### ShowInstructions

[Enum] The sharing instructions display status.

- "Off":  The instructions are not displayed.
- "Laptop":  The laptop sharing instructions are currently displayed.
- "iOS":  The iOS sharing instructions are displayed.

### Recording

[Enum] The meeting recording status.  Recording is only supported for meeting hosted by the Zoom Room that were scheduled through calendar apps.

- "Off":  The Zoom Room does not record the meeting.
- "On":  The Zoom Room is recording the meeting.

### CanRecord

[Enum] The Zoom Room recording permission.

- "No": The Zoom Room can not record.
- "Yes": The Zoom Room can record.

### ScreenCount

[Integer] The number of displays connected to the Zoom Room.

### Layout

[Enum] The current Zoom Room display layout.

- "Gallery":  Participants will be displayed in Gallery layout.
- "Speaker": The participant currently speaking will be displayed.
- "Strip":  Participants will be displayed in Strip layout.
- "ShareAll":  The shared content will be displayed.

### LayoutHasPages

[Enum] Does the current layout has pages?  Used to predict if pages can be flipped.

- "No": The current layout has no pages.
- "Yes": The current layout has pages.

### CallHost

[Enum] The current meeting host.

- "Self":  The Zoom Room host the current meeting.
- "Other":  The Zoom Room does not host the current meeting.


### VideoMute

[Enum] The video output mute state.

- "Off": The output is currently unmuted.
- "On":  The output is currently muted.

### AudioMuteOutput

[Enum] The audio output mute state.

- "Off": The output is currently unmuted.
- "On":  The output is currently muted.

### AudioLevelInput

[Integer] The current volume of the input.

### AudioLevelOutput

[Integer] The current volume of the output.

## Revisions

### 1.1.0

- Harmonized to VC subtype
- Presentation, Sharing & Whiteboards support
- Select Cameras
- Layout selections
- Recording meetings
- proxy support
- minimized use of REST API

### 1.0.0

- Initial
