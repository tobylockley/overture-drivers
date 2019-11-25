const cluster = require('cluster')
const NUM_THREADS = 2

if (cluster.isMaster) { // MASTER
  const express = require('express')
  const app = express()
  const port = 3000
  const server = app.listen(port, () => {
    console.log(`[${process.pid} M] Express app running on port ${port}!`)
  })
  const io = require('socket.io')(server)

  for (let i = 1; i <= NUM_THREADS; i++) {
    let worker = cluster.fork({
      SIM_PORT: port + i
    })

    worker.on('message', (msg) => {
      console.log(`[${process.pid} M] Message from worker (${worker.process.pid}): ${msg}`)
    })
  }

  cluster.on('exit', (worker, code) => {
    console.log(`[${worker.process.pid} W] Worker died with code ${code}`)
    for (let id in cluster.workers) {
      cluster.workers[id].kill() // Kill all workers
    }
    server.close() // Stop server
  })
  
  app.use(express.static('public'))
  app.use('/lib', [
    express.static(__dirname + '/node_modules/jquery/dist/')
  ])

  io.on('connection', (socket) => {
    // send all devices on connection, and if asked
    console.log(`[${process.pid} M] [${socket.id}] User connected`)
    socket.on('disconnect', () => {
      console.log(`[${process.pid} M] [${socket.id}] User disconnected`)
    })
    socket.on('test', (msg) => {
      console.log(`[${process.pid} M] [${socket.id}] Test: ${msg}`)
    })
    socket.emit('setText', {id:12345, text:'hello'})
  })
}

if (cluster.isWorker) { // WORKERS
  let port = parseInt(process.env['SIM_PORT'])
  require('./worker.js').initWorker(port)
}