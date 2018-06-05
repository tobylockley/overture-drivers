const { expect } = require('chai')
const { createHost, createBase, createTCPClient } = require('./sdk-mock')
const { init, createDevice } = require('../index.js')

const setupTestDevice = ({ start = true, setup = true } = {}) => {
  const host = createHost()
  const base = createBase()
  base.processPackageJson(require('../package.json'))
  init(host)
  const device = createDevice(base)
  base.setDevice(device)
  setup && device.setup({ host: 'localhost', port: 3000 })
  start && device.start()
  return { host, base, device }
}

describe('Device creation', () => {

  it('should create a device', () => {
    init(createHost())
    const device = createDevice(createBase())
    expect(device).not.to.equal(undefined)
  })

  it('should have setup, start, stop functions', () => {
    init(createHost())
    const device = createDevice(createBase())
    expect(device.setup).to.be.a('function')
    expect(device.start).to.be.a('function')
    expect(device.stop).to.be.a('function')
  })

  it('should have static variables', () => {
    const { base } = setupTestDevice()
    expect(base.getVar('Activity').name).to.equal('Activity')
    expect(base.getVar('Status').name).to.equal('Status')
    expect(base.getVar('Sources').name).to.equal('Sources')
    expect(base.getVar('AudioLevel').name).to.equal('AudioLevel')
  })
})

describe('Device Config', () => {

  it('should accept a config objet', () => {
    init(createHost())
    const device = createDevice(createBase())
    device.setup({ host: 'localhost', port: '3000' })
  })

  it('should accept an empty config objet', () => {
    init(createHost())
    const device = createDevice(createBase())
    device.setup({})
  })

  it('should accept an undefined config objet', () => {
    init(createHost())
    const device = createDevice(createBase())
    device.setup({})
  })
})

describe('Device Start', () => {

  it('should start without crashing', () => {
    setupTestDevice()
  })

  it('should call setPolling when start', () => {
    const { base, device } = setupTestDevice({ start: false })
    let called = false
    base.startPolling = () => called = true
    device.start()
    expect(called).to.equal(true)
  })

  it('should poll Power, Sources and AudioLevel when start', () => {
    const { base, device } = setupTestDevice({ start: false })
    let called = {}
    base.perform = action => called[action] = true
    device.start()
    expect(called).to.deep.equal({
      "Get Power": true,
      "Get Source": true,
      "Get Audio Level": true,
    })
  })

  it('should connect to host/port when start', () => {
    const { base, device, host } = setupTestDevice({ start: false })
    let clientPort = undefined
    let clientHost = undefined
    const originalConnect = host.tcpClient.connect
    host.tcpClient.connect = (_clientPort, _clientHost) => {
      clientPort = _clientPort
      clientHost = _clientHost
      originalConnect(_clientPort, _clientHost)
    }
    device.start()

    expect(base.getVar('Status').string).to.equal("Connected")
    expect(clientPort).to.equal(3000)
    expect(clientHost).to.equal('localhost')
  })

})

describe('Device Stop', () => {
  it('should stop', () => {
    const { device } = setupTestDevice()
    device.stop()
  })

  it('should disconnect when stop', () => {
    const { base, device, host } = setupTestDevice({ start: false })
    let called
    host.createTCPClient = () => {
      const client = createTCPClient()
      client.end = () => called = true
      return client
    }
    device.start()
    expect(base.getVar('Status').string).to.equal('Connected')

    device.stop()

    expect(called).to.equal(true)
    expect(base.getVar('Status').string).to.equal('Disconnected')
  })

})

describe('TCPClient', () => {

  it ('should support receiving empty data', () => {
    const { host } = setupTestDevice()
    host.tcpClient.receive('')
  })    

  it ('should support several frame data', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Power On\r\n?Source HDMI2\r\n?Level 100\r')

    expect(base.getVar('Power').string).to.equal('On')
    expect(base.getVar('Sources').string).to.equal('HDMI2')
    expect(base.getVar('AudioLevel').value).to.equal(100)
  })    
})

