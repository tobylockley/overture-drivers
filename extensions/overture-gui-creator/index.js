let socket = require('socket.io-client')('http://localhost:8000/overtureapi');

socket.on('connect', function() {
  console.log('connected');
  runTests();
});

socket.on('disconnect', function() {
  console.log('socket disconnect');
});

socket.on('overtureapi', function(data) {
  data.sequence == 123 && console.timeEnd('getpoints');
  console.log('-------------- OVERTUREAPI --------------');
  console.log(data);
});

console.log('GUI Creator');

async function runTests() {
  // await delay(2000);
  socket.emit('overtureapi', {
    verb: 'CMD',
    url: '/livepoints/connect',
    body: {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXljbG9ha0lkIjoiODRjMzBmODctNDkxMy00ZDI3LTlhYjEtM2E1NWFiYzY3NDQzIiwiaWQiOiI1N2I3NTkxYWI0MWY1OTcwOGY3YTFiMTEiLCJuYW1lIjoibWVkaWFsb24iLCJyb2xlcyI6W3siaWQiOiJzeXN0ZW0iLCJuYW1lIjoiU3lzdGVtIiwiYWx0bmFtZSI6InN5c3RlbSIsInN5c3RlbSI6dHJ1ZSwiaHJjX2FjY2Vzc19yaWdodHMiOjEwMCwiaHJjX2FsYXJtc19yaWdodHMiOjEwMCwicm9sZV9pZCI6InN5c3RlbSJ9XSwidXNlcm5hbWUiOiJtZWRpYWxvbiIsImlzTGRhcCI6ZmFsc2V9.UGnaitRFRRM_uD_1tXgXIxJXwzDKTn8uukTuUvi8Ies'
    }
  });

  // await delay(2000);
  // socket.emit('overtureapi', {
  //   verb: 'GET',
  //   url: '/points',
  //   body: {}
  // });

  await delay(2000);
  socket.emit('overtureapi', {
    verb: 'CMD',
    url: '/livepoints/subscribe',
    body: {
      points: [
        '5b6288c3a7c7f9000e30515b' // tobys room right sony sources
      ]
    }
  });

  // await delay(2000);
  // console.time('getpoints');
  // socket.emit('overtureapi', {
  //   verb: 'GET',
  //   url: '/points',
  //   sequence: 123,
  //   body: {}
  // });
}

function apiCall(verb, url, body, callback) {
  // Emit socket message, then run callback on data received
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
}
