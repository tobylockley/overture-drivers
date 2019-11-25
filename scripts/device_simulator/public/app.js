const socket = io()

socket.on('setText', data => {
  // process setText
  console.log('setText event:', data)
})

socket.on('setRGB', data => {
  // process setRGB
})