function Runner(socket, container, config) {
	var canvas = this.canvas = container.querySelector("canvas")
	this.container = container
	var canvas_context = canvas.getContext('2d')
	this.config = config

	var samplemap = {
		name: "Valley of Darkness",
		parts: [
			[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
			[0,0,0,1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0],
			[0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
			[0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
			[0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,1,0,0,0],
			[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		],
	}
	var samplestate = {
		nbullets: 1,
		bullets: [
			{
				id: 0,
				owning_player: 0,
				position: {
					x: 110,
					y: 110,
				},
				direction: {
					x: 0.707106781,
					y: 0.707106781,
				}
			},
		],
		nunits: 2,
		units: [
			{
				id: 0,
				owning_player: 0,
				position: {
					x: 100,
					y: 100
				},
				target: {
					x: 100,
					y: 100
				},
				shooting_cooldown: 0
			},
			{
				id: 1,
				owning_player: 1,
				position: {
					x: 100,
					y: 100
				},
				target: {
					x: 400,
					y: 400
				},
				shooting_cooldown: 0
			},
		],
	}

	this.eventqueue = []

	this.ui = new Ui(canvas_context, config, samplemap)
	this.game = new Game(samplemap, samplestate, config, this.ui)
	this.network = new Network(socket, this.eventqueue, 10)
}

Runner.prototype.run = function() {
	var that = this
	var fullscreenButton = this.container.querySelector(".fullscreen-button")
	fullscreenButton.addEventListener("click", function() {
		var el = that.container.querySelector(".fullscreen-container")
		if (el.requestFullscreen) {
			el.requestFullscreen()
		} else if (el.webkitRequestFullScreen) {
			el.webkitRequestFullScreen()
		} else if (el.mozRequestFullScreen) {
			el.mozRequestFullScreen()
		}
	})

	this.network.takeOverSocket()
	this.network.ready(function(clockAdjustment) {
		that.startLoop(clockAdjustment)
	})
}

Runner.prototype.startLoop = function(clockAdjustment) {
	var lobby = this.container.querySelector(".lobby")
	lobby.style.setProperty("opacity", "0")
	lobby.innerHTML = "Connected"
	var that = this
	var canvas = this.canvas
	this.canvas.onmousedown = function(ev) {
		// If we use jQuery, this is just (ev.pageX - $(ev).offset().left), etc.
		var docElem = document.documentElement
		var bclr = that.canvas.getBoundingClientRect()
		var x = ev.pageX - Math.round(bclr.left + window.pageXOffset - docElem.clientTop)
		var y = ev.pageY - Math.round(bclr.top + window.pageYOffset - docElem.clientLeft)
		lineevent = that.ui.handleMousedown(x, y, ev.button, that.game)
		if (lineevent) {
			that.network.send(lineevent)
			that.eventqueue.push(lineevent)
		}
	}

	// XXX: This is apparently a bit of a hack.
	this.lasttime = performance.now() - clockAdjustment
	this.loop();
}

Runner.prototype.loop = function() {
	var newtime = performance.now()
	var deltatime = newtime - this.lasttime
	this.lasttime = newtime
	this.game.step(deltatime, this.eventqueue)
	requestAnimationFrame(this.loop.bind(this))
}

function initializeGame() {
	var config = {
		colors: {
			teams: [
				"#7EA885",
				"#ECC57C",
				"#E1856C",
				"#872237",
				"#A1A1AA"
			],
			background: "#1D1D1D",
			bullet: "#C82257",
			selected: "#208BB5",
			map: "#262626",
		},
		buttons: {
			0: "fire",
			2: "move"
		}
	}
	var container = document.querySelector(".game-container");
	var runner = new Runner(socket, container, config)
	runner.run()
}

var socket = new WebSocket("ws://" + location.host + "/ws")
socket.onmessage = function(e) {
	if (e.data === "load")
		initializeGame();
}
