var playerId;
var playerHasTorch = false;
var connection;
var seconds = 0;
setInterval(() => {
    seconds += 1;
}, 1000);
var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var sprint = false;
var throwCrumbs = false;
var wasInitOnce;
var doorEnd;
var renderer;
var controls;
var walls;
var wallObjects = [];
var torches = [];
var crumbsInHand = 0;
var crumbBoxes = [];
var crumbs = [];
var controlsEnabled = false;
var prevTime = performance.now();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
const light = new THREE.PointLight(0x222211, 2, 75, 2);
const playerOnMaps = new Map();
const scene = new THREE.Scene();
const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const crumbsLeft = document.getElementById('crumbsLeft');
const havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
const velocity = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
document.addEventListener('DOMContentLoaded', initWebsocket());

function initWebsocket() {
    window.WebSocket = window.WebSocket;
    connection = new WebSocket('ws://' + window.location.host);

    connection.onopen = () => {
        crumbsLeft.innerHTML = 'crumbs left: ' + crumbsInHand;
    };

    connection.onerror = (error) => {
        console.out(error);
    };

    connection.onmessage = (message) => {
        try {
            const json = JSON.parse(message.data);
            if (json.type === 'walls') {
                walls = json.data;
                playerId = json.playerId;
                init();
            } else if (json.type === 'playerDeleted') {
                //entferne Spieler von der scene
                console.log('received player delete msg', json.playerId);
                if (playerOnMaps.has(json.playerId)) {
                    console.log('delete player from scene');
                    scene.remove(playerOnMaps.get(json.playerId));
                    playerOnMaps.delete(json.playerId);
                }
            } else if (json.type === 'position') {
                const playerLocations = json.data;

                //neuen Spieler der scene hinzufügen
                for (const key of Object.keys(playerLocations)) {
                    const location = playerLocations[key];
                    //nur andere Spieler anzeigen
                    if (playerId !== key) {
                        if (!playerOnMaps.has(key)) {
                            const geometry = new THREE.SphereGeometry(5, 32, 32);
                            const material = new THREE.MeshPhongMaterial({
                                color: 0xffff00,
                                specular: 0x111111,
                                shininess: 1
                            });
                            const sphere = new THREE.Mesh(geometry, material);
                            playerOnMaps.set(key, sphere);
                            scene.add(sphere);
                        }

                        const sphere = playerOnMaps.get(key);
                        sphere.position.x = location.x;
                        sphere.position.y = location.y;
                        sphere.position.z = location.z;
                    }
                }
            } else if (json.type === 'finished') {
                alert('Player: ' + json.playerId + ' has found the exit in ' + json.seconds + ' seconds!');
                moveForward = false;
                moveBackward = false;
                moveLeft = false;
                moveRight = false;
                sprint = false;
                velocity.x = 0;
                velocity.z = 0;
                controls.getObject().position.x = 0;
                controls.getObject().position.z = 0;
                playerLocations = json.playerLocations;
                for (const wall of wallObjects) {
                    scene.remove(wall);
                }
                for (const torch of torches) {
                    scene.remove(torch);
                }
                for (const box of crumbBoxes) {
                    scene.remove(box);
                }
                for (const crumb of crumbs) {
                    scene.remove(crumb);
                }
                walls = json.walls;
                wallObjects = [];
                crumbs = [];
                init();
            }
        } catch (e) {
            console.log('Error Message: ', e);
        }
    };
}

