# CS Relay Behaviour

## Overview
Coupled with a front-end page, allows CS logs to be viewed from the UX.
Only one user can be connected at a time to each CS relay.

## Setup
- "CS Port": Port that CS is configured to, default is 8080


## Commands
All commands are accessed using perform via the Overture API. Response contains return data.

### Get Project
Returns information about the CS configuration, points, drivers, etc.

### Get Logs
Returns all recent logs from the CS since last "Get Logs" call.


## Revisions

### 1.0.0
- Initial version