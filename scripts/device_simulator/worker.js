const net = require('net')
const FrameParser = require('./FrameParser.js')
const VirtualDevice = require('./VirtualDevice.js')
const colorCodes = require('./colorCodes.json')

let device, parser, socket

function initWorker(port) {
  console.log(`[${process.pid} W] Worker starting on port ${port}`)
  device = new VirtualDevice()
  parser = new FrameParser('\n', onFrame)
  net.createServer(_socket => {
    socket = _socket
    socket.on('data', function(data) {
      // console.debug(`[${process.pid} W] TCP packet received: ${data.toString().replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`)
      parser.push(data)
    })
  }).listen(port)
}

// PROCESS TCP FRAMES
function onFrame(data) {
  let match
  console.log(`[${process.pid} W] onFrame data: ${data.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`)

  // GETTERS
  match = data.match(/getText\n/)
  if (match) {
    // console.debug(`[${process.pid} W] getText:`, match)
    socket.write(`getText,OK,${device.text}\n`)
    return
  }

  match = data.match(/getRGB\n/)
  if (match) {
    // console.debug(`[${process.pid} W] getRGB:`, match)
    socket.write(`getRGB,OK,${device.rgb.r},${device.rgb.g},${device.rgb.b}\n`)
    return
  }

  // SETTERS
  match = data.match(/setText,(.*?)\n/)
  if (match) {
    // console.debug(`[${process.pid} W] setText:`, match)
    try {
      device.text = match[1]
      socket.write(`setText,OK,${device.text}\n`)
      updateMaster()
    }
    catch (error) {
      socket.write(`setText,ERR,${error.message}\n`)
    }
    return
  }

  match = data.match(/setR,(.*?)\n/)
  if (match) {
    // console.debug(`[${process.pid} W] setR:`, match)
    try {
      device.r = match[1]
      socket.write(`setR,OK,${device.r}\n`)
      updateMaster()
    }
    catch (error) {
      socket.write(`setR,ERR,${error.message}\n`)
    }
    return
  }

  match = data.match(/setG,(.*?)\n/)
  if (match) {
    // console.debug(`[${process.pid} W] setG:`, match)
    try {
      device.g = match[1]
      socket.write(`setG,OK,${device.g}\n`)
      updateMaster()
    }
    catch (error) {
      socket.write(`setG,ERR,${error.message}\n`)
    }
    return
  }

  match = data.match(/setB,(.*?)\n/)
  if (match) {
    // console.debug(`[${process.pid} W] setB:`, match)
    try {
      device.b = match[1]
      socket.write(`setB,OK,${device.b}\n`)
      updateMaster()
    }
    catch (error) {
      socket.write(`setB,ERR,${error.message}\n`)
    }
    return
  }

  match = data.match(/recallPreset,(.*?)\n/)
  if (match) {
    // console.debug(`[${process.pid} W] recallPreset:`, match)
    try {
      // Retrieve color from json file, then set rgb
      let color = colorCodes[match[1].toUpperCase()]
      if (color) {
        device.r = color[0]
        device.g = color[1]
        device.b = color[2]
        socket.write(`recallPreset,OK,${match[1]}\n`)
        updateMaster()
      }
      else {
        throw new Error('Preset not found')
      }
    }
    catch (error) {
      socket.write(`recallPreset,ERR,${error.message}\n`)
    }
    return
  }

  socket.write('ERR,Invalid command\n') // Send error if frame not processed
}

// PROCESS MESSAGES FROM MASTER PROCESS
process.on('message', msg => {
  console.log(`[${process.pid} W] Message from master:`, msg)
  if (msg === 'getStatus') {
    // Master process has requested device status
    updateMaster()
  }
})

function updateMaster() {
  // Send current device status to master, including this processes PID
  process.send({
    id: process.pid,
    text: device.text,
    r: device.r,
    g: device.g,
    b: device.b
  })
}

// MODULE EXPORTS
module.exports = {initWorker}