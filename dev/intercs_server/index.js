const
  PORT = 22022,
  KEY = 'awtgZe5xy66NSHN7LxWu6ZZS',
  AUTH_TIMEOUT = 3000,
  server = require("http").createServer(),
  io = require('socket.io')(server);

io.on('connection', (client) => {
  console.info(`Client connected [id=${client.id}] ... awaiting authentication`);

  // Disconnect unless user authenticates within timeout
  let authTimer = setTimeout(() => {
    console.log(`Client [id=${client.id}] did not authenticate before timeout`);
    client.disconnect(false);
  }, AUTH_TIMEOUT);

  // After client is authenticated, register privileged events
  client.on('authentication', (data) => {
    if (data.key === KEY) {
      console.info(`Client [id=${client.id}] authenticated successfully`);
      // Authenticated, clear timeout and register privileged events
      clearTimeout(authTimer);
      // send to all OTHER clients
      client.broadcast.emit('broadcast', `New authenticated client joined! ID: ${client.id}`);

      client.on('update', (data) => {
        console.log(`[${client.id}] Broadcasting variable:`);
        console.log(data);
        client.broadcast.emit('update', data);
      });

      client.on('push', (data) => {
        console.log(`[${client.id}] Pushing variable to remote:`);
        console.log(data);
        client.broadcast.emit('push', data);
      });
    }
    else {
      console.log(`Authentication attempt FAILED (incorrect key) [id=${client.id}]`);
    }
  });

  client.on('disconnect', () => {
    console.info(`Disconnected client [id=${client.id}]`);
  });
});

server.listen(PORT);
console.info(`Socket server started, listening on port ${PORT}`);