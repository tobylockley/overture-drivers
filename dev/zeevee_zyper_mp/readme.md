# Barco Overture Training

##Overview

Builds a Database of Encoders and Decoders from the Setup Point Schema specific to the container. 
Device Identifier: The name of the Encoder/Decoder in the Maestro Z Database OR Mac address of the device. (CASE SPECIFIC!)
Friendly Name: This will be presented to the user to select devices with a relevant name for in-room control
 

##Setup
Host: IP address of the Zyper Management Platform (MP)
Port: Zyper MP uses telnet which is port 23
Encoders: Dynamically create a variable to contain the Encoder device ID and the Friendly name. 
Decoders: Dynamically create a variable to contain the Encoder device ID and the Friendly name. 

##Commands
Power On
enum[On, Off]

##Variables

###Power

type: [enum]

##Release Notes