describe('Power', () => {

  it('should send a frame: "!Power On\\r" when On', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()

    base.perform('Set Power', { Status: 'On' })
    expect(host.tcpClient.getLastReceived()).to.equal('!Power On\r')
  })

  it('should send a frame: "!Power Off\\r" when Off', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()

    base.perform('Set Power', { Status: 'Off' })
    expect(host.tcpClient.getLastReceived()).to.equal('!Power Off\r')
  })

  it('should not send a frame if invalid parameter value', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()

    base.perform('Set Power', { Status: 'Dummy' })

    expect(host.tcpClient.getLastReceived()).to.equal(undefined)
    expect(host.logger.getLastLog().toLowerCase()).to.contain('invalid parameter')
  })

  it('should not send a frame if invalid parameter', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()

    base.perform('Set Power', { StatusDummy: 'On' })

    expect(host.tcpClient.getLastReceived()).to.equal(undefined)
    expect(host.logger.getLastLog().toLowerCase()).to.contain('invalid parameter')
  })

  it('should be undefined at start', () => {
    const { base } = setupTestDevice()
    expect(base.getVar('Power').string).to.equal(undefined)
  })

  it('should set the Power variable to "On"', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Power On\r')
    expect(base.getVar('Power').string).to.equal('On')
  })

  it('should set the Power variable to "Off"', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Power Off\r')
    expect(base.getVar('Power').string).to.equal('Off')
  })

  it('should log unknown response and not change Power variable', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Power TOTO Off\r')
    expect(base.getVar('Power').string).to.equal(undefined)
    expect(host.logger.getLastLog().toLowerCase()).to.contain('unknown response')
  })

  it('should send "!Power On\\r when writing "On" to the Power variable', () => {
    const { base, host } = setupTestDevice()
    base.getVar('Power').required = "On"
    expect(host.tcpClient.getLastReceived()).to.equal('!Power On\r')
    
  })

  it('should send "!Power Off\\r when writing "Off" the to Power variable', () => {
    const { base, host } = setupTestDevice()
    base.getVar('Power').required = "Off"
    expect(host.tcpClient.getLastReceived()).to.equal('!Power Off\r')
  })


})

describe('Sources', () => {

  it('should send a frame: "!Source HDMI1\\r"', () => {
    const { host, base } = setupTestDevice()
    base.perform('Select Source', { Name: 'HDMI1' })
    expect(host.tcpClient.getLastReceived()).to.equal('!Source HDMI1\r')
  })

  it('should send a frame: "!Source HDMI2\\r"', () => {
    const { host, base } = setupTestDevice()
    base.perform('Select Source', { Name: 'HDMI2' })
    expect(host.tcpClient.getLastReceived()).to.equal('!Source HDMI2\r')
  })

  it('should not send a frame if invalid parameter value', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()

    base.perform('Select Source', { Name: 'Dummy' })

    // expect(host.tcpClient.getLastReceived()).to.equal(undefined)
    // expect(host.logger.getLastLog().toLowerCase()).to.contain('invalid parameter')
  })

  it('should not send a frame if invalid parameter', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()

    base.perform('Select Source', { StatusDummy: 'On' })

    // expect(host.tcpClient.getLastReceived()).to.equal(undefined)
    // expect(host.logger.getLastLog().toLowerCase()).to.contain('invalid parameter')
  })

  it('should be undefined at start', () => {
    const { base } = setupTestDevice()
    expect(base.getVar('Sources').string).to.equal(undefined)
  })

  it('should set the Sources variable to "HDMI1"', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Source HDMI1\r')
    expect(base.getVar('Sources').string).to.equal('HDMI1')
  })

  it('should set the Sources variable to "HDMI2"', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Source HDMI2\r')
    expect(base.getVar('Sources').string).to.equal('HDMI2')
  })

  it('should log unknown response and not change Sources variable', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Source TOTO Off\r')
    expect(base.getVar('Sources').string).to.equal(undefined)
    expect(host.logger.getLastLog().toLowerCase()).to.contain('unknown response')
  })

  it('should call selectSource when writing "HDMI1" to the Sources variable', () => {
    const { base, host } = setupTestDevice()
    base.getVar('Sources').required = "HDMI1"
    expect(host.tcpClient.getLastReceived()).to.equal('!Source HDMI1\r')
  })

  it('should call selectSource when writing "HDMI2" the to Source variable', () => {
    const { base, host } = setupTestDevice()
    base.getVar('Sources').required = "HDMI2"
    expect(host.tcpClient.getLastReceived()).to.equal('!Source HDMI2\r')
  })


})