function init() {
    if (havePointerLock) {
        const element = document.body;
        const pointerlockchange = () => {
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
        const pointerlockerror = () => {
            instructions.style.display = '';
        };

        document.addEventListener('pointerlockchange', pointerlockchange, false);
        document.addEventListener('mozpointerlockchange', pointerlockchange, false);
        document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

        document.addEventListener('pointerlockerror', pointerlockerror, false);
        document.addEventListener('mozpointerlockerror', pointerlockerror, false);
        document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

        instructions.addEventListener('click', () => {
            instructions.style.display = 'none';
            element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
            element.requestPointerLock();
        }, false);
    } else {
        instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
    }

    initWalls();

    function initWalls() {
        const tileWidth = 40;
        const floorWidth = 600;
        const tilesPerRow = floorWidth / tileWidth;
        const wallHeight = 60;
        const wallWidth = 7;
        const loader = new THREE.TextureLoader();

        if (!wasInitOnce) {
            camera.add(light);
            controls = new THREE.PointerLockControls(camera);
            scene.add(controls.getObject());

            const onKeyDown = (event) => {
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
                    default:
                }
            };

            const onKeyUp = (event) => {
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
                    default:
                }
            };

            const onMouseClick = (event) => {
                switch (event.which) {
                    case 1:
                        if (crumbsInHand > 0) {
                            crumbsInHand -= 1;
                            throwCrumbs = true;
                            crumbsLeft.innerHTML = 'crumbs left: ' + crumbsInHand;
                        }
                        break;
                    default:
                }
            };

            document.addEventListener('click', onMouseClick, false);
            document.addEventListener('keydown', onKeyDown, false);
            document.addEventListener('keyup', onKeyUp, false);

            const floorGeometry = new THREE.PlaneGeometry(tileWidth * tilesPerRow, tileWidth * tilesPerRow, 100, 100);
            floorGeometry.rotateX(-Math.PI / 2);

            const floorTexture = loader.load('textures/floor.jpg');
            floorTexture.wrapS = THREE.RepeatWrapping;
            floorTexture.wrapT = THREE.RepeatWrapping;
            floorTexture.repeat.set(tilesPerRow, tilesPerRow);

            const floorMaterial = new THREE.MeshPhongMaterial({
                map: floorTexture,
                shininess: 1
            });
            const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
            floorMesh.position.x = ((tileWidth * tilesPerRow) / 2) - (tileWidth / 2);
            floorMesh.position.z = ((tileWidth * tilesPerRow) / 2) - (tileWidth / 2);
            scene.add(floorMesh);
        }

        const wallErected = {};
        const wallGeometryX = new THREE.BoxGeometry(tileWidth, wallHeight, wallWidth);
        const wallGeometryZ = new THREE.BoxGeometry(wallWidth, wallHeight, tileWidth);
        const wallTexture = loader.load('textures/wall.jpg');
        const wallMaterial = new THREE.MeshPhongMaterial({
            map: wallTexture,
            shininess: 1
        });

        const torchGeometry = new THREE.BoxGeometry(1, 5, 1);
        const torchTexture = loader.load('textures/torch.jpg');
        const torchMaterial = new THREE.MeshPhongMaterial({
            map: torchTexture,
            shininess: 1
        });

        const crumbBoxGeometry = new THREE.BoxGeometry(4, 4, 4);
        const crumbBoxTexture = loader.load('textures/box.jpg');
        const crumbBoxMaterial = new THREE.MeshPhongMaterial({
            map: crumbBoxTexture,
            shininess: 1
        });

        const doorGeometryX = new THREE.BoxGeometry(tileWidth / 4, (wallHeight / 2) - 6, wallWidth + 2);
        const doorGeometryZ = new THREE.BoxGeometry(wallWidth + 2, (wallHeight / 2) - 6, tileWidth / 4);
        const doorTexture = loader.load('textures/door.jpg');
        const doorMaterial = new THREE.MeshPhongMaterial({
            map: doorTexture,
            shininess: 1
        });

        function maybeErectWall(x1, z1, x2, z2, i, j) {
            const key = x1 + ',' + z1 + ',' + x2 + ',' + z2;
            if (!wallErected[key]) {
                wallErected[key] = true;
                let wall;
                if (x1 < x2) {
                    wall = new THREE.Mesh(wallGeometryX, wallMaterial);
                    wall.position.x = x1;
                    wall.position.z = z1 - (tileWidth / 2);
                    if (walls[i][j][5]) {
                        walls[i][j][5] = false;
                        doorEnd = new THREE.Mesh(doorGeometryX, doorMaterial);
                        doorEnd.position.x = x1;
                        doorEnd.position.z = z1 - (tileWidth / 2);
                        doorEnd.position.y = (wallHeight / 2) - 18;
                        scene.add(doorEnd);
                    }
                } else if (z1 < z2) {
                    wall = new THREE.Mesh(wallGeometryZ, wallMaterial);
                    wall.position.x = x1 - (tileWidth / 2);
                    wall.position.z = z1;
                    if (walls[i][j][5]) {
                        walls[i][j][5] = false;
                        doorEnd = new THREE.Mesh(doorGeometryZ, doorMaterial);
                        doorEnd.position.x = x1 - (tileWidth / 2);
                        doorEnd.position.z = z1;
                        doorEnd.position.y = (wallHeight / 2) - 18;
                        scene.add(doorEnd);
                    }
                }
                scene.add(wall);
                wallObjects.push(wall);
            }
        }

        function placeTorch(x, z) {
            const torch = new THREE.Mesh(torchGeometry, torchMaterial);
            torch.position.x = x;
            torch.position.z = z;
            torch.position.y = 2;
            scene.add(torch);
            torches.push(torch);
            // console.log("Created torch", torch);
        }

        function placeCrumbBox(x, z) {
            const crumbBox = new THREE.Mesh(crumbBoxGeometry, crumbBoxMaterial);
            crumbBox.position.x = x;
            crumbBox.position.z = z;
            crumbBox.position.y = 2;
            scene.add(crumbBox);
            crumbBoxes.push(crumbBox);
        }

        for (let i = 0; i < tilesPerRow; ++i) {
            const x = i * tileWidth;
            for (let j = 0; j < tilesPerRow; ++j) {
                const z = j * tileWidth;
                if (walls[i][j][0])
                    maybeErectWall(x, z, x + tileWidth, z, i, j); //Norden}
                if (walls[i][j][1])
                    maybeErectWall(x, z + tileWidth, x + tileWidth, z + tileWidth, i, j); //Süden
                if (walls[i][j][2])
                    maybeErectWall(x, z, x, z + tileWidth, i, j); //Westen
                if (walls[i][j][3])
                    maybeErectWall(x + tileWidth, z, x + tileWidth, z + tileWidth, i, j); //Osten
                if (walls[i][j][4])
                    placeTorch(x, z);
                if (walls[i][j][6])
                    placeCrumbBox(x, z);
            }
        }

        if (!wasInitOnce) {
            wasInitOnce = true;
            renderer = new THREE.WebGLRenderer();
            renderer.setClearColor(0x000000);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);
            window.addEventListener('resize', onWindowResize, false);
            animate();
        }
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function createCrumb() {
        const cG = new THREE.SphereGeometry(0.5, 0.5, 0.5);
        const cM = new THREE.MeshPhongMaterial({
            color: 0xffff00,
            specular: 0x000000,
            shininess: 100
        });

        const ball = new THREE.Mesh(cG, cM);
        ball.position.x = controls.getObject().position.x;
        ball.position.z = controls.getObject().position.z;
        ball.position.y = 0.5;
        return ball;
    }

    function animate() {
        requestAnimationFrame(animate);

        if (controlsEnabled) {
            const time = performance.now();
            const delta = (time - prevTime) / 1000;
            let multi = 1;

            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            if (sprint) multi = 2;
            if (moveForward) velocity.z -= 400.0 * delta * multi;
            if (moveBackward) velocity.z += 400.0 * delta * multi;
            if (moveLeft) velocity.x -= 400.0 * delta * multi;
            if (moveRight) velocity.x += 400.0 * delta * multi;
            if (throwCrumbs) {
                throwCrumbs = false;
                const crumb = createCrumb();
                scene.add(crumb);
                crumbs.push(crumb);
            }

            const nextPosition = controls.getObject().clone();
            nextPosition.translateX(velocity.x * delta);
            nextPosition.translateY(velocity.y * delta);
            nextPosition.translateZ(velocity.z * delta);
            const directionToNextPos = new THREE.Vector3();
            directionToNextPos.subVectors(nextPosition.position, camera.getWorldPosition()).normalize();
            raycaster.set(camera.getWorldPosition(), directionToNextPos);

            // Debugging arrow welche die Richtung anzeigt
            // if ( arrow )
            // scene.remove ( arrow );
            // arrow = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 10, 0xffffff );
            // scene.add( arrow );

            // berechne die sich schneidenen Objecte mit dem picking ray
            if (raycaster.intersectObjects(wallObjects).length > 0) {
                velocity.x = 0;
                velocity.z = 0;
            }

            //door collision
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

            // torch collision
            raycaster.far = 10;
            for (let i = 0; i < 100; ++i) {
                raycaster.ray.origin.y = 0;
                raycaster.ray.direction = directionToNextPos.clone().applyAxisAngle(yAxis, (Math.PI / 4) - ((Math.PI / 2) * (i / 100)));
                raycaster.ray.direction.y = 0;
                for (const collision of raycaster.intersectObjects(torches)) {
                    const torch = collision.object;
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

                for (const collision of raycaster.intersectObjects(crumbBoxes)) {
                    const crumbBox = collision.object;
                    crumbBoxes = crumbBoxes.filter(t => t.uuid !== crumbBox.uuid);
                    scene.remove(crumbBox);
                    crumbsInHand += 10;
                    crumbsLeft.innerHTML = 'crumbs left: ' + crumbsInHand;
                }
            }

            if (light.distance > 30 && playerHasTorch) {
                camera.remove(light);
                light.distance -= 0.05;
                camera.add(light);
            } else if (light.distance > 10 && playerHasTorch) {
                camera.remove(light);
                light.distance -= 0.25;
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

            if (velocity.x !== 0 || velocity.y !== 0 || velocity.z !== 0) {
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
