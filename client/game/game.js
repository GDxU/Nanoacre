var TIME_STEP = 16;

function Game(map, config, ui) {
	this.map = map
	this.config = config
	this.ui = ui
	this.timeline = new Timeline(map)
	this.timeBehind = 0
}

Game.prototype.destroy = function() {
	this.timeline.destroy();
};

Game.prototype.step = function(deltatime, eventqueue) {
	while (eventqueue.length > 0) {
		this.timeline.insert(eventqueue.pop())
	}

	this.timeBehind += deltatime
	while (this.timeBehind >= TIME_STEP) {
		this.timeBehind -= TIME_STEP
		this.timeline.step()
	}
	this.ui.render(deltatime, this.timeline.getCurrentState())
};

Game.prototype.getNextFrame = function() {
	return this.timeline.getNextFrame();
};
