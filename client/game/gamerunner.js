(function() {
"use strict";

/*
	Sets up loop ending variable destroyed
 */
function GameRunner(loadData, socket, canvas, config,
                             displayCallback, gameEndedCallback, rematchCallback) {
	this.loadData = loadData;
	this.socket = socket;
	this.canvas = canvas;
	this.config = config;
	this.display = displayCallback;
	this.gameEndedCallback = gameEndedCallback;
	this.rematchCallback = rematchCallback;
	this.destroyed = false;
	this.unlisteners = [];
}

/*
	Set variables to quit loop.
 */
GameRunner.prototype.destroy = function() {
	if (this.game)
		this.game.destroy();
	this.destroyed = true;
	this.deadAlready = true;
};

/*
	Setting up resize window hooks.
	Creating ui, game, and network. 
 */
GameRunner.prototype.start = function() {
	this.loadData.Field.width = this.loadData.Field.Tiles[0].length;
	this.loadData.Field.height = this.loadData.Field.Tiles.length;

	this.eventqueue = [];
	this.playerId = this.loadData.Id;
	this.ui = new Ui(this.canvas, this.config, this.loadData);
	this.game = new Game(this.loadData.Field, this.config, this.ui);
	if (this.socket)
		this.network = new Network(this.socket, this.eventqueue);
	else
		this.network = new MockNetwork();

	this.ui.setupCanvas();
	this.resizeHandler = this.handleResize.bind(this);
	window.addEventListener("resize", this.resizeHandler);
	this.resizeHandler();

	this.network.takeOverSocket();
	this.network.ready(this.startFunc.bind(this), this.endFunc.bind(this), this.rematchCallback);
};

/*
	Resize window logic.
 */
GameRunner.prototype.handleResize = function() {
	var canvas = this.canvas;
	var actualContainer = document.querySelector(".fullscreen-container");
	var widthScale = actualContainer.offsetWidth / canvas.width;
	var heightScale = actualContainer.offsetHeight / canvas.height;

	// Chrome apparently doesn't handle "height: 100%; width: auto;" correctly
	// on resize - trigger reflow on something else to work around it.
	canvas.style.width = canvas.style.height = "0";
	canvas.offsetWidth;

	if (widthScale < 1 && heightScale < 1) {
		var scaleWidth = (widthScale < heightScale);
		canvas.style.width = (scaleWidth ? "100%" : "");
		canvas.style.height = (!scaleWidth ? "100%" : "");
	}
	else {
		canvas.style.height = (heightScale < 1 ? "100%" : "");
		canvas.style.width = (widthScale < 1 ? "100%" : "");
	}
};

/*
	Sets up handlers for mouse and keyboard.
 */
GameRunner.prototype.registerEventListeners = function() {
	var that = this;
	this.keyDownListener = function(ev) {
		var lineEvents = that.ui.handleKeyDown(ev.keyCode, that.game.getNextFrame());
		that.addLineEvents(lineEvents);
	};
	window.addEventListener("keydown", this.keyDownListener);

	function getCanvasCoordinatesFromEvent(ev) {
		// If we use jQuery, this is just (ev.pageX - $(ev).offset().left), etc.
		var docElem = document.documentElement;
		var bclr = that.canvas.getBoundingClientRect();
		var scale = bclr.width / that.canvas.width;
		var x = ev.pageX - (bclr.left + window.pageXOffset - docElem.clientTop);
		var y = ev.pageY - (bclr.top + window.pageYOffset - docElem.clientLeft);
		return {
		  x: Math.round(x / scale),
		  y: Math.round(y / scale),
		};
	};

	var mouseDownListener = function(ev) {
		var pos = getCanvasCoordinatesFromEvent(ev);
		var lineEvents = that.ui.handleMousedown(pos, ev.button, that.game.getNextFrame());
		that.addLineEvents(lineEvents);
	};
	this.canvas.addEventListener("mousedown", mouseDownListener);
	this.unlisteners.push(function() {
		that.canvas.removeEventListener("mousedown", mouseDownListener);
	});

	function makeTouchListener(type, uiListenerName) {
		var func = function(ev) {
			for (var i = 0; i < ev.changedTouches.length; ++i) {
				var t = ev.changedTouches[i];
				var pos = getCanvasCoordinatesFromEvent(t);
				var id = t.identifier;
				var lineEvents = that.ui[uiListenerName](id, pos, that.game.getNextFrame());
				that.addLineEvents(lineEvents);
			}
			ev.preventDefault();
		};
		that.canvas.addEventListener(type, func);
		that.unlisteners.push(function() {
			that.canvas.removeEventListener(type, func);
		});
	}
	makeTouchListener("touchstart", "handleTouchStart");
	makeTouchListener("touchend", "handleTouchEnd");
	makeTouchListener("touchcancel", "handleTouchCancel");
};

/*
	Renders first frame and starts countdown.
 */
GameRunner.prototype.startFunc = function(clockAdjustment) {
	this.display("Connected", true);
	if (debug) {
		this.prepareLoop(clockAdjustment);
	} else {
		this.game.step(0, []);
		this.countdown(function() {
			this.prepareLoop(clockAdjustment);
		}.bind(this));
	}
};

/*
	Removes event handlers for everything.
 */
GameRunner.prototype.endFunc = function(condition) {
	// (If the listeners have not yet been registered, this is a no-op.)
	this.unlisteners.forEach(function(callback) {
		callback();
	});
	window.removeEventListener("keydown", this.keyDownListener);
	window.removeEventListener("resize", this.resizeHandler);

	this.gameEndedCallback(condition);
};

GameRunner.prototype.prepareLoop = function(clockAdjustment) {
	this.deadAlready = false;
	this.registerEventListeners();

	// XXX: This is apparently a bit of a hack.
	this.lasttime = performance.now() - clockAdjustment;

	if (this.looprunning)
		alert("looprunning FIXME");

	if (!this.looprunning) {
		this.loop();
	}
	this.looprunning = true;
};

/*
	Counts down to start
 */
GameRunner.prototype.countdown = function(callback) {
	// Not secure...
	this.display("Ready?", false);
	setTimeout(function() {
		this.display("Set...");
	}.bind(this), 1000);
	setTimeout(function() {
		this.display("Go!", true);
		callback();
	}.bind(this), 2000);
};

/*
	Runner of gameloop
	Ends loop
	Calculates deltatime
	Sends dead to server when this player is dead.
 */
GameRunner.prototype.loop = function() {
	if (this.destroyed)
		return;
	var newtime = performance.now();
	var deltatime = newtime - this.lasttime;
	this.lasttime = newtime;
	this.game.step(deltatime, this.eventqueue);
	if (!this.deadAlready && this.game.getRemainingPlayers().indexOf(this.playerId) == -1) {
		setTimeout(function() { // XXX Hack...
			if (!this.deadAlready && this.game.getRemainingPlayers().indexOf(this.playerId) == -1) {
				this.deadAlready = true;
				this.network.send("dead");
				this.display("You're dead.", false);
			}
		}.bind(this), 300);
	}
	if (GetParams["noloop"])
		return;
	requestAnimationFrame(this.loop.bind(this));
};

/*
	Sends events to server and pushes them to eventque on this computer.
 */
GameRunner.prototype.addLineEvents = function(evs) {
	if (!evs)
		return;
	evs.forEach(function(ev) {
		this.network.send(ev);
		this.eventqueue.push(ev);
	}, this);
};

/*
	Send rematch
 */
GameRunner.prototype.requestRematch = function() {
	this.network.send("rematch");
};

window.GameRunner = GameRunner;

})();
