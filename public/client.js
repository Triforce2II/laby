document.addEventListener("DOMContentLoaded", init());

var playerId;
var playerHasTorch = false;
var playerOnMaps = new Map();
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
                playerId = json.playerId;
                initWalls();
            } else if (json.type === 'playerDeleted') {
                //remove player from scene
                console.log('received player delete msg', json.playerId);
                if (playerOnMaps.has(json.playerId)) {
                  console.log('delete player from scene');
                  scene.remove(playerOnMaps.get(json.playerId));
                  playerOnMaps.delete(json.playerId);
                }
            } else if (json.type === 'position') {
                let playerLocations = json.data;

                //add new players to scene
                for (const key of Object.keys(playerLocations)) {
                  let location = playerLocations[key];
                  //only display others players
                  if (playerId !== key) {
                    if (!playerOnMaps.has(key)) {
                      let geometry = new THREE.SphereGeometry(5, 32, 32);
                      let material = new THREE.MeshPhongMaterial({
                          color: 0xffff00,
                          specular: 0x111111,
                          shininess: 1
                      });
                      let sphere = new THREE.Mesh(geometry, material);
                      playerOnMaps.set(key, sphere);
                      scene.add(sphere);
                    }

                    let sphere = playerOnMaps.get(key);
                    sphere.position.x = location.x;
                    sphere.position.y = location.y;
                    sphere.position.z = location.z;
                  }
                }
            } else if (json.type === 'finished') {
                alert("Player: " + json.playerId + " has found the exit in " + json.seconds + " seconds!");
            }
            // else {
            //     console.log(json.data);
            // }
        } catch (e) {
            console.log('Error Message: ', e);
            return;
        }
    };
}

