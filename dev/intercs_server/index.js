const
  PORT = 22022,
  KEY = 'awtgZe5xy66NSHN7LxWu6ZZS',
  AUTH_TIMEOUT = 3000,
  server = require("http").createServer(),
  io = require('socket.io')(server);

let myClients = [];

io.on('connection', (client) => {
  let thisClient = {};  // Store info once authenticated
  console.info(`[id = ${client.id}] Client connected, awaiting authentication...`);

  // Disconnect unless user authenticates within timeout
  let authTimer = setTimeout(() => {
    console.log(`[id = ${client.id}] Client did not authenticate before timeout`);
    client.disconnect(false);
  }, AUTH_TIMEOUT);

  // After client is authenticated, register privileged events
  client.on('authentication', (data) => {
    // Make sure all required values were sent
    let valid = data.hasOwnProperty('key') && data.hasOwnProperty('csRef');
    if (!valid) {
      console.log(`[id = ${client.id}] Authentication failed (unexpected data properties)`);
      return;
    }

    // Make sure key matches
    if (data.key !== KEY) {
      console.log(`[id = ${client.id}] Authentication failed (incorrect key)`);
      return;
    }

    // Save information about this client
    thisClient.id = client.id;
    thisClient.csRef = data.csRef;
    thisClient.timestamp = new Date();  // To show uptime (not yet implemented)

    // Make sure we don't already have a client with same control server reference
    if (myClients.filter(x => x.csRef === data.csRef).length > 0) {
      console.log(`[id = ${client.id}] Authentication failed (client reference [${data.csRef}] already exists)`);
      return;
    }

    // Authenticated, clear timeout and register privileged events
    clearTimeout(authTimer);

    // Log info about the client
    console.info(`[id = ${client.id}] Control server [${data.csRef}] authenticated`);
    myClients.push(thisClient);

    // send to all OTHER clients
    client.broadcast.emit('broadcast', `New authenticated client joined! ID: ${client.id}`);

    // Register events
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
  });

  client.on('disconnect', () => {
    console.info(`[id = ${client.id}] Disconnected`);
    let index = myClients.indexOf(thisClient);
    if (index > -1) myClients.splice(index, 1);  // Remove entry from the array
  });
});

server.listen(PORT);
console.info(`Socket server started, listening on port ${PORT}`);