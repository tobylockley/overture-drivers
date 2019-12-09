const EventEmitter = require('events')
const BUF_MAX = 2**20 // About 1MB

class FrameParser extends EventEmitter {
  constructor(separator) {
    super()
    if (!(typeof separator === 'string' || separator instanceof String)) {
      throw new TypeError(`FrameParser(separator, onFrame): expected "separator" to be string, but got: [${typeof separator}] ${separator}`)
    }
    this.separator = separator
    this.buffer = ''
  }

  push(data) {
    data = data.toString()
    if (data.includes(this.separator)) {
      let sliceIndex = data.indexOf(this.separator) + this.separator.length
      let chunk = data.slice(0, sliceIndex)
      this.emit('data', this.buffer + chunk) // Trigger data event
      this.buffer = '' // Clear buffer
      this.push(data.slice(sliceIndex)) // Push leftover data into buffer
    }
    else {
      this.buffer = this.buffer + data
      let trimCount = this.buffer.length - BUF_MAX // trim anything over BUF_MAX
      if (trimCount > 0) this.buffer = this.buffer.slice(trimCount)
    }
  }
}

module.exports = FrameParser