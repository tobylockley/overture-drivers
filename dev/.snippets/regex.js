let str = 'test1234'
let match = str.match(/.*?(\d+)/i)
match && console.log(match[1])

let str2 = ```
device(34:1b:22:80:57:84);
 device.gen; model=ZyperUHD, type=decoder, name=34:1b:22:80:57:84, state=Up, uptime=0d:3h:3m:19s, lastChangeId=63
 device.firmwareUpdate; status=idle, loadingFile=none, percentComplete=0
 device.hdmiOutput; cableConnected=disconnected, hdcp=NA, hdcp-version=NA, hdmi-2.0=NA, horizontalSize=0, verticalSize=0, fps=0, interlaced=NA
 device.hdmiOutput; active-color-mapping=NA, active-colorDepth=NA
 device.hdmiOutput; preferred-horizontalSize=NA, preferred-verticalSize=NA, preferred-fps=NA
 device.hdmiOutput; maxPixelClockMhz=NA, supported-color-mappings=NA, max-colorDepth=NA
 device.edid; edid-status=NA, edid-monitor-name=NA
 device.hdmiOutput; streamDatarate=400Mbps
 device.connectedEncoder; mac=34:1b:22:80:56:ef, name=UHD_myanmar, receivingVideoFromEncoder=no, reason=decoder hdmi down
 device.connectedEncoderAnalogAudio; mac=none, name=N/A, receivingAudioFromEncoder=no
 device.activeVideoWall; name=none
```

let regex = /device\((.*?)\)[\s\S]*?model=(.*?),.*?name=(.*?),/g;
let match
while (match = regex.exec(str2)) {
    console.log(`MAC: ${match[1]}, Name: ${match[3]}, Model: ${match[2]}`)
}