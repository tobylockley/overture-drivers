'use strict';

const CMD_DEFER_TIME = 2000;
const TICK_PERIOD = 5000;
const POLL_PERIOD = 5000;
const TCP_TIMEOUT = 30000;
const TCP_RECONNECT_DELAY = 1000;

let host
exports.init = _host => {
  host = _host
}

exports.createDevice = base => {
  const logger = base.logger || host.logger
  let config
  let tcpClient

  let frameParser = host.createFrameParser()
  frameParser.setSeparator('\r\n')
  frameParser.on('data', data => onFrame(data))


  const setup = _config => {
    config = _config
    base.setTickPeriod(TICK_PERIOD);
    base.setPoll({
      action: 'getSource',
      period: POLL_PERIOD,
      enablePollFn: () => { return base.getVar('Status').string === 'Connected'; },
      startImmediately: true
    });
  }

  const start = () => {
    initTcpClient();
  }

  const stop = () => {
    disconnect()
    if (tcpClient) {
      tcpClient.end();
      tcpClient = null;
    }
  }

  const setPower = params => {
    send(`!Power ${params.Status}\r`)
  }

  const joinHdmi = params => {
    var inp = base.getVar("Input");
    var out = base.getVar("Output");

    sendDefer("SET OUT" + params.Output + " VS IN" + params.Input + "\r\n");
  }


  const setOutput1 = params => {
    sendDefer("SET OUT1 VS IN" + params.Status + "\r\n");
  }

  const setOutput2 = params => {
    sendDefer("SET OUT2 VS IN" + params.Status + "\r\n");
  }



  const getSource = () => {
    sendDefer("GET OUT0 VS\r\n")
  }

  const initTcpClient = () => {
    if (!tcpClient) {
      tcpClient = host.createTCPClient();
      tcpClient.setOptions({
        receiveTimeout: TCP_TIMEOUT,
        autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
      })
      tcpClient.connect(config.port, config.host);

      tcpClient.on('connect', () => {
        logger.silly(`TCPClient connected`)
        base.getVar('Status').string = 'Connected'
        base.startPolling();
      })

      tcpClient.on('data', data => {
        data = data.toString()
        //logger.silly(`TCPClient data: ${data}`)
        //onFrame(data)
        frameParser.push(data)
      })

      tcpClient.on('close', () => {
        logger.silly(`TCPClient closed`)
        disconnect()
      })

      tcpClient.on('error', err => {
        logger.error(`TCPClient: ${err}`)
        stop();
      })
    }
  }

  const disconnect = () => {
    base.getVar('Status').string = 'Disconnected'
  }

  const send = data => {
    logger.silly(`TCPClient send: ${data}`)
    return tcpClient && tcpClient.write(data)
  }


  const onFrame = data => {

    logger.silly(`onFrame ${data}`)
    base.commandDone()

    //checks for IO change
    var command = data
    var check = command.replace(/[1-8]/g, "x")
    if (check == "OUTx VS INx\r\n") {

      var numbers = command.replace(/\D/g, '');

      //numbers[0] is the output, numbers[1] is input

      numbers = numbers.split("")
      logger.silly(numbers)

      if (numbers[0] == "1") {
        base.getVar("Output1").string = numbers[1]

      }
      else if (numbers[0] == "2") {
        base.getVar("Output").string = numbers[1]
      }

    }
  }

    const sendDefer = data => {
      base.commandDefer(CMD_DEFER_TIME);
      if (!send(data)) base.commandError(`Data not sent`);
    }

    function tick() {
      !tcpClient && initTcpClient();  // Attempt reconnection after an error
    }


    return {
      setup, start, stop,
      setPower, joinHdmi, getSource, setOutput2, setOutput1, tick
    }
  }
