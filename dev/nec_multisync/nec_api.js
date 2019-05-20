
var messageType = {
  Command: 'A',
  CommandReply: 'B',
  Get: 'C',
  GetReply: 'D',
  Set: 'E',
  SetReply: 'F'
}

function getHeader(monitor_id, message_type) {
  let id = String.fromCharCode(0x40 + monitor_id);  // Convert monitor hex code to string
  var header_string = `0${id}0${message_type}06`  // Need better handling of message length
  var header = [0x01].concat(Array.from(header_string).map(ch => ch.charCodeAt(0)))  // Convert string into array of char values
  return Buffer.from(header)
}

Buffer.prototype.checksum = function() {
  // Get checksum of all bytes except 1st
  let sum = 0;
  let temp = this.slice(1);  // Get everything except first element
  temp.forEach(val => {
    sum = sum ^ val;
  });
  return sum;
}

function getChecksum(data) {
  if (Buffer.isBuffer(data)) {
    return data.checksum();
  }
  else {
    throw new TypeError('data must be a buffer')
  }
}

module.exports = {
  messageType,
  getHeader,
  getChecksum
}