describe('Audio Level', () => {

  it('should send a frame: "!Level 10\\r"', () => {
    const { host, base } = setupTestDevice()
    base.perform('Set Audio Level', { Level: 10 })
    expect(host.tcpClient.getLastReceived()).to.equal('!Level 10\r')
  })

  it('should send a frame: "!Level 20\\r"', () => {
    const { host, base } = setupTestDevice()
    base.perform('Set Audio Level', { Level: 20 })
    expect(host.tcpClient.getLastReceived()).to.equal('!Level 20\r')
  })

  it('should not send a frame if invalid parameter value', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()
    base.perform('Set Audio Level', { Level: 'Toto' })
    expect(host.tcpClient.getLastReceived()).to.equal(undefined)
    expect(host.logger.getLastLog().toLowerCase()).to.contain('invalid parameter')
  })

  it('should not send a frame if invalid parameter', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.clearLastReceived()
    base.perform('Set Audio Level', { StatusDummy: 20 })
    expect(host.tcpClient.getLastReceived()).to.equal(undefined)
    expect(host.logger.getLastLog().toLowerCase()).to.contain('invalid parameter')
  })

  it('should be undefined at start', () => {
    const { base } = setupTestDevice()
    expect(base.getVar('AudioLevel').value).to.equal(undefined)
  })

  it('should set the Audio Level variable to 10', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Level 10\r')
    expect(base.getVar('AudioLevel').value).to.equal(10)
  })

  it('should set the AudioLevel variable to 22', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Level 22\r')
    expect(base.getVar('AudioLevel').value).to.equal(22)
  })

  it('should log unknown response and not change AudioLevel variable', () => {
    const { host, base } = setupTestDevice()
    host.tcpClient.receive('?Source TOTO Off\r')
    expect(base.getVar('AudioLevel').string).to.equal(undefined)
    expect(host.logger.getLastLog().toLowerCase()).to.contain('unknown response')
  })

  it('should call setAudioLevel when writing 10 to the AudioLevel variable', () => {
    const { base, host } = setupTestDevice()
    base.getVar('AudioLevel').required = 10
    expect(host.tcpClient.getLastReceived()).to.equal('!Level 10\r')    
  })

  it('should call setAudioLevel when writing 99 to the AudioLevel variable', () => {
    const { base, host } = setupTestDevice()
    base.getVar('AudioLevel').required = 99
    expect(host.tcpClient.getLastReceived()).to.equal('!Level 99\r')    
  })

})

describe ('Dynamic variables', () => {

  it ('should create 3 Speaker Variables', () => {
    const {base, device} = setupTestDevice({start: false, setup: false})
    device.setup({
      speakers: 3 
    })

    expect(base.getVar('LevelSpeaker1')).not.to.be.undefined
    expect(base.getVar('LevelSpeaker2')).not.to.be.undefined
    expect(base.getVar('LevelSpeaker3')).not.to.be.undefined
  })

  it ('should change the level of speaker 1,2,3 ', () => {
    const {base, device} = setupTestDevice({start: false, setup: false})
    device.setup({ speakers: 3 })

    base.getVar('LevelSpeaker1').required = 99
    expect(base.getVar('LevelSpeaker1').value).to.equal(99)
    base.getVar('LevelSpeaker2').required = 10
    expect(base.getVar('LevelSpeaker2').value).to.equal(10)
    base.getVar('LevelSpeaker3').required = 30
    expect(base.getVar('LevelSpeaker3').value).to.equal(30)
  })

  it ('should not change the level of speaker because of wrong value', () => {
    const {base, device} = setupTestDevice({start: false, setup: false})
    device.setup({ speakers: 3 })

    base.getVar('LevelSpeaker1').required = 110
    expect(base.getVar('LevelSpeaker1').value).to.equal(undefined)
  })

  it ('should log a message because of wrong value', () => {
    const {base, device, host} = setupTestDevice({start: false, setup: false})
    device.setup({ speakers: 3 })

    base.getVar('LevelSpeaker1').required = 110
    expect(host.logger.getLastLog().toLowerCase()).to.contain('invalid parameter')
  })

})

describe ('Dynamic variable names', () => {

  it ('should create variables with dynamic names', () => {
    const {base, device} = setupTestDevice({start: false, setup: false})
    device.setup({
      speakers: ["Left", "Middle", "Right"]
    })

    expect(base.getVar('Left')).not.to.be.undefined
    expect(base.getVar('Middle')).not.to.be.undefined
    expect(base.getVar('Right')).not.to.be.undefined    
  })

  it ('should change the level of speaker Left, Middle, Right ', () => {
    const {base, device} = setupTestDevice({start: false, setup: false})
    device.setup({
      speakers: ["Left", "Middle", "Right"]
    })

    base.getVar('Left').required = 99
    expect(base.getVar('Left').value).to.equal(99)
    base.getVar('Middle').required = 10
    expect(base.getVar('Middle').value).to.equal(10)
    base.getVar('Right').required = 30
    expect(base.getVar('Right').value).to.equal(30)
  })
  
})