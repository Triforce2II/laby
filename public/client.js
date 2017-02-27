document.addEventListener("DOMContentLoaded", init());

var player;
var playerHasTorch = false;
var players = 0;
var playerLocations;
var playerOnMaps = [];
var labywalls;
var connection;
var scene = new THREE.Scene();

var seconds = 0;
var timer = setInterval(function() {
    ++seconds
}, 1000);

function init() {
    window.WebSocket = window.WebSocket;
    connection = new WebSocket('ws://' + window.location.host);

    connection.onopen = function() {
        // connection is opened and ready to use
    };

    connection.onerror = function(error) {
        // an error occurred when sending/receiving data
    };

    connection.onmessage = function(message) {
        try {
            var json = JSON.parse(message.data);
            if (json.type === 'walls') {
                labyWalls = json.data;
                player = json.player;
                playerLocations = json.location;
                initWalls();
            } else if (json.type === 'position') {
                playerLocations = json.data;

                console.log(message);
                var i = Object.keys(playerLocations).length;
                while (players < i) {
                    ++players;
                    var geometry = new THREE.SphereGeometry(5, 32, 32);
                    var material = new THREE.MeshPhongMaterial({
                        color: 0xffff00,
                        specular: 0x111111,
                        shininess: 1
                    });
                    var sphere = new THREE.Mesh(geometry, material);
                    playerOnMaps.push(sphere);
                    scene.add(sphere);
                }
            } else if (json.type === 'finished') {
                alert("Player: " + json.player + " has found the exit in " + json.seconds + " seconds!");
            } else {
                console.log(json.data);
            }
        } catch (e) {
            console.log('Error Message: ', e);
            return;
        }
    };
}

