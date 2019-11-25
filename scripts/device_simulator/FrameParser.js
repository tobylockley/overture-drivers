const BUF_MAX = 2**20 // About 1MB

class FrameParser {
  constructor(separator, onFrame) {
    if (typeof onFrame !== 'function') {
      throw new TypeError(`FrameParser(separator, onFrame): expected "onFrame" to be function, but got: [${typeof onFrame}] ${onFrame}`)
    }
    if (!(typeof separator === 'string' || separator instanceof String)) {
      throw new TypeError(`FrameParser(separator, onFrame): expected "separator" to be string, but got: [${typeof separator}] ${separator}`)
    }
    this.separator = separator
    this.onFrame = onFrame
    this.buffer = ''
  }

  push(data) {
    data = data.toString()
    if (data.includes(this.separator)) {
      let sliceIndex = data.indexOf(this.separator) + this.separator.length
      let chunk = data.slice(0, sliceIndex)
      setImmediate(this.onFrame, this.buffer + chunk) // Call asyncronously
      this.buffer = '' // Clear buffer, then push rest of data
      this.push(data.slice(sliceIndex))
    }
    else {
      this.buffer = this.buffer + data
      let trimCount = this.buffer.length - BUF_MAX // trim anything over BUF_MAX
      if (trimCount > 0) this.buffer = this.buffer.slice(trimCount)
    }
  }
}

module.exports = FrameParser