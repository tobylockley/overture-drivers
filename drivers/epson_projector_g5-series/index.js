"use strict"

let serie = 'G5'

let serieConfig = {
	'UST': {
		lampCount: 1,
		sourceMap: [
			{ 'name': 'RGB', 'sourceCodeH': '1' },
			{ 'name': 'HDMI1', 'sourceCodeH': '3' },
			{ 'name': 'VIDEO', 'sourceCodeH': '4' },
			{ 'name': 'HDMI2', 'sourceCodeH': 'A' },
		]
	},
	'G6': {
		lampCount: 1,
		sourceMap: [
			{ 'name': 'DVI-D', 'sourceCodeH': 'A' },
			{ 'name': 'VGA', 'sourceCodeH': '1' },
			{ 'name': 'HDMI', 'sourceCodeH': '3' },
			{ 'name': 'VIDEO', 'sourceCodeH': '4' },
			{ 'name': 'DisplayPort', 'sourceCodeH': '7' },
			{ 'name': 'HDBaseT', 'sourceCodeH': '8' },
			{ 'name': 'BNC', 'sourceCodeH': 'B' },
		],
		NA: [
			'zoom'
		]
	},
		'G5': {
		lampCount: 1,
		sourceMap: [
			{ 'name': 'DVI-D', 'sourceCodeH': 'A' },
			{ 'name': 'COMPUTER', 'sourceCodeH': '1' },
			{ 'name': 'HDMI', 'sourceCodeH': '3' },
			{ 'name': 'S-VIDEO', 'sourceCodeH': '4' },
			//{ 'name': 'DisplayPort', 'sourceCodeH': '7' },
			//{ 'name': 'HDBaseT', 'sourceCodeH': '8' },
			{ 'name': 'BNC', 'sourceCodeH': 'B' },
		],
		NA: [
			'zoom'
		]
	}
}

let errorList = {
	'00': '', //There is no error or the error is recovered
	'01': 'Fan error',
	'03': 'Lamp failure at power on',
	'04': 'High internal temperature error',
	'06': 'Lamp error',
	'07': 'Open Lamp cover door error',
	'08': 'Cinema filter error',
	'09': 'Electric dual-layered capacitor is disconnected',
	'0A': 'Auto iris error',
	'0B': 'Subsystem Error',
	'0C': 'Low air flow error',
	'0D': 'Air filter air flow sensor error',
	'0E': 'Power supply unit error (Ballast)',
	'0F': 'Shutter error',
	'10': 'Cooling system error (peltiert element)',
	'11': 'Cooling system error (Pump)',
	'12': 'Static iris error',
	'13': 'Power supply unit error (Disagreement of Ballast)',
	'14': 'Exhaust shutter error',
	'15': 'Obstacle detection error',
	'16': 'IF board discernment error',
	'17': 'Communication error of Stack projection function',
	'18': 'I2C error',
}

// exported init function
let logger
let host
let _

exports.init = function (_host) {
	host = _host
	logger = host.logger
	_ = host.lodash
}

