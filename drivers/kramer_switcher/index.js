'use strict'

const CMD_DEFER_TIME = 5000
const POLL_PERIOD = 5000
const TICK_PERIOD = 5000
const TCP_TIMEOUT = 30000
const TCP_RECONNECT_DELAY = 1000

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  let frameParser = host.createFrameParser()
  frameParser.on('data', data => onFrame(data))


  // ------------------------------ SETUP FUNCTIONS ------------------------------

  function setup(_config) {
    config = _config
    base.setTickPeriod(TICK_PERIOD)

    let msgEnd = (128 + config.machineNumber).toString(16)  // See manual, pg 22
    frameParser.setSeparator(msgEnd)

    let sources = ['None', 'Input1', 'Input2']
    let num_outputs
    if (config.model === 'VM-28H') num_outputs = 8
    else if (config.model === 'VM-216H') num_outputs = 16

    // Create variables for each output and set up polling
    for (let i = 1; i <= num_outputs; i++) {
      base.createVariable({
        name: `Sources_Output${i}`,
        type: 'enum',
        enums: sources,
        perform: {
          action: 'selectSource',
          params: {
            Channel: i,
            Name: '$value'
          }
        }
      })

      base.setPoll({
        action: 'getSource',
        period: POLL_PERIOD,
        enablePollFn: () => { return base.getVar('Status').string === 'Connected'; },
        startImmediately: true,
        params: {
          Channel: i
        }
      })
    }
  }

  function start() {
    initTcpClient()
  }

  function stop() {
    base.getVar('Status').string = 'Disconnected'
    if (tcpClient) {
      tcpClient.end()
      tcpClient = null
    }
  }

  function tick() {
    !tcpClient && initTcpClient()  // Attempt reconnection after an error
  }


  // ------------------------------ SEND/RECEIVE HANDLERS ------------------------------

  function initTcpClient() {
    if (!tcpClient) {
      tcpClient = host.createTCPClient()
      tcpClient.setOptions({
        receiveTimeout: TCP_TIMEOUT,
        autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
      })
      tcpClient.connect(config.port, config.host)

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
        base.startPolling()
      })

      tcpClient.on('data', data => {
        frameParser.push(data.toString('hex'))
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`)
        base.getVar('Status').string = 'Disconnected'
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`)
        stop()  // Disconnect and also throw out the tcpClient instance
      })
    }
  }

  function send(data) {
    if (data instanceof Buffer) {
      let logdata = data.toString('hex').match(/.{1,2}/g).join(' ')
      logger.silly(`TCPClient Hex send: ${logdata}`)
    }
    else {
      logger.silly(`TCPClient send: ${data}`)
    }
    return tcpClient && tcpClient.write(data)
  }

  function sendDefer(data) {
    base.commandDefer(CMD_DEFER_TIME)
    if (!send(data)) base.commandError(`Data not sent`)
  }

  function onFrame(data) {
    const pendingCommand = base.getPendingCommand();
    if (data.length !== 8) {
      base.commandError(`Received frame unexpected length (${data.length}): ${data}`)
    }
    else {
      let bytes = data.match(/.{1,2}/g)
      logger.silly(`onFrame: ${bytes.join(' ')}`);
      pendingCommand && logger.silly(`pendingCommand: ${pendingCommand.action}`);

      bytes = bytes.map(x => parseInt(x, 16))
      let destination = (bytes[0] >> 6) & 1  // Get only the 6th bit, should be 1 for switcher -> PC
      let instruction = bytes[0] & 0b111111  // bitmask lowest 6 bits, switch video = 1
      let input = bytes[1] & 0b1111111  // bitmask lowest 7 bits
      let output = bytes[2] & 0b1111111  // bitmask lowest 7 bits
      let machineNumber = bytes[3] & 0b11111  // bitmask lowest 5 bits

      if (machineNumber === config.machineNumber && destination === 1) {
        // 1 = Video was switched
        // 5 = video status request
        if (instruction === 1 || instruction === 5) {
          base.getVar(`Sources_Output${output}`).value = input  // 0 = 'None' (disconnected)
          base.commandDone();
        }
      }
    }
  }


  // ------------------------------ GET/SET FUNCTIONS ------------------------------

  function selectSource(params) {
    let bytes = [
      0x01,  // Instruction, 1 = Switch video
      0x80 + parseInt(params.Name),
      0x80 + params.Channel,
      0x80 + config.machineNumber
    ]
    sendDefer(Buffer.from(bytes))
  }

  function getSource(params) {
    let bytes = [
      0x05,  // Instruction, 5 = Request video status
      0x80,
      0x80 + params.Channel,
      0x80 + config.machineNumber
    ]
    sendDefer(Buffer.from(bytes))
  }


  return {
    setup, start, stop, tick,
    selectSource, getSource
  }
}