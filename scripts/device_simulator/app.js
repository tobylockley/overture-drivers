const cluster = require('cluster')
const net = require('net')
const numCPUs = require('os').cpus().length
const BUF_MAX = 2**20 // About 1MB

if (cluster.isMaster) {
  console.log(`[${process.pid}] Master is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({
      SIM_PORT: 5000 + i
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[${process.pid}] Worker died`);
  });
} else {
  let port = parseInt(process.env['SIM_PORT'])
  console.log(`[${process.pid}] Worker starting on port ${port}`);
  net.createServer(socket => {
    socket.on('data', function(data) {
      console.log(`[${process.pid}] Echoing: ${data}`)
      socket.write(data)
    })
  }).listen(port)
}

class frameParser {
  constructor(separator, onFrame) {
    this.separator = separator
    this.onFrame = onFrame
    this.buffer = ''
  }

  push(data) {
    data = data.toString()
    if (data.includes(this.separator)) {
      // Only add up to and including separator to buffer
      // call onFrame with data
      // Add rest of data to fresh buffer
    }
    else {
      this.buffer = this.buffer + data.toString()
      // trim anything over BUF_MAX
      let trimCount = this.buffer.length - BUF_MAX
      if (trimCount > 0) this.buffer = this.buffer.slice(trimCount)
    }
  }
}