# Joinable Rooms Behaviour

## Overview
Provides a JoinStatus variable attached to a room, which can be used to trigger macros or device commands.
Triggers must be setup manually using the overture triggers module.
Can also be used in the UI as a conditional state to show/hide controls to the user.
Group names MUST be the same between rooms for this functionality to work.

## Setup
- "Join Group": Add one or more join groups, each containing one or more rooms.
    - "Group Name": Nickname for this joinable group of rooms, which will appear in the JoinStatus enums.
    - "Room Variable Name": Overture variable name for one or more rooms to use in this group.


## Variables

### JoinStatus
[enum] The current join status of the room. Available options will depend on configuration.
- "Unjoined": The default, unjoined state.
- "Initiated_<GROUP_NAME>": One of the rooms in the group has requested a join.
- "Accepted_<GROUP_NAME>": Room has accepted join request, and awaiting other rooms to accept.
- "Joined_<GROUP_NAME>": All rooms have accepted join request, and are in the same joined state.


## Commands

### Set Join
Initiate a join process between this room and one or more rooms.
Must follow sequence of Unjoined -> Initiated -> Accepted -> Joined (joined is automatic, once all rooms have accepted).
 - "Status": [string] If "Unjoined", will remove join on this and all connected rooms. Must initiate join from unjoined state.


## Revisions

### 1.0.0
- Initial version

