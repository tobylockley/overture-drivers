const socket = io()

socket.on('devices', data => {
  // data = [PID1, PID2, ...]
  console.log('Devices from server:', data)
  $('#device-container').empty()
  for (let id of data) {
    $('#device-container').append(`<div id="${id}" class="device"><p class="text"></p></div>`)
  }
})

socket.on('update', data => {
  // data = {
  //   id: process.pid,
  //   text: device.text,
  //   r: device.r,
  //   g: device.g,
  //   b: device.b
  // }
  console.log('Update from server:', data)
  $(`#${data.id}`).find('.text').text(data.text)
  $(`#${data.id}`).css('background', `rgb(${data.r}, ${data.g}, ${data.b})`)
  // Set text color based on BG color
  if (Math.max(data.r, data.g, data.b) < 128) {
    $(`#${data.id}`).css('color', 'white')
  }
  else {
    $(`#${data.id}`).css('color', 'black')
  }
})

socket.on('disconnect', reason => {
  console.log('Socket disconnected:', reason)
  $('#error-container').css('visibility', 'visible')
})

socket.on('connect', () => {
  console.log('Socket connected')
  $('#error-container').css('visibility', 'hidden')
})