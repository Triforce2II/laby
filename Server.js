var conf = require("./config.json");
var uuid = require("node-uuid");
var WebSocket = require("ws");
var WebSocketServer = require("ws").Server;
var myHttp = require("http");
var express = require("express");
var app = express();
var server = myHttp.createServer(app).listen(process.env.PORT || conf.port);
var playerLocations = {};
var tileWidth = 40;
var floorWidth = 600;
var tilesPerRow = floorWidth / tileWidth;
var walls = createLabyrinth(tilesPerRow, tilesPerRow);

app.use(express.static(__dirname + "/public"));

app.get("/", function(req, res) {
    res.sendfile(__dirname + "/public/index.html");
});

var wss = new WebSocketServer({
    server
});

wss.on('connection', function(ws) {
    const playerId = uuid.v4();

    ws.on('message', function(message) {
        var json = JSON.parse(message);
        if (json.type === 'position') {
            playerLocations[playerId] = json.data;
        } else if (json.type === 'finished') {
            wss.broadcast(message);
        }
        //console.log('received: %s', message);
    });

    ws.onclose = (event) => {
      delete playerLocations[playerId];

      wss.broadcast(JSON.stringify({
        type: 'playerDeleted',
        playerId
      }))
    }

    playerLocations[playerId] = {
        x: 0,
        y: 10,
        z: 0
    };

    ws.send(JSON.stringify({
        type: 'walls',
        playerId,
        data: walls
    }));
});

wss.broadcast = function broadcast(data) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};

setInterval(sendLocations, 10);

function sendLocations() {
    wss.broadcast(JSON.stringify({
        type: 'position',
        data: playerLocations
    }));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function erectWalls(width, height) {
    walls = [];
    for (var x = 0; x < width; x++) {
        walls[x] = [];
        for (var y = 0; y < height; y++) {
            walls[x][y] = [true, true, true, true, false, false];
            if (Math.random() > 0.8) {
                walls[x][y] = [true, true, true, true, true, false];
            }
        }
    }
    //walls[0][0][5] = true; zum testen
    walls[width - 1][height - 1][5] = true;
}

// checks if all four walls of the cell (x,y) are intact
function allWallsIntact(x, y) {
    return (walls[x][y][0] && walls[x][y][1] && walls[x][y][2] && walls[x][y][3]);
}

// removes the wall of cell (x,y) which is denoted by `direction'
// (where direction is between 0 and 3 for N, S, W, E - see above)
function tearDownWall(x, y, direction) {
    walls[x][y][direction] = false;
}

// builds a grid of walls (see above) and removes one of these walls
// in a loop until a labyrinth is finished; the labyrinth will consist
// of `width' * `height' cells
function createLabyrinth(width, height) {
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
    var maybeAddCandidate = function(xShift, yShift, to, from) {
        var newX = currentCell[0] + xShift;
        var newY = currentCell[1] + yShift;
        if (newX >= 0 && newX < width && newY >= 0 && newY < height &&
            allWallsIntact(newX, newY))
            candidates.push([newX, newY, to, from]);
    }
    while (visited < numberOfCells) {
        var candidates = [];
        maybeAddCandidate(-1, 0, 2, 3);
        maybeAddCandidate(1, 0, 3, 2);
        maybeAddCandidate(0, -1, 0, 1);
        maybeAddCandidate(0, 1, 1, 0);
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

console.log("Started server on port "  +  (process.env.PORT || conf.port));
