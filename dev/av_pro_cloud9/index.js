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

    base.setTickPeriod(5000)

    const setup = _config => {
        config = _config
        let inputs = 10
        let outputs = 9

        for (let i = 1; i <= outputs; i++) {
            base.createVariable({
              name: `OUT${i}`,
              type: "enum",
              enums: ["IN1", "IN2", "IN3", "IN4", "IN5", "IN6", "IN7", "IN8", "IN9", "MV"],
              perform: {
                action: 'Set Output',
                params: {
                  Output: i,
                  Input: '$string'
                }
              }
            })
        }
    }

    const start = () => {
        initTcpClient()
        tcpClient.connect(config.port, config.host)
    }

    const stop = () => {
        disconnect()
    }

    const initTcpClient = () => {
        if (!tcpClient) {
            tcpClient = host.createTCPClient()

            tcpClient.on('connect', () => {
                logger.silly('TCPClient connected')
                base.getVar('Status').string = 'Connected'
            })

            tcpClient.on('data', data => {
                data = data.toString()
                //logger.silly(`TCPClient data: ${data}`)
                frameParser.push(data)
            })

            tcpClient.on('close', () => {
                logger.silly('TCPClient closed')
                disconnect()
            })

            tcpClient.on('error', err => {
                logger.error(`TCPClient: ${err}`)
                disconnect()
            })
        }
    }

    const disconnect = () => {
        base.getVar('Status').string = 'Disconnected'
        tcpClient && tcpClient.end()
    }

    const sendDefer = data => {
      if (send(data)) {
        base.commandDefer(1000)
      } else {
        base.commandError(`Data not sent`)
      }
    }

    const send = data => {
        logger.silly(`TCPClient send: ${data}`)
        return tcpClient && tcpClient.write(data)
    }

    const onFrame = data => {
        logger.silly(`onFrame ${data}`);
        
        let match = data.match(/OUT(\d+).*IN(\d+)/i);
        if (match) {
            let input = parseInt(match[2]);
            base.getVar('OUT' + match[1]).string = (input === 10) ? 'MV' : `IN${input}`;
        }

        match = data.match(/MVW MODE(\d+)/i);
        if (match) {
            let mode = parseInt(match[1]);
            base.getVar('MVMode').string =  (mode === 0) ? '3x3' : '4x4';
        }

        base.commandDone();
    }

    const getOutput = params => {
        let match = params.Output.match(/Out(\d)/i);
        if (match) {
            input = parseInt(match[1]);
        }
        else if (params.Input.match(/MV/i)) {
            input = 10;
        }
        logger.debug('Connecting Input ' + input + ' to Output ' + params.Output);
        sendDefer('SET OUT' + params.Output + ' VS IN' + input + '\r\n');
    }

    const setOutput = params => {
        let match = params.Input.match(/IN(\d)/i);
        let input;
        if (match) {
            input = parseInt(match[1]);
        }
        else if (params.Input.match(/MV/i)) {
            input = 10;
        }
        logger.debug('Connecting Input ' + input + ' to Output ' + params.Output);
        sendDefer('SET OUT' + params.Output + ' VS IN' + input + '\r\n');
    }

    const setMultiview = params => {
        let x;  // Store multiview mode here
        if (params.Name === '3x3') {
            x = 0;
        }
        else if (params.Name === '4x4') {
            x = 1;
        }
        logger.debug('Setting multiview mode to ' + params.Name);
        sendDefer('SET MVW MODE' + x + '\r\n');
    }

    return {
        setup, start, stop,
        getOutput, setOutput, setMultiview
    }
}


