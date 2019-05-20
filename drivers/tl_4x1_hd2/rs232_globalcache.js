

const TCP_TIMEOUT = 60000;
const TCP_RECONNECT_DELAY = 5000;

const TYPE = 'TCP';
const FRAME_SEPARATOR = '\r\n';

var tcpClient, host, base, config, logger;


module.exports = {
  TYPE: 'TCP',
  FRAME_SEPARATOR: '\r\n',

  init: function(_host, _base, _config, _logger) {
    host = _host;
    base = _base;
    config = _config;
    logger = _logger;

    if (!tcpClient) {
      tcpClient = host.createTCPClient();
      tcpClient.setOptions({
        receiveTimeout: TCP_TIMEOUT,
        autoReconnectionAttemptDelay: TCP_RECONNECT_DELAY
      });
      tcpClient.connect({host: config.host, port: config.port});

      tcpClient.on('connect', () => {
        logger.silly(`tcpClient connected`);
        base.getVar('Status').string = 'Connected';
        base.startPolling();
      })

      tcpClient.on('data', data => {
        frameParser.push(data.toString());
      })

      tcpClient.on('close', () => {
        logger.silly(`commsClient closed`);
        base.getVar('Status').string = 'Disconnected';
      })

      tcpClient.on('error', err => {
        logger.error(`commsClient: ${err}`);
        stop();
      })
    }
  },

  send: function(data) {
    return tcpClient && tcpClient.write(data);
  },

  sendDefer: function(data) {

  },

  onFrame: function(data) {

  },


}