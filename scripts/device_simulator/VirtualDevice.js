class VirtualDevice {
  constructor() {
    this._text = `Virtual Device running on process ${process.pid}`
    this._r = 0
    this._g = 0
    this._b = 0
  }

  // GETTERS
  get text() {
    return this._text
  }

  get r() {
    return this._r
  }

  get g() {
    return this._g
  }

  get b() {
    return this._b
  }

  get rgb() {
    return {
      r: this._r,
      g: this._g,
      b: this._b
    }
  }

  // SETTERS
  set text(val) {
    if (isString(val)) this._text = val.toString().trim()
    else throw new TypeError(`Input must be a string (${val})`)
  }

  set r(val) {
    if (is8bit(val)) this._r = parseInt(val)
    else throw new RangeError(`Cannot parse input (${val}) to 8-bit value (0-255)`)
  }

  set g(val) {
    if (is8bit(val)) this._g = parseInt(val)
    else throw new RangeError(`Cannot parse input (${val}) to 8-bit value (0-255)`)
  }

  set b(val) {
    if (is8bit(val)) this._b = parseInt(val)
    else throw new RangeError(`Cannot parse input (${val}) to 8-bit value (0-255)`)
  }
}

// HELPER FUNCTIONS
function isString(x) {
  return (typeof x === 'string' || x instanceof String)
}

function is8bit(x) {
  let parsed = parseInt(x)
  return (parsed >= 0 && parsed <= 255)
}

module.exports = VirtualDevice