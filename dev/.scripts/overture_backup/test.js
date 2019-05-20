var request = require('request');
var fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json'));

config.servers.forEach(server => {
  request.get(server.url + '/api/v2/backup', { 'auth': {'bearer': server.token} }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log('Test OK:', server.url)
    }
    else {
      console.error('Test failed:', server.url);
      error && console.error('Error:', error)
      response && console.error('Status Code:', response.statusCode);
      body && console.error('Body:', body);
      console.error();
    }
  });
})