// exported createDevice function
exports.createDevice = function (base) {
	let config
	let tcpClient
	let feedbackCommands = []
	let lastFeedbackIndex = 0

	//BUILD THE FRAME PARSER
	let frameParser = host.createFrameParser()
	frameParser.setSeparator(":")

	// listen for 'data' events from the frameParser
	// which are triggered each time full frame is received
	frameParser.on('data', (frame) => {
		onFrame(frame)
	})

	//SET POLLING COMMANDS
	base.setPoll('getFeedback', 1000)

	//BASE COMMANDS-------------------------------------------------------
	function setup(_config) {
		config = _config

		feedbackCommands.push(getPower)
		feedbackCommands.push(getSource)
		feedbackCommands.push(getVideoMute)
		// feedbackCommands.push(getBrightness)
		// feedbackCommands.push(getContrast)
		feedbackCommands.push(getHoursLamp)
		feedbackCommands.push(getError)

		if (serieConfig[serie]) {
			//Update the sources list
			var sources = [];
			for (var i = 0; i < serieConfig[serie].sourceMap.length; i++)
				sources.push(serieConfig[serie].sourceMap[i].name)
			base.getVar("Sources").enums = sources

			//create the Zoom
			let zoomSupported = (serieConfig[serie].NA) ? (serieConfig[serie].NA.indexOf('zoom') === -1) : true
			if (zoomSupported) {
				let zoom = base.createVariable({
					name: 'Zoom',
					type: 'integer',
					min: 0,
					max: 100,
					unit: 'levelpercent'
				})
				zoom.perform = {"action":"Set Zoom", "params": {"Position": "$value"}, "optimize": true}
				feedbackCommands.push(getZoom)
			}

			//create the HoursLampXXX
			let lampCount = (serieConfig[serie]) ? serieConfig[serie].lampCount : 0
			for (let i = 0; i < lampCount; i++) {
				base.createVariable({
					name: 'HoursLamp' + (i + 1).toString(),
					type: 'integer',
					min: 0,
					unit: 'hours'
				})
			}

		}

		
	}

	// connect to the device when start()
	function start() {
		initTcpClient()
		base.perform('connect')
	}

	// disconnect from the device when stop()
	function stop() {
		tcpClient.end()
		disconnect();
	}
	//END BASE COMMANDS-----------------------------------------------------------

	//DEVICE COMMANDS-----------------------------------------------------------
	const setPower = (params) => {
		let msg = 'PWR ' + params.Status.toUpperCase()
		if (sendCommand(msg)) {
			base.commandDefer(5000)
			base.performInPriority('getPower')
		}
		else base.commandError('Not Sent')
	}

	const selectSource = (params) => {
		let sourceCodeH
		if (serieConfig[serie]) {
			//find sourceCodeH by name
			let obj = _.find(serieConfig[serie].sourceMap, ['name', params.Name]);
			if (obj) {
				sourceCodeH = obj.sourceCodeH
			}
		}
		if (sourceCodeH) {
			let msg = 'SOURCE ' + sourceCodeH + '0'
			if (sendCommand(msg)) {
				base.commandDefer(5000)
				base.performInPriority('getSource')
			}
			else base.commandError('Not Sent')
		}
		else base.commandError('Source not found')
	}

	const setVideoMute = (params) => {
		let msg = 'MUTE ' + params.Status.toUpperCase()
		if (sendCommand(msg)) {
			base.commandDefer(5000)
			base.performInPriority('getVideoMute')
		}
		else base.commandError('Not Sent')
	}

	const setBrightness = (params) => {
		let msg = 'BRIGHT ' + pad(Math.floor(((params.Level * 255) / 100)), 3)
		if (sendCommand(msg)) {
			base.commandDefer(5000)
			base.performInPriority('getBrightness')
		}
		else base.commandError('Not Sent')
	3}

	const setContrast = (params) => {
		let msg = 'CONTRAST ' + pad(Math.floor(((params.Level * 255) / 100)), 3)
		if (sendCommand(msg)) {
			base.commandDefer(5000)
			base.performInPriority('getContrast')
		}
		else base.commandError('Not Sent')
	}

	const setZoom = (params) => {
		let msg = 'ZOOM ' + pad(Math.floor(((params.Position * 255) / 100)), 3)
		if (sendCommand(msg)) {
			base.commandDefer(5000)
			base.performInPriority('getZoom')
		}
		else base.commandError('Not Sent')
	}

	//POLL COMMANDS--------------------------------------------
	const getFeedback = () => {
		const command = feedbackCommands[lastFeedbackIndex]
		if (command) {
			lastFeedbackIndex++
			if (lastFeedbackIndex >= feedbackCommands.length) {
				lastFeedbackIndex = 0
			}
			command()
		}
		else {
			lastFeedbackIndex = 0
			base.commandError('Command not found');
		}
	}

	const getPower = () => {
		let msg = 'PWR?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	const getSource = () => {
		let msg = 'SOURCE?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	const getVideoMute = () => {
		let msg = 'MUTE?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	const getBrightness = () => {
		let msg = 'BRIGHT?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	const getContrast = () => {
		let msg = 'CONTRAST?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	const getZoom = () => {
		let msg = 'ZOOM?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	const getHoursLamp = () => {
		let msg = 'LAMP?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	const getError = () => {
		let msg = 'ERR?';
		if (sendCommand(msg)) base.commandDefer(5000)
		else base.commandError('Not Sent')
	}

	//UTIL COMMANDS---------------------------------	
	const sendCommand = (msg) => {
		var initBuffer = Buffer.from([0x45, 0x53, 0x43, 0x2f, 0x56, 0x50, 0x2e, 0x6e, 0x65, 0x74, 0x10, 0x03, 0x00, 0x00, 0x00, 0x00, 0x0d])
		tcpClient.write(initBuffer)
		msg = msg + '\r'
		logger.silly(msg)
		return tcpClient.write(msg)
	}

	const pad = (num, size) => {
		var s = num + ""
		while (s.length < size) s = "0" + s
		return s
	}

	const startPoll = () => {
		base.startPolling()
	}

	const connect = () => {
		tcpClient.connect(config.port, config.host)
		base.commandDefer(2000)
	}

	const disconnect = () => {
		base.stopPolling()
		base.clearPendingCommands()
	}

	// create a tcp client and handle events
	const initTcpClient = () => {
		if (!tcpClient) {
			tcpClient = host.createTCPClient()

			tcpClient.on('data', (data) => {
				//logger.debug("TCP Client Created.")
				let frame = data.toString()
				logger.debug("Incoming Frame: " + frame)
				frameParser.push(data)
			})

			tcpClient.on('connect', () => {
				logger.debug("TCP Connection Open")
				base.getVar('Status').value = 1
				startPoll()
			})

			tcpClient.on('close', () => {
				logger.debug("TCP Connection Closed")
				base.getVar('Status').value = 0
				disconnect()
			})

			tcpClient.on('error', (err) => {
				logger.debug("TCP Connection Error")
				base.getVar('Status').value = 0
				disconnect()
			})
		}
	}

	const onFrame = (data) => {
		data = data.replace(/\r/g, '')

		let rWithParam = /(.*)=(.*):/
		let rWithoutParam = /(.*):/

		if (rWithParam.test(data)) {
			switch (rWithParam.exec(data)[1]) {
				case 'PWR': {
					let param = parseInt(rWithParam.exec(data)[2])
					switch (param) {
						case 0: //00: Standby Mode (Network OFF)
						case 4: //04: Standby Mode (Network ON)
						case 5: //05: Abnormality standby
						case 9: //09: A/V standby
							{ base.getVar("Power").value = 0 } break;
						case 1: //01: Lamp ON 
							{ base.getVar("Power").value = 1 } break;
						case 3: //03: Cooldown
							{ base.getVar("Power").value = 2 } break;
						case 2: //02: Warmup  
							{ base.getVar("Power").value = 3 } break;
					}
				} break;

				case 'SOURCE': {
					let param = rWithParam.exec(data)[2]
					if (param.length === 2) {
						let sourceCodeH = param.substring(0, 1)
						if (serieConfig[serie]) {
							//find name by sourceCodeH
							let obj = _.find(serieConfig[serie].sourceMap, ['sourceCodeH', sourceCodeH]);
							if (obj) {
								base.getVar("Sources").string = obj.name
							}
						}
					}
				} break;

				case 'MUTE': {
					let param = rWithParam.exec(data)[2]
					base.getVar("VideoMute").value = (param === 'ON') ? 1 : 0
				} break;

				case 'BRIGHT':
				case 'CONTRAST':
				case 'ZOOM': {
					let param = parseInt(rWithParam.exec(data)[2])
					if ((param >= 0) && (param <= 255)) {
						let variable
						switch (rWithParam.exec(data)[1]) {
							case 'BRIGHT': { variable = "Brightness" } break;
							case 'CONTRAST': { variable = "Contrast" } break;
							case 'ZOOM': { variable = "Zoom" } break;
						}
						base.getVar(variable).value = Math.floor(((param * 100) / 255))
					}
				} break;

				case 'LAMP': {
					let param = parseInt(rWithParam.exec(data)[2])
					let lampCount = (serieConfig[serie]) ? serieConfig[serie].lampCount : 0
					for (let i = 0; i < lampCount; i++) {
						base.getVar('HoursLamp' + (i + 1).toString()).value = param
					}
				} break;

				case 'ERR': {
					let param = rWithParam.exec(data)[2]
					if (errorList[param] !== undefined) {
						base.getVar("Error").value = errorList[param]
					}
				} break;
			}
		}
		else {
			if (rWithoutParam.test(data)) {
				base.getVar("Error").value = "Illegal command"
			}
		}

		base.commandDone()
	}

	return {
		setup,
		start,
		stop,

		connect,
		disconnect,

		setPower,
		selectSource,
		setVideoMute,
		setBrightness,
		setContrast,
		setZoom,

		getFeedback,
		getPower,
		getSource,
		getVideoMute,
		getBrightness,
		getContrast,
		getZoom,
		getHoursLamp,
		getError
	}
}
