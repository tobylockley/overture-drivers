# Device Simulator

## Overview
Simulates a basic TCP/telnet device in order to teach Overture Driver creation.

## Setup
Ensure node.js is installed.
Open a command prompt in this directory, then run "npm install" to install all dependencies.

## Usage
To run, type "npm start X", where X is the number of simulated devices you want to spawn.
Access the interface at http://localhost:3000
Device ports will begin at 3001, incrementing for number of devices spawned.
Connect to a simulated device port (3001+) using raw TCP, e.g. PuTTy or packet sender, then send commands as below.

### GET Methods
#### getText
"getText\n"
Retrieve the string currently being displayed
Response: "getText,OK,{TEXT}\n"

#### getRGB
"getRGB\n"
Retrieve the R,G,B values of the current background colour
Values will be 0-255
Response: "getRGB,OK,{Rval},{Gval},{Bval}\n"

### SET Methods
#### setText
"setText,{TEXT}\n"
Change the string being displayed

#### setR/setG/setB
"setR,{Rval}\n"
"setG,{Gval}\n"
"setB,{Bval}\n"
Change the current background colour R/G/B value
Legal values are 0-255

#### recallPreset (colour)
"recallPreset,{COLOUR_NAME}\n"
Change background colour using standard CSS colour names
For reference, see: https://www.quackit.com/css/css_color_codes.cfm