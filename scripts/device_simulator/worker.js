const net = require('net')
const FrameParser = require('./FrameParser.js')

function initWorker(port) {
  let parser = new FrameParser('\n', onFrame)
  console.log(`[${process.pid} W] Worker starting on port ${port}`)
  net.createServer(socket => {
    socket.on('data', function(data) {
      console.log(`[${process.pid} W] Worker received: ${data.toString().replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`)
      parser.push(data)
    })
  }).listen(port)
  
  function onFrame(data) {
    let match
    console.log(`[${process.pid} W] onFrame data: ${data.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`)
    process.send(data)
  
    match = data.match(/\n/)
    if (match) {
      //
    }
  
    match = data.match(/AINPT0{16}/)
    if (match) {
      //
    }
  }
} 

module.exports = {initWorker}

// class SimulatedDevice {
//   constructor(port) {
//     if (isNaN(port)) {
//       throw new TypeError(`SimulatedDevice(port): expected "port" to be a number, but got: [${typeof port}] ${port}`)
//     }
//     this.port = parseInt(port)
//     this.parser = new FrameParser('\n', onFrame)
//     console.log(`[${process.pid}] Worker starting on port ${port}`)
//     net.createServer(socket => {
//       socket.on('data', function(data) {
//         console.log(`[${process.pid}] Worker received: ${data.toString().replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`)
//         parser.push(data)
//       })
//     }).listen(port)
//   }
// }


class VirtualDevice {
  constructor() {
    this.text = ''
    this.r = 0
    this.g = 0
    this.b = 0
  }

  getText() {
    return this.text
  }

  setText(text) {
    this.text = ''
  }

  getRGB() {
    return [this.r, this.g, this.b]
  }

  setRGB(r, g, b) {
    this.r = r
    this.g = g
    this.b = b
  }
}