function initWalls() {
    var doorEnd;
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
    var controlsEnabled = false;
    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;
    var canJump = false;
    var sprint = false;
    var prevTime = performance.now();
    var velocity = new THREE.Vector3();
    var yAxis = new THREE.Vector3(0, 1, 0);

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

    function initMove() {
        var floorHeight = 1;
        var tileWidth = 40;
        var floorWidth = 600;
        var tilesPerRow = floorWidth / tileWidth;
        var wallHeight = 60;
        var wallWidth = 7;
        var loader = new THREE.TextureLoader();

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
        light = new THREE.PointLight(0x222211, 2, 75, 2);
        camera.add(light);
        controls = new THREE.PointerLockControls(camera);
        scene.add(controls.getObject());

        var onKeyDown = function(event) {
            switch (event.keyCode) {
                case 87:
                    moveForward = true;
                    break;
                case 65:
                    moveLeft = true;
                    break;
                case 83:
                    moveBackward = true;
                    break;
                case 68:
                    moveRight = true;
                    break;
                case 16:
                    sprint = true;
                    break;
            }
        };

        var onKeyUp = function(event) {
            switch (event.keyCode) {
                case 87:
                    moveForward = false;
                    break;
                case 65:
                    moveLeft = false;
                    break;
                case 83:
                    moveBackward = false;
                    break;
                case 68:
                    moveRight = false;
                    break;
                case 16:
                    sprint = false;
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);

        raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);
        geometry = new THREE.PlaneGeometry(tileWidth*tilesPerRow, tileWidth*tilesPerRow, 100, 100);
        geometry.rotateX(-Math.PI / 2);

        var floorTexture = loader.load('textures/floor.jpg');
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(tilesPerRow, tilesPerRow);
        floorTexture.anisotropy = 16;

        material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: floorTexture,
            specular: 0x111111,
            shininess: 1
        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = (tileWidth*tilesPerRow/2) - (tileWidth/2) ;
        mesh.position.z = (tileWidth*tilesPerRow/2) - (tileWidth/2);
        scene.add(mesh);

        var wallErected = {};
        var wallGeometryX = new THREE.BoxGeometry(tileWidth, wallHeight, wallWidth);
        var wallGeometryZ = new THREE.BoxGeometry(wallWidth, wallHeight, tileWidth);
        var wallTexture = loader.load('textures/wall.jpg');
        wallTexture.anisotropy = 16;
        var wallMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: wallTexture,
            specular: 0x111111,
            shininess: 1
        });

        var torchGeometry = new THREE.BoxGeometry(1, 5, 1);
        var torchTexture = loader.load('textures/torch.jpg');
        torchTexture.anisotropy = 16;
        var torchMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: torchTexture,
            specular: 0x111111,
            shininess: 1
        });

        var doorGeometryX = new THREE.BoxGeometry(tileWidth / 4, (wallHeight / 2) - 6, wallWidth + 2);
        var doorGeometryZ = new THREE.BoxGeometry(wallWidth + 2, (wallHeight / 2) - 6, tileWidth / 4);
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
                        doorEnd = new THREE.Mesh(doorGeometryX, doorMaterial);
                        doorEnd.position.x = x1;
                        doorEnd.position.z = z1 - tileWidth / 2;
                        doorEnd.position.y = (wallHeight / 2) - 18;
                        scene.add(doorEnd);
                    }
                } else if (z1 < z2) {
                    wall = new THREE.Mesh(wallGeometryZ, wallMaterial);
                    wall.position.x = x1 - tileWidth / 2;
                    wall.position.z = z1;
                    if (labyWalls[i][j][5]) {
                        labyWalls[i][j][5] = false;
                        doorEnd = new THREE.Mesh(doorGeometryZ, doorMaterial);
                        doorEnd.position.x = x1 - tileWidth / 2;
                        doorEnd.position.z = z1;
                        doorEnd.position.y = (wallHeight / 2) - 18;
                        scene.add(doorEnd);
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
            console.log("Created torch", torch);
        }

        for (var i = 0; i < tilesPerRow; i++) {
            var x = i * tileWidth;
            for (var j = 0; j < tilesPerRow; j++) {
                var z = j * tileWidth;
                if (labyWalls[i][j][0])
                    //Norden
                    maybeErectWall(x, z, x + tileWidth, z, i, j);
                if (labyWalls[i][j][1])
                    //Süden
                    maybeErectWall(x, z + tileWidth, x + tileWidth, z + tileWidth, i, j);
                if (labyWalls[i][j][2])
                    //Westen
                    maybeErectWall(x, z, x, z + tileWidth, i, j);
                if (labyWalls[i][j][3])
                    //Osten
                    maybeErectWall(x + tileWidth, z, x + tileWidth, z + tileWidth, i, j);
                if (labyWalls[i][j][4]) {
                    //Torch
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

            if (sprint) multi = 2;
            if (moveForward) velocity.z -= 400.0 * delta * multi;
            if (moveBackward) velocity.z += 400.0 * delta * multi;
            if (moveLeft) velocity.x -= 400.0 * delta * multi;
            if (moveRight) velocity.x += 400.0 * delta * multi;

            var nextPosition = controls.getObject().clone();
            nextPosition.translateX(velocity.x * delta);
            nextPosition.translateY(velocity.y * delta);
            nextPosition.translateZ(velocity.z * delta);
            var directionToNextPos = new THREE.Vector3();
            directionToNextPos.subVectors(nextPosition.position, camera.getWorldPosition()).normalize();
            raycaster.set(camera.getWorldPosition(), directionToNextPos);

            // Debugging arrow welche die Richtung anzeigt
            // if ( arrow )
            // scene.remove ( arrow );
            // arrow = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 10, 0xffffff );
            // scene.add( arrow );

            // berechne die sich schneidenen Objecte mit dem picking ray
            var intersects = raycaster.intersectObjects(objects);

            for (var i = 0; i < intersects.length; i++) {
                // Debug farbe um die sich schneidenen Objekte zu sehen
                // intersects[ i ].object.material.color.set(Math.random() * 0xffffff);
                velocity.x = 0;
                velocity.z = 0;
            }

            // Check door collision
            if (doorEnd) {
                if (raycaster.intersectObject(doorEnd).length > 0) {
                    scene.remove(doorEnd);
                    doorEnd = undefined;
                    connection.send(JSON.stringify({
                        type: 'finished',
                        playerId: playerId,
                        seconds: seconds
                    }));
                }
            }

            // Check torch collision
            raycaster.far = 10;
            for (let i = 0; i < 100; ++i) {
              raycaster.ray.origin.y = 0;
              raycaster.ray.direction = directionToNextPos.clone().applyAxisAngle(yAxis, Math.PI / 4 - Math.PI / 2 * i / 100);
              raycaster.ray.direction.y = 0;
              for (let collision of raycaster.intersectObjects(torches)) {
                  let torch = collision.object;
                  torches = torches.filter(t => t.uuid !== torch.uuid);
                  scene.remove(torch);
                  if (!playerHasTorch) {
                      camera.remove(light);
                      playerHasTorch = true;
                      light.color.setHex(0xE25822);
                      light.distance = 150;
                      camera.add(light);
                  }
              }
            }
            raycaster.far = 10;

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

            if (velocity.x > 0 || velocity.y > 0 || velocity.z > 0) {
              connection.send(JSON.stringify({
                  type: 'position',
                  playerId,
                  data: {
                      x: controls.getObject().position.x.toFixed(1),
                      y: controls.getObject().position.y.toFixed(1),
                      z: controls.getObject().position.z.toFixed(1)
                  }
              }));
            }

            prevTime = time;
        }
        renderer.render(scene, camera);
    }
}
