var TILE_SIZE = 1024;
var PLAYER_RADIUS = 256;

var BULLET_RADIUS = 90;
var SHOOTING_COOLDOWN = 3 * 60;
var MAX_SHOTS = 3;
var RELOAD_COOLDOWN = SHOOTING_COOLDOWN;
var BULLET_SPEED = 175;

;(function() {
"use strict";

var PLAYER_SPEED = 50;

/*
	Sets up pathfinding
 */
window.Logic = function(map) {
	this.map = map;
	this.setupPathfinding();
};

/*
	Destructor. The pathfinding stuff will leak memory if not called.
 */
Logic.prototype.destroy = function() {
	this.clearPathfinding();
};

/*
	Create the initial state for the map
 */
Logic.prototype.initialState = function() {
	return new State(this.map);
};

/*
	Run a function for each wall tile. Returns true if any invocation returned
	true, else false.
 */
Logic.prototype.eachWallTile = function(callback) {
	var map = this.map, ph = map.height, pw = map.width;
	for (var i = 0; i < ph; ++i) {
		for (var j = 0; j < pw; ++j) {
			if (map.Tiles[i][j] === 1) {
				if (callback(j, i))
					return true;
			}
		}
	}
	return false;
};

/*
	Moves waypoint if inside wall
 */
Logic.prototype.moveOutFromWalls = function(pos) {
	pos = deepCopy(pos);
	function min2(a, b) {
		if (a * b < 0)
			return 0;
		return Math.min(a*a, b*b);
	}

	var map = this.map;
	var ph = map.Tiles.length, pw = map.Tiles[0].length;
	var opx = Math.floor(pos.x / TILE_SIZE), opy = Math.floor(pos.y / TILE_SIZE);
	opx = Math.min(Math.max(opx, 0), pw-1);
	opy = Math.min(Math.max(opy, 0), ph-1);
	var px = opx, py = opy;
	if (map.Tiles[py][px] == 1) {
		var available = [];
		for (var i = 0; i < ph; ++i) {
			for (var j = 0; j < pw; ++j) {
				if (map.Tiles[i][j] != 1) {
					var d2 = min2(pos.x - TILE_SIZE * j, pos.x - TILE_SIZE * (j+1)) +
						min2(pos.y - TILE_SIZE * i, pos.y - TILE_SIZE * (i+1));
					available.push([d2, i, j]);
				}
			}
		}
		available.sort(function(a, b) {
			return a[0] - b[0];
		});
		var best = available[0];
		py = best[1];
		px = best[2];
	}
	if (!py || map.Tiles[py-1][px] == 1) pos.y = Math.max(pos.y, py * TILE_SIZE + PLAYER_RADIUS);
	if (!px || map.Tiles[py][px-1] == 1) pos.x = Math.max(pos.x, px * TILE_SIZE + PLAYER_RADIUS);
	if (py+1 === ph || map.Tiles[py+1][px] == 1) pos.y = Math.min(pos.y, (py+1) * TILE_SIZE - PLAYER_RADIUS);
	if (px+1 === pw || map.Tiles[py][px+1] == 1) pos.x = Math.min(pos.x, (px+1) * TILE_SIZE - PLAYER_RADIUS);

	// The above handles 99% of all cases, but not corners. The logic for that
	// is awful, so just hack around it.
	this.eachWallTile(function(x, y) {
		if (y * TILE_SIZE - PLAYER_RADIUS < pos.y && (y + 1) * TILE_SIZE + PLAYER_RADIUS > pos.y &&
			x * TILE_SIZE - PLAYER_RADIUS < pos.x && (x + 1) * TILE_SIZE + PLAYER_RADIUS > pos.x)
		{
			pos = {x: (px+1/2) * TILE_SIZE, y: (py+1/2) * TILE_SIZE};
			return true;
		}
	});

	return pos;
};

/*
	Update unit position
 */
Logic.prototype.moveUnit = function(u) {
	var dirs = ['x', 'y'];
	if (!u.path)
		return;

	// TODO: We might want to do some collision testing here. Currently it works
	// because the path-finding always gives us perfect paths, but that might be
	// a bad thing to rely upon (and if we change it or add new types of
	// collisions it might become necessary).
	var target = u.path[0];
	var dist = 0;
	dirs.forEach(function(dir) {
		var d = (target[dir] - u.position[dir]);
		dist += d*d;
	});
	dist = Math.sqrt(dist);
	if (dist < PLAYER_SPEED) {
		u.position = target;
		u.path.shift();
		if (!u.path.length)
			delete u.path;
		return;
	}

	var npos = {};
	dirs.forEach(function(dir) {
		var d = target[dir] - u.position[dir];
		npos[dir] = u.position[dir] + d / dist * PLAYER_SPEED;
	});
	u.position = npos;
};

/*
	Move the game state forward one frame, handling things like unit/bullet
	movements, shooting, collisions, etc.
 */
Logic.prototype.step = function(state, events, addUIEvent) {
	var map = this.map, self = this;
	state = deepCopy(state);
	events.forEach(function(ev) {
		switch (ev.type) {
			case "move":
				state.units.forEach(function(u) {
					if (u.id === ev.who) {
						u.position = self.moveOutFromWalls(u.position);
						var target = self.moveOutFromWalls(ev.towards);
						u.path = self.pathfind(u.position, target);
					}
				});
				break;

			case "fire":
				state.units.forEach(function(u) {
					if (u.id === ev.who && u.canFire()) {
						var owning_player = u.owning_player;
						var pos = deepCopy(u.position);
						u.shooting_cooldown += SHOOTING_COOLDOWN / MAX_SHOTS;
						u.reload_cooldown = RELOAD_COOLDOWN;
						if (u.shooting_cooldown >= SHOOTING_COOLDOWN) {
							u.reload_cooldown = 0;
						}
						var x = ev.towards.x - pos.x;
						var y = ev.towards.y - pos.y;
						var dist = Math.sqrt(x*x + y*y);
						var dir = {
							x: x / dist,
							y: y / dist,
						};
						state.nbullets++;
						state.bullets.push({
							id: state.nbullets,
							owning_player: owning_player,
							startPosition: pos,
							position: pos,
							direction: dir
						});
					}
				});
				break;
		}
	});
	state.bullets = state.bullets.filter(function(b) {
		b.position.x += b.direction.x * BULLET_SPEED;
		b.position.y += b.direction.y * BULLET_SPEED;

		// Player collisions
		var die = false;
		state.units = state.units.filter(function(u) {
			var distanceSq = dist2(u.position, b.position);
			if (!die && b.owning_player != u.owning_player &&
					distanceSq <= sq(PLAYER_RADIUS + BULLET_RADIUS)) {
				addUIEvent({
					type: "playerBulletCollision",
					bullet: deepCopy(b),
					unit: deepCopy(u)
				});
				die = true;
				return false;
			}
			return true;
		});
		if (die)
			return false;

		// Outside map
		if (b.position.x < -TILE_SIZE ||
			b.position.y < -TILE_SIZE ||
			b.position.x > (map.width + 1) * TILE_SIZE ||
			b.position.y > (map.height + 1) * TILE_SIZE)
		{
			addUIEvent({
				type: "bulletOutOfBounds",
				bullet: deepCopy(b)
			});
			return false;
		}

		// Wall collisions
		var pos = b.position;
		return !this.eachWallTile(function(x, y) {
			if (y * TILE_SIZE < pos.y && (y + 1) * TILE_SIZE > pos.y &&
				x * TILE_SIZE < pos.x && (x + 1) * TILE_SIZE > pos.x)
			{
				addUIEvent({
					type: "wallBulletCollision",
					bullet: deepCopy(b),
					wall: {x: x, y: y}
				});
				return true;
			}
		});
	}, this);
	state.units.forEach(this.moveUnit.bind(this));
	state.units.forEach(function(u) {
		if (u.shooting_cooldown && u.reload_cooldown === 0)
			--u.shooting_cooldown;
		if (u.reload_cooldown)
			--u.reload_cooldown;
	});
	return state;
};


/* === Path finding; talks to compiled code. Beware of dragons. === */

/*
	Pushes data to stack for C++ path finding code
 */
Logic.prototype.pathfindingComputePointsAndRects = function(points, rects) {
	var map = this.map;
	var ph = map.Tiles.length, pw = map.Tiles[0].length;
	for (var y = 0; y < ph; ++y) {
		for (var x = 0; x < pw; ++x) {
			if (map.Tiles[y][x] == 1) {
				// Always push a rect.
				var x1 = TILE_SIZE * x - PLAYER_RADIUS;
				var x2 = TILE_SIZE * (x + 1) + PLAYER_RADIUS;
				var y1 = TILE_SIZE * y - PLAYER_RADIUS;
				var y2 = TILE_SIZE * (y + 1) + PLAYER_RADIUS;
				rects.push([
					{x: x1, y: y1},
					{x: x2, y: y1},
					{x: x1, y: y2},
					{x: x2, y: y2}
				]);

				// And push points for all corners.
				for (var dx = -1; dx <= 1; dx += 2) {
					for (var dy = -1; dy <= 1; dy += 2) {
						var nx = x + dx, ny = y + dy;
						if (nx < 0 || ny < 0 || nx >= pw || ny >= ph)
							continue;
						if (map.Tiles[ny][nx] == 1 || map.Tiles[ny][x] == 1 || map.Tiles[y][nx] == 1)
							continue;
						var realx = (x + (dx+1)/2) * TILE_SIZE + dx * PLAYER_RADIUS;
						var realy = (y + (dy+1)/2) * TILE_SIZE + dy * PLAYER_RADIUS;
						points.push({x: realx, y: realy});
					}
				}
			}
		}
	}
};

// Helper function for pushing a JS array to the C stack
function pushArrayToStack(obj) {
	var mem = Runtime.stackAlloc(obj.length * 4);
	for (var i = 0; i < obj.length; ++i)
		setValue(mem + i*4, obj[i], 'i32');
	return mem;
}

/*
	The shit
 */
Logic.prototype.pathfind = function(from, to) {
	var startStack = Runtime.stackSave();
	try {
		var ptrOutLen = Runtime.stackAlloc(4);
		var ptrPtrOut = Runtime.stackAlloc(4);
		var ret = Module.ccall('pathfind',
			'number',
			['number', 'number', 'number', 'number', 'number', 'number', 'number'],
			[this.ptrMap, from.x, from.y, to.x, to.y, ptrOutLen, ptrPtrOut]);
		if (ret) {
			var len = getValue(ptrOutLen, 'i32');
			var ptrOut = getValue(ptrPtrOut, 'i32');
			var path = [];
			for (var i = 0, ind = 0; i < len; ++i) {
				path.push({
					x: getValue(ptrOut + 4 * (ind++), 'i32'),
					y: getValue(ptrOut + 4 * (ind++), 'i32')
				});
			}
			Module.ccall('free_path', 'number', ['number'], [ptrOut]);
			return path;
		}
		else {
			console.error("No path found", from, to);
		}
	}
	finally {
		Runtime.stackRestore(startStack);
	}
};

/*
	Runs initial pathfinding code
 */
Logic.prototype.setupPathfinding = function() {
	var points = [], rects = [];
	this.pathfindingComputePointsAndRects(points, rects);

	var flatPoints = [], flatRects = [];
	points.forEach(function(p) {
		flatPoints.push(p.x);
		flatPoints.push(p.y);
	});
	rects.forEach(function(corners) {
		for (var i = 0; i < 4; ++i) {
			flatRects.push(corners[i].x);
			flatRects.push(corners[i].y);
		}
	});

	var startStack = Runtime.stackSave();
	var ptrPoints = pushArrayToStack(flatPoints);
	var ptrRects = pushArrayToStack(flatRects);
	var ptrMap = Module.ccall('setup_pathfinding',
		'number',
		['number', 'number', 'number', 'number'],
		[points.length, ptrPoints, rects.length, ptrRects]
	);
	Runtime.stackRestore(startStack);

	this.ptrMap = ptrMap;
};

/*
	C++ cleanup
 */
Logic.prototype.clearPathfinding = function() {
	Module.ccall('clear_pathfinding',
		'number',
		['number'],
		[this.ptrMap]
	);
	this.ptrMap = null;
};

})();
