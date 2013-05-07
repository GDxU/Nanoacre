"use strict";

var SELECTED_WIDTH = 3;

var COOLDOWN_RADIUS = 3;
var COOLDOWN_WIDTH = 6;

var DOT_DISTANCE = Math.PI/8

var TILE_RENDER_SIZE = 40;
var UI_RENDER_FACTOR = TILE_RENDER_SIZE / TILE_SIZE;

var BULLET_LENGTH = 50;
var BULLET_WIDTH = UI_RENDER_FACTOR * BULLET_RADIUS;

function Ui(canvas_context, config, loadData) {
	this.ctx = canvas_context
	this.config = config
	this.map = loadData.Field
	this.playerId = loadData.Id

	this.deadUnits = []
	this.selection = []
	this.ownedUnits = []
	this.drawMode = 0

	this.particlesystem = new Particlesystem(canvas_context)
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
	if (this.lastState) {
		this.lastState.units.forEach(function(unit) {
			for (var i = 0; i < state.units.length; i++) {
				if (state.units[i].id == unit.id)
					return
			}
			var killingdirection = {x: 0, y: 0}
			var diff = null
			this.lastState.bullets.forEach(function(bullet) {	// XXX Hack killing bullet
				var newdiff = Math.abs(bullet.position.x - unit.position.x + bullet.position.y - bullet.position.y)
				if(newdiff < diff || diff == null) {
					killingdirection = bullet.direction
					diff = newdiff
				}
			})
			this.particlesystem.explosion(
				unit.position.x * UI_RENDER_FACTOR, 
				unit.position.y * UI_RENDER_FACTOR, 
				this.config.colors.teams[unit.owning_player],
				killingdirection
			)
			this.deadUnits.push(deepCopy(unit))
		}, this)

		for (var i = 0; i < this.deadUnits.length; i++) {
			for (var j = 0; j < state.units.length; j++) {
				if (state.units[j].id == this.deadUnits[i].id) {
					this.deadUnits.splice(i, 1)
					i--
					console.log("unit " + state.units[i].id + " used to be dead.")
					break
				}
			}
		}
	}
	this.lastState = state

	// Clear
	this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

	// Deadlings
	for (var i = 0; i < this.deadUnits.length; i++) {
		this.renderUnit(this.deadUnits[i], false)
	}

	// Units
	for (var i = 0; i < state.units.length; i++) {
		this.renderUnit(state.units[i], true)
	}

	// Bullets
	this.ctx.strokeStyle = this.config.colors.bullet
	this.ctx.lineWidth = BULLET_WIDTH;
	for (var i = 0; i < state.bullets.length; i++) {
		var bullet = state.bullets[i]
		this.ctx.beginPath()
		var x = bullet.position.x * UI_RENDER_FACTOR;
		var y = bullet.position.y * UI_RENDER_FACTOR;
		this.ctx.moveTo(x, y)
		this.ctx.lineTo(
			x - BULLET_LENGTH * bullet.direction.x,
			y - BULLET_LENGTH * bullet.direction.y)
		this.ctx.stroke()
	}

	// Particles
	this.particlesystem.update(deltatime)
	this.particlesystem.render()

	// Shadow
	var shadowsFor = [];
	for (var i = 0; i < state.units.length; i++) {
		if (state.units[i].owning_player === this.playerId)
			shadowsFor.push(state.units[i]);
	}
	if (shadowsFor.length > 0) {
		this.ctx.save();
		this.clipShadows(shadowsFor);
		this.ctx.fillStyle = this.config.colors.shadow;
		this.ctx.beginPath();
		this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
		this.ctx.restore();
	}

	// Map
	this.ctx.fillStyle = this.config.colors.map
	this.ctx.beginPath()
	for (var i = 0; i < this.map.Tiles.length; i++) {
		for(var j = 0; j < this.map.Tiles[0].length; j++) {
			if(this.map.Tiles[i][j] == 1) {
				this.ctx.rect(j*TILE_RENDER_SIZE, i*TILE_RENDER_SIZE, TILE_RENDER_SIZE, TILE_RENDER_SIZE)
			}
		}
	}
	this.ctx.fill();
}

