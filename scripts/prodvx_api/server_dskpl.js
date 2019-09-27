const GREEN_PATH = '/sys/class/leds/led-front-green/brightness'
const RED_PATH = '/sys/class/leds/led-front-red/brightness'
const SERVER_PORT = 5000

const fs = require('fs')
const net = require('net')
const exec = require('child_process').exec


//------------------------------------------------------------------------------ SET FUNCTION
function setLed(path, val) {
  // Check inputs
  if (typeof val !== 'number') throw new TypeError('Val must be a number')
  let valStr = (val > 0) ? '255' : '0'
  exec(`bash -c "echo ${valStr} > ${path}"`)
}


//------------------------------------------------------------------------------ GET FUNCTION
function getLed(path) {
  let val = parseInt(fs.readFileSync(path))
  val = (val > 0) ? '1' : '0'
  return val
}


//------------------------------------------------------------------------------ TCP SERVER FUNCTIONS
let server = net.createServer(onConnection).listen(SERVER_PORT, () => {
  console.log(`Server listening on port ${server.address().port}`)
})

function onConnection(socket) {
  socket.name = socket.remoteAddress + ':' + socket.remotePort
  console.log(socket.name, '> CONNECTED')
  socket.on('data', data => onData(socket, data))
  socket.on('end', () => console.log(socket.name, '> DISCONNECTED') )
}

function onData(socket, data) {
  data = data.toString()
  console.log(socket.name, '>', data.replace('\n', '\\n').replace('\r', '\\r'))

  let match
  try {
    if ((match = data.match(/set (.*?) (\d)[\r\n]/i))) {
      // SET COMMAND
      let cmd = match[1].toLowerCase()
      let val = parseInt(match[2])
      if (cmd === 'green') {
        setLed(GREEN_PATH, val)
      }
      else if (cmd === 'red') {
        setLed(RED_PATH, val)
      }
      else {
        logError(socket, 'Invalid SET command')
      }
    }
    else if ((match = data.match(/get (.*?)[\r\n]/i))) {
      // GET COMMAND
      let cmd = match[1].toLowerCase()
      if (cmd === 'green') {
        send(socket, getLed(GREEN_PATH))
      }
      else if (cmd === 'red') {
        send(socket, getLed(RED_PATH))
      }
      else {
        logError(socket, 'Invalid GET command')
      }
    }
    else {
      logError(socket, 'Unrecognized command')
    }
  }
  catch (err) {
    logError(socket, err.message)
  }
}

function send(socket, data) {
  socket.write(Buffer.concat([Buffer.from(data), Buffer.from('\n')]))
}

function logError(socket, message) {
  socket.write(`ERROR: ${message}\n`)
  console.error(message)
}
