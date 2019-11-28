// add timestamps in front of log messages
require('console-stamp')(console, {
  pattern: 'HH:MM:ss.l',
  colors: {
    stamp: 'yellow',
    label: 'green'
  }
})

const cluster = require('cluster')
const path = require('path')
const express = require('express')
const favicon = require('serve-favicon')

function showUsageThenExit() {
  console.log(`Usage: ${path.basename(process.argv[0])} ${path.basename(process.argv[1])} WORKERS,`)
  console.log('where WORKERS = number of workers (virtual devices) to spawn')
  process.exit()
}
if (process.argv.length !== 3) showUsageThenExit()
let num_workers = parseInt(process.argv[2])
if (num_workers <= 0) showUsageThenExit()

// MASTER
if (cluster.isMaster) {
  const app = express()
  const APP_PORT = 3000
  const server = app.listen(APP_PORT, () => {
    console.log(`[${process.pid} M] Express app running at http://localhost:${APP_PORT}`)
  })
  const io = require('socket.io')(server)
  
  app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
  app.use(express.static('public'))
  app.use('/lib', [
    express.static(__dirname + '/node_modules/jquery/dist/')
  ])

  // Send device IDs and state on connection
  io.on('connection', (socket) => {
    console.log(`[${process.pid} M] [${socket.id}] Socket connected`)
    socket.on('disconnect', () => {
      console.log(`[${process.pid} M] [${socket.id}] Socket disconnected`)
    })
    let workers = Object.values(cluster.workers)
    socket.emit('devices', workers.map(x => x.process.pid))
    for(let worker of workers) {
      worker.send('getStatus')  // Triggers each worker to send their current device values
    }
  })

  // Fork workers
  for (let i = 1; i <= num_workers; i++) {
    cluster.fork({ PORT: APP_PORT + i })
  }

  // Handle messages from workers
  cluster.on('message', (worker, msg) => {
    console.log(`[${process.pid} M] Message from worker (${worker.process.pid}): ${JSON.stringify(msg)}`)
    io.emit('update', msg) // Send update to all sockets
  })

  // Handle cluster exit, kill all workers and stop server
  cluster.on('exit', (worker, code) => {
    console.log(`[${worker.process.pid} W] Worker died with code ${code}`)
    for (let id in cluster.workers) {
      cluster.workers[id].kill()
    }
    server.close()
  })
}

// WORKERS
if (cluster.isWorker) {
  require('./worker.js').initWorker(process.env.PORT)
}