Ui.prototype.renderUnit = function(unit, alive) {
	var x = unit.position.x * UI_RENDER_FACTOR;
	var y = unit.position.y * UI_RENDER_FACTOR;
	var isSelected = this.selection.indexOf(unit.id) != -1
	if (alive) {
		this.ctx.fillStyle = this.config.colors.teams[unit.owning_player]
	} else {
		this.ctx.fillStyle = this.config.colors.dead
	}

	var idWhenSelected = this.ownedUnits.indexOf(unit.id)
	if (idWhenSelected == -1) {
		this.ctx.beginPath()
		this.ctx.arc(x, y, PLAYER_RADIUS * UI_RENDER_FACTOR, 0, Math.PI*2, false)
	} else {
		switch(this.drawMode) {
			case 0:
				this.ctx.beginPath()
				this.ctx.arc(x, y, PLAYER_RADIUS * UI_RENDER_FACTOR, 0, Math.PI*2, false)
				break
			case 1:
				this.drawDots(x, y, idWhenSelected + 1, PLAYER_RADIUS * UI_RENDER_FACTOR * 1.4, 2)
				this.ctx.beginPath()
				this.ctx.arc(x, y, PLAYER_RADIUS * UI_RENDER_FACTOR, 0, Math.PI*2, false)
				break
			case 2:
				this.ctx.beginPath()
				this.drawNGonPath(x, y, idWhenSelected + 3, PLAYER_RADIUS * UI_RENDER_FACTOR)
				break
		}
	}
	this.ctx.fill()

	if (isSelected) {
		this.ctx.lineWidth = SELECTED_WIDTH
		this.ctx.strokeStyle = this.config.colors.selected
		this.ctx.stroke()
	}
	
	var onCooldown = unit.shooting_cooldown != 0
	var shotsFired = unit.shots_fired != 0
	if (alive && (onCooldown || shotsFired)) {
		this.ctx.beginPath()
		this.ctx.lineWidth = COOLDOWN_WIDTH
		this.ctx.strokeStyle = this.config.colors.cooldown
		if (onCooldown) {
			this.ctx.arc(x, y, COOLDOWN_RADIUS, -Math.PI/2, (unit.shooting_cooldown/SHOOTING_COOLDOWN)*Math.PI*2 - Math.PI/2, false)
		} else {
			this.ctx.arc(x, y, COOLDOWN_RADIUS, -Math.PI/2, (unit.shots_fired/MAX_SHOTS)*Math.PI*2 - Math.PI/2, false)
		}
		this.ctx.stroke()
	}
}

Ui.prototype.clipShadows = function(units) {
	for (var i = 0; i < units.length; ++i) {
		this.pathShadowsForUnit(units[i]);
	}
}

Ui.prototype.blocksLOS = function(y, x) {
	if (y < 0 || y >= this.map.Tiles.length ||
		x < 0 || x >= this.map.Tiles[0].length) {
		return true;
	}
	return this.map.Tiles[y][x] == 1;
}

Ui.prototype.pathShadowsForUnit = function(unit) {
	var unitpos = {
		x: unit.position.x * UI_RENDER_FACTOR,
		y: unit.position.y * UI_RENDER_FACTOR
	};
	var sz = TILE_RENDER_SIZE;
	this.ctx.beginPath();
	for (var y = 0; y < this.map.Tiles.length; y++) {
		for (var x = 0; x < this.map.Tiles[0].length; x++) {
			var mx = x * sz;
			var my = y * sz;
			if (this.map.Tiles[y][x] == 1) {
				var points = []
				var horiBlocks = [this.blocksLOS(y, x-1), this.blocksLOS(y, x+1)];
				var vertBlocks = [this.blocksLOS(y-1, x), this.blocksLOS(y+1, x)];

				for (var i = 0; i < 2; ++i) {
					for (var j = 0; j < 2; ++j) {
						var onOtherSide = {
							vert: (j == 0 && unitpos.y > my + sz) || (j == 1 && unitpos.y < my),
							hori: (i == 0 && unitpos.x > mx + sz) || (i == 1 && unitpos.x < mx),
						};
						if (onOtherSide.vert && onOtherSide.hori) continue;
						if (horiBlocks[i]) { //TODO: hide corners that are hidden but not inside a wall
							if (onOtherSide.vert) continue;
						}
						if (vertBlocks[j]) {
							if (onOtherSide.hori) continue;
						}
						points.push({x: mx + i*sz, y: my + j*sz});
					}
				}
				if (points.length < 2) continue;


				var bestangle = 0, besti = 0, bestj = 1;
				if (points.length > 2) {
					var angles = points.map(function(p) {
						return Math.atan2(p.y - unitpos.y, p.x - unitpos.x);
					});
					for (var i = 0; i < points.length; ++i) {
						for (var j = i+1; j < points.length; ++j) {
							var d = angles[i] - angles[j];
							if (d < 0) d = -d;
							d %= 2*Math.PI;
							if (d >= Math.PI) d = 2*Math.PI - d;
							if (d > bestangle) {
								bestangle = d;
								besti = i;
								bestj = j;
							}
						}
					}
				}

				this.pathShadowForUnit(unitpos, points[besti], points[bestj]);
			}
		}
	}

	this.ctx.clip();
}

