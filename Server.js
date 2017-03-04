/**
 * @author Kai Hartel (Github: Triforce2II)
 */
const path = require('path');
const conf = require('./config.json');
const uuid = require('node-uuid');
const WebSocket = require('ws');
const myHttp = require('http');
const express = require('express');

const WebSocketServer = WebSocket.Server;
const app = express();
const server = myHttp.createServer(app).listen(process.env.PORT || conf.port);
const playerLocations = {};
const tileWidth = 40;
const floorWidth = 600;
const tilesPerRow = floorWidth / tileWidth;

var walls = createLabyrinth(tilesPerRow, tilesPerRow);

app.use(express.static(path.join(__dirname, 'public')));

const wss = new WebSocketServer({
    server
});

wss.on('connection', (ws) => {
    const playerId = uuid.v4();

    ws.on('message', (message) => {
        const json = JSON.parse(message);
        if (json.type === 'position') {
            playerLocations[playerId] = json.data;
        } else if (json.type === 'finished') {
            walls = createLabyrinth(tilesPerRow, tilesPerRow);
            for (let i = 0; i < playerLocations.length; ++i) {
                playerLocations[i].x = 0;
                playerLocations[i].z = 0;
            }
            wss.broadcast(JSON.stringify({
                type: json.type,
                playerId: json.playerId,
                playerLocations: playerLocations,
                seconds: json.seconds,
                walls: walls
            }));
        }
        //console.log('received: %s', message);
    });

    ws.onclose = () => {
        delete playerLocations[playerId];

        wss.broadcast(JSON.stringify({
            type: 'playerDeleted',
            playerId
        }));
    };

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
    for (let x = 0; x < width; ++x) {
        walls[x] = [];
        for (let y = 0; y < height; ++y) {
            walls[x][y] = [true, true, true, true, false, false, false];
            if (Math.random() > 0.9) {
                walls[x][y] = [true, true, true, true, true, false, false];
            } else if (Math.random() > 0.95) {
                walls[x][y] = [true, true, true, true, false, false, true];
            }
        }
    }
    //walls[0][0][5] = true; zum testen
    walls[width - 1][height - 1][5] = true;
}

function allWallsIntact(x, y) {
    return (walls[x][y][0] && walls[x][y][1] && walls[x][y][2] && walls[x][y][3]);
}

//direction: 0=oben, 1=unten, 2=links, 3=rechts
function tearDownWall(x, y, direction) {
    walls[x][y][direction] = false;
}

function createLabyrinth(width, height) {
    erectWalls(width, height);
    const cellStack = [];
    const numberOfCells = width * height;
    let currentCell = [ //random Zelle wird ausgesucht
        randomInt(0, width),
        randomInt(0, height)
    ];
    let visited = 1;
    let candidates;

    const maybeAddCandidate = (xShift, yShift, to, from) => {
        const newX = currentCell[0] + xShift;
        const newY = currentCell[1] + yShift;
        if (newX >= 0 && newX < width && newY >= 0 && newY < height && allWallsIntact(newX, newY))
            candidates.push([newX, newY, to, from]);
    };

    while (visited < numberOfCells) {
        candidates = [];
        maybeAddCandidate(-1, 0, 2, 3); //links
        maybeAddCandidate(1, 0, 3, 2); //rechts
        maybeAddCandidate(0, -1, 0, 1); //oben
        maybeAddCandidate(0, 1, 1, 0); //unten
        if (candidates.length > 0) {
            const candidate = candidates[randomInt(0, candidates.length)];
            tearDownWall(currentCell[0], currentCell[1], candidate[2]);
            tearDownWall(candidate[0], candidate[1], candidate[3]);
            cellStack.push(currentCell);
            currentCell = [candidate[0], candidate[1]];
            visited += 1;
        } else {
            currentCell = cellStack.pop();
        }
    }
    return walls;
}

console.log(`Started server on port ${(process.env.PORT || conf.port)}`);
