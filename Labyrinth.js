// Copyright (c) 2015, Dr. Edmund Weitz.  All rights reserved.

// global array which holds a four-element array per x/y coordinate
// pair where the four values are booleans for the North, South, West,
// and East (in this order) walls
var walls;

// sets up the array `walls'
function erectWalls (width, height) {
  walls = [];
  for (var x = 0; x < width; x++) {
    walls[x] = [];
    for (var y = 0; y < height; y++)
      walls[x][y] = [true, true, true, true];
  }
}

// checks if all four walls of the cell (x,y) are intact
function allWallsIntact (x, y) {
  return (walls[x][y][0] && walls[x][y][1] && walls[x][y][2] && walls[x][y][3]);
}

// removes the wall of cell (x,y) which is denoted by `direction'
// (where direction is between 0 and 3 for N, S, W, E - see above)
function tearDownWall (x, y, direction) {
  walls[x][y][direction] = false;
}

// builds a grid of walls (see above) and removes one of these walls
// in a loop until a labyrinth is finished; the labyrinth will consist
// of `width' * `height' cells
function createLabyrinth (width, height) {
  erectWalls(width, height);
  // for the algorithm see
  // http://en.wikipedia.org/wiki/Maze_generation_algorithm
  var cellStack = [];
  var numberOfCells = width * height;
  // `currentCell' is a two-element array holding the x and y
  // coordinates of the cell we're currently working on
  var currentCell = [
    randomInt(0, width),
    randomInt(0, height)
  ];
  var visited = 1;

  // in a loop, check if a specific neighbor of the current cell still
  // has all four walls up and if so add this neighbor to
  // `candidates'; the neighbor is specified by `xShift', `yShift' one
  // of which is zero while the other is either -1 or 1; each entry
  // added to `candidates' is a four-element array with the
  // coordinates of the neighbor and the directions (NSWE, see above)
  // of the removed walls in the current cell and the neighbor
  var maybeAddCandidate = function (xShift, yShift, to, from) {
    var newX = currentCell[0] + xShift;
    var newY = currentCell[1] + yShift;
    if (newX >= 0 && newX < width && newY >=0 && newY < height
        && allWallsIntact(newX, newY))
      candidates.push([newX, newY, to, from]);
  }
  while (visited < numberOfCells) {
    var candidates = [];
    maybeAddCandidate(-1,  0, 2, 3);
    maybeAddCandidate( 1,  0, 3, 2);
    maybeAddCandidate( 0, -1, 0, 1);
    maybeAddCandidate( 0,  1, 1, 0);
    if (candidates.length > 0) {
      var candidate = candidates[randomInt(0, candidates.length)];
      tearDownWall(currentCell[0], currentCell[1], candidate[2]);
      tearDownWall(candidate[0], candidate[1], candidate[3]);
      cellStack.push(currentCell);
      currentCell = [candidate[0], candidate[1]];
      visited++;
    } else {
      currentCell = cellStack.pop();
    }
  }
  return walls;
}
