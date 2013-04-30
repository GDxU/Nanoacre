var BULLET_LENGTH = 50;
var PLAYER_SIZE = 10;

var TILE_RENDER_SIZE = 40;
var UI_RENDER_FACTOR = TILE_RENDER_SIZE / TILE_SIZE;

function Ui(canvas_context, config, loadData) {
	this.ctx = canvas_context
	this.config = config
	this.map = loadData.Field

	this.playerId = loadData.Id
	this.selection = []
	this.ownedUnits = []
}

Ui.prototype.registerInitialUnits = function(units) {
	units.forEach(function(unit) {
		if (unit.owning_player == this.playerId) {
			this.ownedUnits.push(unit.id)
		}
	}, this)
	this.selection = [this.ownedUnits[0]]
}

Ui.prototype.render = function(deltatime, state) {
	this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
	this.ctx.strokeStyle = this.config.colors.bullet
	this.ctx.lineWidth = 3;
	for(var i = 0; i < state.bullets.length; i++) {
		var bullet = state.bullets[i]
		this.ctx.beginPath()
		var x = bullet.position.x * UI_RENDER_FACTOR;
		var y = bullet.position.y * UI_RENDER_FACTOR;
		this.ctx.moveTo(x, y)
		this.ctx.lineTo(
			x + BULLET_LENGTH * bullet.direction.x,
			y + BULLET_LENGTH * bullet.direction.y)
		this.ctx.stroke()
	}
	this.ctx.fillStyle = this.config.colors.map
	this.ctx.beginPath()
	for(var i = 0; i < this.map.Tiles.length; i++) {
		for(var j = 0; j < this.map.Tiles[0].length; j++) {
			if(this.map.Tiles[i][j] == 1) {
				this.ctx.rect(j*TILE_RENDER_SIZE, i*TILE_RENDER_SIZE, TILE_RENDER_SIZE, TILE_RENDER_SIZE)
			}
		}
	}
	this.ctx.fill();
	for(var i = 0; i < state.units.length; i++) {
		var unit = state.units[i]
		this.ctx.fillStyle = this.config.colors.teams[unit.owning_player]
		this.ctx.beginPath()
		var x = unit.position.x * UI_RENDER_FACTOR;
		var y = unit.position.y * UI_RENDER_FACTOR;
		this.ctx.arc(x, y, PLAYER_RADIUS * UI_RENDER_FACTOR, 0, Math.PI*2, false)
		this.ctx.fill()
	}
}

Ui.prototype.handleMousedown = function(x, y, button, game) {
	var time = game.getNextFrame()
	var type = this.config.buttons[button]
	return this.selection.map(function(unitId, index, selection) {
		return {
			time: time,
			type: type,
			who: unitId,
			towards: {
				x: (x / UI_RENDER_FACTOR) | 0, //TODO: offset if several units are selected
				y: (y / UI_RENDER_FACTOR) | 0
			}
		}
	})
}

Ui.prototype.handleKeyDown = function(keycode, game) {
	if (keycode >= 49 && keycode <= 57) { //1-9
		var index = keycode - 49
		if (this.ownedUnits.length > index) {
			this.selection = [this.ownedUnits[index]]
		}
	}

	return null
}
