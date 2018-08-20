
  var timerSource
  const selectSource = params => {
    send(Buffer.from(commands[params.Name]))
    clearTimeout(timerSource)
    timerSource = setTimeout(getSource, 1000)
  }