function initWalls() {
    var doorEnd = [];
    var camera, renderer;
    var geometry, material, mesh;
    var controls;
    var objects = [];
    var torches = [];
    var light;
    var raycaster;
    var arrow;
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

    initMove();
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

    function initMove() {
        var floorHeight = 1;
        var tileWidth = 40;
        var floorWidth = 600;
        var tilesPerRow = floorWidth / tileWidth;
        var wallHeight = 60;
        var wallWidth = 7;
        var loader = new THREE.TextureLoader();

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
        //scene.fog = new THREE.Fog(0x000000, 0, 100);

        light = new THREE.PointLight(0x222211, 2, 75, 2);
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
                    if (canJump === true) velocity.y += 100;
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
        geometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
        geometry.rotateX(-Math.PI / 2);

        var floorTexture = loader.load('textures/floor.jpg');
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(100, 100);
        floorTexture.anisotropy = 16;

        material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: floorTexture,
            specular: 0x111111,
            shininess: 1
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

        // a hash table to remember which walls are already there because
        // `labyWalls' will mention walls twice - e.g. as the "north" wall
        // of one cell and as the "south" wall of its northern neighbor
        var wallErected = {};
        // the geometries of the wall pieces, depending on their orientation
        var wallGeometryX = new THREE.BoxGeometry(tileWidth, wallHeight, wallWidth);
        var wallGeometryZ = new THREE.BoxGeometry(wallWidth, wallHeight, tileWidth);
        var torchGeometry = new THREE.BoxGeometry(1, 5, 1);
        var doorGeometryX = new THREE.BoxGeometry(tileWidth / 4, (wallHeight / 2) - 6, wallWidth + 2);
        var doorGeometryZ = new THREE.BoxGeometry(wallWidth + 2, (wallHeight / 2) - 6, tileWidth / 4);

        var wallTexture = loader.load('textures/wall.jpg');
        wallTexture.wrapS = THREE.RepeatWrapping;
        wallTexture.wrapT = THREE.RepeatWrapping;
        wallTexture.repeat.set(1, 1);
        wallTexture.anisotropy = 16;

        var wallMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: wallTexture,
            specular: 0x111111,
            shininess: 1
        });

        var torchTexture = loader.load('textures/torch.jpg');
        torchTexture.anisotropy = 16;

        var torchMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: torchTexture,
            specular: 0x111111,
            shininess: 1
        });

        var doorTexture = loader.load('textures/door.jpg');
        doorTexture.anisotropy = 16;

        var doorMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: doorTexture,
            specular: 0x111111,
            shininess: 1
        });

        // function to add one wall piece - extending from (x1,z1) to
        // (x2,z2) - to `floor'; it is assumed that either `x1' equals `x2'
        // or `z1' equals `z2'
        function maybeErectWall(x1, z1, x2, z2, i, j) {
            // the key for the hash table mentioned above
            var key = x1 + ',' + z1 + ',' + x2 + ',' + z2;
            if (!wallErected[key]) {
                wallErected[key] = true;
                var wall;
                if (x1 < x2) {
                    wall = new THREE.Mesh(wallGeometryX, wallMaterial);
                    wall.position.x = x1;
                    wall.position.z = z1 - tileWidth / 2;
                    if (labyWalls[i][j][5]) {
                        labyWalls[i][j][5] = false;
                        var door = new THREE.Mesh(doorGeometryX, doorMaterial);
                        door.position.x = x1;
                        door.position.z = z1 - tileWidth / 2;
                        door.position.y = (wallHeight / 2) - 18;
                        scene.add(door);
                        doorEnd.push(door);
                    }
                } else if (z1 < z2) {
                    wall = new THREE.Mesh(wallGeometryZ, wallMaterial);
                    wall.position.x = x1 - tileWidth / 2;
                    wall.position.z = z1;
                    if (labyWalls[i][j][5]) {
                        labyWalls[i][j][5] = false;
                        var door = new THREE.Mesh(doorGeometryZ, doorMaterial);
                        door.position.x = x1 - tileWidth / 2;
                        door.position.z = z1;
                        door.position.y = (wallHeight / 2) - 18;
                        scene.add(door);
                        doorEnd.push(door);
                    }
                }
                scene.add(wall);
                objects.push(wall);
            }
        }

        function placeTorch(x, z) {
            var torch = new THREE.Mesh(torchGeometry, torchMaterial);
            torch.position.x = x;
            torch.position.z = z;
            torch.position.y = 2;
            scene.add(torch);
            torches.push(torch);
        }

        // loop through all cells of the labyrinth and translate the
        // information into gray wall pieces; also add all missing wooden
        // tiles (i.e. all except the first one which is `floor')
        for (var i = 0; i < tilesPerRow; i++) {
            var x = i * tileWidth;
            for (var j = 0; j < tilesPerRow; j++) {
                var z = j * tileWidth;
                if (labyWalls[i][j][0])
                    //north
                    maybeErectWall(x, z, x + tileWidth, z, i, j);
                if (labyWalls[i][j][1])
                    //south
                    maybeErectWall(x, z + tileWidth, x + tileWidth, z + tileWidth, i, j);
                if (labyWalls[i][j][2])
                    //west
                    maybeErectWall(x, z, x, z + tileWidth, i, j);
                if (labyWalls[i][j][3])
                    //east
                    maybeErectWall(x + tileWidth, z, x + tileWidth, z + tileWidth, i, j);
                if (labyWalls[i][j][4]) {
                    //torch
                    placeTorch(x, z);
                }
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

            raycaster.ray.origin.copy(controls.getObject().position);
            raycaster.ray.origin.y -= 10;

            var intersections = raycaster.intersectObjects(objects);
            var intersectTorches = raycaster.intersectObjects(torches);
            var intersectDoor = raycaster.intersectObjects(doorEnd);
            var isOnObject = intersections.length > 0;

            if (isOnObject === true) {
              velocity.y = Math.max(0, velocity.y);
              canJump = true;
            }

            raycaster.set(camera.getWorldPosition(), camera.getWorldDirection());
            raycaster.ray.direction.y = 0;

            // TODO: stop moving when looking upwards.. awkward glitch ;D
            let yAxis = new THREE.Vector3(0, 1, 0);
            // rotate direction vector depending on movement
            if (moveLeft && moveForward) {
              raycaster.ray.direction.applyAxisAngle(yAxis, Math.PI / 4);
            } else if (moveLeft && moveBackward) {
              raycaster.ray.direction.applyAxisAngle(yAxis, Math.PI - Math.PI / 4);
            } else if (moveRight && moveForward) {
              raycaster.ray.direction.applyAxisAngle(yAxis, (2 * Math.PI) - (Math.PI / 4));
            } else if (moveRight && moveBackward) {
              raycaster.ray.direction.applyAxisAngle(yAxis, Math.PI + Math.PI / 4);
            } else if (moveLeft) {
              raycaster.ray.direction.applyAxisAngle(yAxis, Math.PI / 2);
            } else if (moveRight) {
              raycaster.ray.direction.applyAxisAngle(yAxis, Math.PI + Math.PI / 2);
            }else if (moveBackward) {
              raycaster.ray.direction.applyAxisAngle(yAxis, Math.PI);
            }

            // Debugging arrow which shows direction
            // if (arrow)
            //   scene.remove ( arrow );
            // arrow = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 10, 0xffffff );
            // scene.add( arrow );

            // calculate objects intersecting the picking ray
            var intersects = raycaster.intersectObjects(objects);

            for (var i = 0; i < intersects.length; i++) {
                // Debug color switching to see collision
                // intersects[ i ].object.material.color.set(Math.random() * 0xffffff);
                velocity.x = 0;
                velocity.z = 0;
            }

            for (var i = 0; i < intersectTorches.length; i++) {
                scene.remove(intersectTorches[i].object);
                if (!playerHasTorch) {
                    camera.remove(light);
                    playerHasTorch = true;
                    light.color.setHex(0xE25822);
                    light.distance = 150;
                    camera.add(light);
                }
            }

            /*if (intersectDoor.lenth > 0) {
                scene.remove(intersectDoor[0].object);
            }*/
            if (intersectDoor.length >= 1) {
                scene.remove(intersectDoor[0].object);
                connection.send(JSON.stringify({
                    type: 'finished',
                    player: player,
                    seconds: seconds
                }));

            }

            if (light.distance > 10 && playerHasTorch) {
                camera.remove(light);
                light.distance -= 0.05;
                camera.add(light);
            } else if (light.distance < 75) {
                playerHasTorch = false;
                camera.remove(light);
                light.distance += 1;
                light.color.setHex(0x222211);
                camera.add(light);
            }

            controls.getObject().translateX(velocity.x * delta);
            controls.getObject().translateY(velocity.y * delta);
            controls.getObject().translateZ(velocity.z * delta);

            if (controls.getObject().position.y < 10) {
                velocity.y = 0;
                controls.getObject().position.y = 10;
                canJump = true;
            }

            var x = controls.getObject().position.x.toFixed(1);
            var y = controls.getObject().position.y.toFixed(1);
            var z = controls.getObject().position.z.toFixed(1);
            var count = 0;

            for (var i = 0; i < Object.keys(playerOnMaps).length; ++i) {
                playerOnMaps[i].position.x = playerLocations[i].x;
                playerOnMaps[i].position.y = playerLocations[i].y;
                playerOnMaps[i].position.z = playerLocations[i].z;
                ++count;
            }

            if (x != playerLocations[player].x ||
                y != playerLocations[player].y ||
                z != playerLocations[player].z) {
                  connection.send(JSON.stringify({
                      type: 'position',
                      player: player,
                      data: {
                          x: x,
                          y: y,
                          z: z
                      }
                  }));
            }
            prevTime = time;
        }
        renderer.render(scene, camera);
    }
}