Ui.prototype.pathShadowForUnit = function(base, a, b) {
	var factor = 300;
	var a2 = {
		x: (a.x - base.x) * factor + base.x,
		y: (a.y - base.y) * factor + base.y,
	};
	var b2 = {
		x: (b.x - base.x) * factor + base.x,
		y: (b.y - base.y) * factor + base.y,
	};
	if ( (b2.x-a2.x)*(b2.y+a2.y)
		+(b.x -b2.x)*(b.y +b2.y)
		+(a.x - b.x)*(a.y + b.y)
		+(a2.x- a.x)*(a2.y+ a.y) < 0) {
		var temp = b;
		b = a; a = temp;
		temp = b2;
		b2 = a2; a2 = temp;
	}
	this.ctx.moveTo(a2.x, a2.y);
	this.ctx.lineTo(b2.x, b2.y);
	this.ctx.lineTo(b.x, b.y);
	this.ctx.lineTo(a.x, a.y);
	this.ctx.closePath();
}

Ui.prototype.precomputeDots = function(maxN) {
	this.dots = new Array(maxN)
	for (var i = 0; i <= maxN; i++) {
		this.dots[i] = new Array(i)
		var firstAngle = -Math.PI/2 - (i - 1)*DOT_DISTANCE/2
		for (var j = 0; j < i; j++) {
			this.dots[i][j] = [Math.cos(firstAngle + j * DOT_DISTANCE), Math.sin(firstAngle + j * DOT_DISTANCE)]
		}
	}
}

Ui.prototype.drawDots = function(x, y, n, radiusFromPlayer, dotRadius) {
	if (!this.dots || n >= this.dots.length)
		this.precomputeDots(Math.max(5, n))

	for (var i = 0; i < this.dots[n].length; i++) {
		this.ctx.beginPath()
		this.ctx.arc(x + radiusFromPlayer * this.dots[n][i][0],
		             y + radiusFromPlayer * this.dots[n][i][1],
		             dotRadius, 0, Math.PI*2, false)
		this.ctx.fill()
	}
}

Ui.prototype.precomputeNGons = function(maxN) {
	this.ngons = new Array(maxN)
	for (var i = 0; i <= maxN; i++) {
		this.ngons[i] = new Array(i)
		for (var j = 0; j < i; j++) {
			this.ngons[i][j] = [Math.cos(j * 2 * Math.PI / i - Math.PI/2), Math.sin(j * 2 * Math.PI / i - Math.PI/2)]
		}
	}
}

Ui.prototype.drawNGonPath = function(x, y, n, radius) {
	if (!this.ngons || n >= this.ngons.length)
		this.precomputeNGons(Math.max(10, n))

	this.ctx.moveTo(x, y - radius)
	for (var i = 0; i < n; i++) {
		this.ctx.lineTo(x + radius*this.ngons[n][i][0], y + radius*this.ngons[n][i][1])
	}
	this.ctx.closePath()
}

Ui.prototype.handleMousedown = function(x, y, button, nextFrame) {
	var type = this.config.buttons[button]
	return this.selection.map(function(unitId, index, selection) {
		return {
			time: nextFrame,
			type: type,
			who: unitId,
			towards: {
				x: (x / UI_RENDER_FACTOR) | 0, //TODO: offset if several units are selected
				y: (y / UI_RENDER_FACTOR) | 0
			}
		}
	})
}

Ui.prototype.handleKeyDown = function(keycode, shiftDown, nextFrame) {
	if (keycode >= 49 && keycode <= 57) { //1-9
		var index = keycode - 49
		if (this.ownedUnits.length > index) {
			var unitId = this.ownedUnits[index]
			if (shiftDown) {
				this.toggleUnitSelection(unitId)
			} else {
				this.selection = [this.ownedUnits[index]]
			}
		}
	} else if (keycode == 48) {
		this.drawMode = (this.drawMode + 1) % 3
	}

	return null
}

Ui.prototype.toggleUnitSelection = function(unitId) { //TODO: This should probably be a bit more intelligent, say only remove units when more than one unit is selected
	var index = this.selection.indexOf(unitId)
	if (index == -1) {
		this.selection.push(unitId)
	} else {
		this.selection.splice(index, 1)
	}
}

Ui.prototype.handleKeyUp = function(keycode, shiftDown, nextFrame) {}
