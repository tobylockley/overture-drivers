const UX_URL = 'http://192.168.99.193'
let socket = require('socket.io-client')(`${UX_URL}/overtureapi`)

socket.on('connect', function() {
  console.log('connected')
  runTests()
})

socket.on('disconnect', function() {
  console.log('socket disconnect')
})

socket.on('overtureapi', function(data) {
  data.sequence == 123 && console.timeEnd('getpoints')
  console.log('-------------- OVERTUREAPI --------------')
  console.log(data)
  if (data.url == '/livepoints/connect' && data.statuscode == 200) doExtras()
})

console.log('GUI Creator')

async function runTests() {
  // await delay(2000);
  socket.emit('overtureapi', {
    verb: 'CMD',
    url: '/livepoints/connect',
    body: {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXljbG9ha0lkIjoiZmM1OTdiZjYtMDgzNi00NmU1LWIyZWUtMWVkYWY1ZmM0MmIzIiwiaWQiOiI1YmEyZTBmMzNiOWQ2NzAwMGVkMDk1ZTQiLCJuYW1lIjoiVG9ieSBMb2NrbGV5Iiwicm9sZXMiOlt7ImlkIjoic3lzdGVtIiwibmFtZSI6IlN5c3RlbSIsImFsdG5hbWUiOiJzeXN0ZW0iLCJzeXN0ZW0iOnRydWUsImhyY19hY2Nlc3NfcmlnaHRzIjoxMDAsImhyY19hbGFybXNfcmlnaHRzIjoxMDAsInJvbGVfaWQiOiJzeXN0ZW0ifV0sInVzZXJuYW1lIjoidG9ieSIsImlzTGRhcCI6ZmFsc2V9.P52DYFUuF-XmyADUAVthNOhoIAaeBAL8YrY60ys8H8w'
    }
  })

  // await delay(2000);
  // socket.emit('overtureapi', {
  //   verb: 'GET',
  //   url: '/points',
  //   body: {}
  // });

  // await delay(2000)
  // socket.emit('overtureapi', {
  //   verb: 'CMD',
  //   url: '/livepoints/subscribe',
  //   body: {
  //     points: [
  //       '5b6288c3a7c7f9000e30515b' // tobys room right sony sources
  //     ]
  //   }
  // })

  // await delay(2000)
  // console.time('getpoints')
  // socket.emit('overtureapi', {
  //   verb: 'GET',
  //   url: '/points',
  //   sequence: 123,
  //   body: {}
  // })
}


function doExtras() {
  socket.emit('overtureapi', {
    verb: 'GET',
    url: '/license',
    body: {}
  })
}

function apiCall(verb, url, body, callback) {
  // Emit socket message, then run callback on data received
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms)
  })
}
