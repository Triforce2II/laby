document.addEventListener("DOMContentLoaded", init());

function init() {
    window.WebSocket = window.WebSocket;

    var connection = new WebSocket('ws://127.0.0.1:8080');

    connection.onopen = function() {
        // connection is opened and ready to use
    };

    connection.onerror = function(error) {
        // an error occurred when sending/receiving data
    };

    connection.onmessage = function(message) {
        try {
            var json = JSON.parse(message.data);
        } catch (e) {
            console.log('This doesn\'t look like a valid JSON: ', message.data);
            return;
        }
    };

    // Copyright (c) 2015, Dr. Edmund Weitz.  All rights reserved.

    // global array which holds a four-element array per x/y coordinate
    // pair where the four values are booleans for the North, South, West,
    // and East (in this order) walls
    var walls;

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    // sets up the array `walls'
    function erectWalls(width, height) {
        walls = [];
        for (var x = 0; x < width; x++) {
            walls[x] = [];
            for (var y = 0; y < height; y++)
                walls[x][y] = [true, true, true, true];
        }

        var jo = 0;
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

    var camera, scene, renderer;
    var geometry, material, mesh;
    var controls;

    var objects = [];

    var raycaster;

    var blocker = document.getElementById('blocker');
    var instructions = document.getElementById('instructions');

    var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

    if (havePointerLock) {
        var element = document.body;
        var pointerlockchange = function(event) {
            if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
                controlsEnabled = true;
                controls.enabled = true;
                blocker.style.display = 'none';
            } else {
                controls.enabled = false;
                blocker.style.display = '-webkit-box';
                blocker.style.display = '-moz-box';
                blocker.style.display = 'box';

                instructions.style.display = '';
            }
        };

        var pointerlockerror = function(event) {
            instructions.style.display = '';
        };

        // Hook pointer lock state change events
        document.addEventListener('pointerlockchange', pointerlockchange, false);
        document.addEventListener('mozpointerlockchange', pointerlockchange, false);
        document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

        document.addEventListener('pointerlockerror', pointerlockerror, false);
        document.addEventListener('mozpointerlockerror', pointerlockerror, false);
        document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

        instructions.addEventListener('click', function(event) {
            instructions.style.display = 'none';
            // Ask the browser to lock the pointer
            element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
            element.requestPointerLock();
        }, false);
    } else {
        instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
    }

    init();
    animate();

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    var controlsEnabled = false;

    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;
    var canJump = false;
    var sprint = false;

    var prevTime = performance.now();
    var velocity = new THREE.Vector3();
    var mouse = new THREE.Vector2();

    function onMouseMove( event ) {

    	// calculate mouse position in normalized device coordinates
    	// (-1 to +1) for both components

    	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    }

    function init() {
        var floorHeight = 1;
        var tileWidth = 40;
        var floorWidth = 600;
        var tilesPerRow = floorWidth / tileWidth;
        var wallHeight = 60;
        var wallWidth = 7;

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);

        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x000000, 0, 100);

        var light = new THREE.PointLight( 0xffffff, 0.6, 200, 2 );
        camera.add(light);

        controls = new THREE.PointerLockControls(camera);
        scene.add(controls.getObject());

        var onKeyDown = function(event) {
            switch (event.keyCode) {
                case 38: // up
                case 87: // w
                    moveForward = true;
                    break;

                case 37: // left
                case 65: // a
                    moveLeft = true;
                    break;

                case 40: // down
                case 83: // s
                    moveBackward = true;
                    break;

                case 39: // right
                case 68: // d
                    moveRight = true;
                    break;

                case 32: // space
                    if (canJump === true) velocity.y += 250;
                    canJump = false;
                    break;
                case 16:
                    sprint = true;
                    break;
            }
        };

        var onKeyUp = function(event) {
            switch (event.keyCode) {

                case 38: // up
                case 87: // w
                    moveForward = false;
                    break;

                case 37: // left
                case 65: // a
                    moveLeft = false;
                    break;

                case 40: // down
                case 83: // s
                    moveBackward = false;
                    break;

                case 39: // right
                case 68: // d
                    moveRight = false;
                    break;

                case 16:
                    sprint = false;
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);
        window.addEventListener( 'mousemove', onMouseMove, false );

        this.rays = [
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(1, 0, 1),
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(1, 0, -1),
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(-1, 0, -1),
          new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(-1, 0, 1),
          new THREE.Vector3(0, -1, 0)
        ];

        raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

        // floor

        geometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
        geometry.rotateX(-Math.PI / 2);

        for (var i = 0, l = geometry.vertices.length; i < l; i++) {
            var vertex = geometry.vertices[i];
            vertex.x += Math.random() * 20 - 10;
            vertex.y += Math.random() * 2;
            vertex.z += Math.random() * 20 - 10;
        }

        for (var i = 0, l = geometry.faces.length; i < l; i++) {
            var face = geometry.faces[i];
            face.vertexColors[0] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, 0.1);
            face.vertexColors[1] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, 0.1);
            face.vertexColors[2] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, 0.1);
        }

        material = new THREE.MeshBasicMaterial({
            vertexColors: THREE.VertexColors
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // objects

        geometry = new THREE.BoxGeometry(20, 20, 20);

        for (var i = 0, l = geometry.faces.length; i < l; i++) {
            var face = geometry.faces[i];
            face.vertexColors[0] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
            face.vertexColors[1] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
            face.vertexColors[2] = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
        }

        // create the labyrinth
        var labyWalls = createLabyrinth(tilesPerRow, tilesPerRow);
        // a hash table to remember which walls are already there because
        // `labyWalls' will mention walls twice - e.g. as the "north" wall
        // of one cell and as the "south" wall of its northern neighbor
        var wallErected = {};
        // the geometries of the wall pieces, depending on their orientation
        var wallGeometryX = new THREE.BoxGeometry(tileWidth + wallWidth, wallHeight, wallWidth);
        var wallGeometryZ = new THREE.BoxGeometry(wallWidth, wallHeight, tileWidth + wallWidth);

        var wallMaterial = new THREE.MeshPhongMaterial({
            specular: 0xffffff,
            shading: THREE.FlatShading,
            vertexColors: THREE.VertexColors
        });

        // function to add one wall piece - extending from (x1,z1) to
        // (x2,z2) - to `floor'; it is assumed that either `x1' equals `x2'
        // or `z1' equals `z2'
        function maybeErectWall(x1, z1, x2, z2) {
            // the key for the hash table mentioned above
            var key = x1 + ',' + z1 + ',' + x2 + ',' + z2;
            if (!wallErected[key]) {
                wallErected[key] = true;
                var wall;
                if (x1 < x2) {
                    wall = new THREE.Mesh(wallGeometryX, wallMaterial);
                    wall.position.x = x1;
                    // shift a bit so that wall pieces are centered on the lines
                    // dividing wooden tiles
                    wall.position.z = z1 - tileWidth / 2;
                } else if (z1 < z2) {
                    wall = new THREE.Mesh(wallGeometryZ, wallMaterial);
                    wall.position.x = x1 - tileWidth / 2;
                    wall.position.z = z1;
                }
                //wall.position.y = (wallHeight + floorHeight) / 2;
                //wall.castShadow = true;
                //wall.receiveShadow = true;
                scene.add(wall);
                objects.push(wall);
            }
        }

        // loop through all cells of the labyrinth and translate the
        // information into gray wall pieces; also add all missing wooden
        // tiles (i.e. all except the first one which is `floor')
        for (var i = 0; i < tilesPerRow; i++) {
            var x = i * tileWidth;
            for (var j = 0; j < tilesPerRow; j++) {
                var z = j * tileWidth;
                if (labyWalls[i][j][0])
                    // "north"
                    maybeErectWall(x, z, x + tileWidth, z);
                if (labyWalls[i][j][1])
                    // "south"
                    maybeErectWall(x, z + tileWidth, x + tileWidth, z + tileWidth);
                if (labyWalls[i][j][2])
                    // "west"
                    maybeErectWall(x, z, x, z + tileWidth);
                if (labyWalls[i][j][3])
                    // "east"
                    maybeErectWall(x + tileWidth, z, x + tileWidth, z + tileWidth);
            }
        }

        renderer = new THREE.WebGLRenderer();
        renderer.setClearColor(0x000000);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        window.addEventListener('resize', onWindowResize, false);
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        requestAnimationFrame(animate);

        if (controlsEnabled) {
            raycaster.ray.origin.copy(controls.getObject().position);
            raycaster.ray.origin.y -= 10;

            var intersections = raycaster.intersectObjects(objects);

            var isOnObject = intersections.length > 0;

            var time = performance.now();
            var delta = (time - prevTime) / 1000;
            var multi = 1;

            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

            if (sprint) multi = 2;
            if (moveForward) velocity.z -= 400.0 * delta * multi;
            if (moveBackward) velocity.z += 400.0 * delta * multi;

            if (moveLeft) velocity.x -= 400.0 * delta * multi;
            if (moveRight) velocity.x += 400.0 * delta * multi;

            if (isOnObject === true) {
                velocity.y = Math.max(0, velocity.y);

                canJump = true;
            }

            raycaster.setFromCamera( mouse, camera );

            // calculate objects intersecting the picking ray
          	var intersects = raycaster.intersectObjects( objects );

          	for ( var i = 0; i < intersects.length; i++ ) {

          		// intersects[ i ].object.material.color.set( 0xff0000 );
              velocity.x = 0;
              velocity.z = 0;
          	}


            controls.getObject().translateX(velocity.x * delta);
            controls.getObject().translateY(velocity.y * delta);
            controls.getObject().translateZ(velocity.z * delta);


            if (controls.getObject().position.y < 10) {
                velocity.y = 0;
                controls.getObject().position.y = 10;

                canJump = true;
            }
            prevTime = time;
        }
        renderer.render(scene, camera);
    }
}
