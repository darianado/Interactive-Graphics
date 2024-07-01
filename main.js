import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'dat.gui';

let renderer, scene, camera, spotLight, lightHelper;
let ballVelocity = new THREE.Vector3(0, 0, 0);
const gravity = new THREE.Vector3(0, -9.81, 0);
const bounceFactor = 0.7;

// Set up the renderer
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

// Create the scene
scene = new THREE.Scene();

// Set up the camera
camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(30, 30, 60);

// Set up the orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 10;
controls.maxDistance = 100;
controls.target.set(0, 20, 0);
controls.update();

// Add ambient light to the scene
const ambient = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 0.35);
scene.add(ambient);

// Set up the spotlight
spotLight = new THREE.SpotLight(0xffffff, 500);
spotLight.position.set(20, 60, 30);
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
spotLight.angle = Math.PI / 4;
spotLight.penumbra = 0.1;
spotLight.decay = 2;
spotLight.distance = 200;
scene.add(spotLight);

lightHelper = new THREE.SpotLightHelper(spotLight);
scene.add(lightHelper);

// Create the ground plane
const planeGeometry = new THREE.PlaneGeometry(200, 200);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xbcbcbc });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -40;
plane.receiveShadow = true;
scene.add(plane);

// Create the main rotating cylinder
const height = 100;
const radius = 12;
const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, height, 32);
const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0xb0c4de });
const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
cylinder.castShadow = true;
cylinder.receiveShadow = true;

// Create a group to hold the cylinder and platforms
const cylinderGroup = new THREE.Group();
cylinderGroup.add(cylinder);
scene.add(cylinderGroup);

// Function to create incomplete platforms
const platformHeight = 3;
const platformRadius = 21;

function createIncompletePlatform(radius, height) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(radius, 0);
    shape.absarc(0, 0, radius, 0, 320 * Math.PI / 180, false);
    shape.lineTo(0, 0);

    const extrudeSettings = {
        depth: height,
        bevelEnabled: false
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Generate a random rotation angle in radians
    const randomAngle = Math.random() * 2 * Math.PI;

    // Create a rotation matrix
    const rotationMatrix = new THREE.Matrix4().makeRotationZ(randomAngle);

    // Apply the rotation matrix to the geometry
    geometry.applyMatrix4(rotationMatrix);

    geometry.rotateX(Math.PI / 2); // Ensure the platforms are horizontal

    return geometry;
}

// Create platforms and add them to the cylinder group
for (let i = -height / 2 + 2; i < height / 2; i += 9) {
    const platformGeometry = createIncompletePlatform(platformRadius, platformHeight);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = i;
    platform.castShadow = true;
    platform.receiveShadow = true;
    cylinderGroup.add(platform);
}

// Create the red ball
const ballGeometry = new THREE.SphereGeometry(2, 32, 32);
const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const ball = new THREE.Mesh(ballGeometry, ballMaterial);
ball.castShadow = true;
ball.receiveShadow = true;
ball.position.set(0, 60, 16);
scene.add(ball);

// Event listener for keydown events to rotate the cylinder group
window.addEventListener('keydown', (event) => {
    const rotationSpeed = 0.05;
    if (event.key === 'ArrowLeft') {
        cylinderGroup.rotation.y -= rotationSpeed;
    } else if (event.key === 'ArrowRight') {
        cylinderGroup.rotation.y += rotationSpeed;
    }
});

// Function to handle ball physics
function updateBall(delta) {
    ballVelocity.add(gravity.clone().multiplyScalar(delta)); // Apply gravity
    ball.position.add(ballVelocity.clone().multiplyScalar(delta)); // Update ball position

    // Check for collision with platforms using raycasting
    const raycaster = new THREE.Raycaster();
    const directions = [
        new THREE.Vector3(0, -1, 0), // Downwards along Y-axis
        new THREE.Vector3(1, -1, 0).normalize(), // Down-right along X-axis
        new THREE.Vector3(-1, -1, 0).normalize(), // Down-left along X-axis
        new THREE.Vector3(0, -1, 1).normalize(), // Down-forwards along Z-axis
        new THREE.Vector3(0, -1, -1).normalize() // Down-backwards along Z-axis
    ];

    let collisionDetected = false;

    for (const direction of directions) {
        raycaster.set(ball.position, direction);
        const intersects = raycaster.intersectObjects(cylinderGroup.children);

        if (intersects.length > 0) {
            const intersect = intersects[0];
            if (intersect.distance < ball.geometry.parameters.radius) {
                ballVelocity.y = -ballVelocity.y * bounceFactor;
                ball.position.y = intersect.point.y + ball.geometry.parameters.radius;
                collisionDetected = true;
                break;
            }
        }
    }

    // Apply friction to the ball's horizontal velocity when it touches a platform
    if (collisionDetected) {
        ballVelocity.x *= 0.9;
        ballVelocity.z *= 0.9;
    }

    // Check for collision with platforms from below using raycasting
    const upwardDirections = [
        new THREE.Vector3(0, 1, 0), // Upwards along Y-axis
        new THREE.Vector3(1, 1, 0).normalize(), // Up-right along X-axis
        new THREE.Vector3(-1, 1, 0).normalize(), // Up-left along X-axis
        // new THREE.Vector3(0, 1, 1).normalize(), // Up-forwards along Z-axis
        // new THREE.Vector3(0, 1, -1).normalize() // Up-backwards along Z-axis
    ];

    for (const direction of upwardDirections) {
        raycaster.set(ball.position, direction);
        const intersects = raycaster.intersectObjects(cylinderGroup.children);

        if (intersects.length > 0) {
            const intersect = intersects[0];
            if (intersect.distance < ball.geometry.parameters.radius) {
                ballVelocity.y = -ballVelocity.y * bounceFactor;
                ball.position.y = intersect.point.y - ball.geometry.parameters.radius;
                break;
            }
        }
    }

    // Check for collision with ground plane
    if (ball.position.y - ball.geometry.parameters.radius < plane.position.y) {
        ballVelocity.y = -ballVelocity.y * bounceFactor;
        ball.position.y = plane.position.y + ball.geometry.parameters.radius;
    }
}

// GUI for spotlight control
const gui = new GUI();
const params = {
    color: spotLight.color.getHex(),
    intensity: spotLight.intensity,
    distance: spotLight.distance,
    angle: spotLight.angle,
    penumbra: spotLight.penumbra,
    decay: spotLight.decay,
    focus: spotLight.shadow.focus,
    x: spotLight.position.x,
    y: spotLight.position.y,
    z: spotLight.position.z,
    shadows: true
};

gui.addColor(params, 'color').onChange(function (val) {
    spotLight.color.setHex(val);
});

gui.add(params, 'intensity', 0, 500).onChange(function (val) {
    spotLight.intensity = val;
});

gui.add(params, 'distance', 0, 200).onChange(function (val) {
    spotLight.distance = val;
});

gui.add(params, 'angle', 0, Math.PI / 3).onChange(function (val) {
    spotLight.angle = val;
});

gui.add(params, 'penumbra', 0, 1).onChange(function (val) {
    spotLight.penumbra = val;
});

gui.add(params, 'decay', 1, 2).onChange(function (val) {
    spotLight.decay = val;
});

gui.add(params, 'x', -50, 50).onChange(function (val) {
    spotLight.position.x = val;
});

gui.add(params, 'y', -50, 150).onChange(function (val) {
    spotLight.position.y = val;
});

gui.add(params, 'z', -50, 50).onChange(function (val) {
    spotLight.position.z = val;
});

gui.add(params, 'shadows').onChange(function (val) {
    renderer.shadowMap.enabled = val;
    scene.traverse(function (child) {
        if (child.material) {
            child.material.needsUpdate = true;
        }
    });
});

gui.open();

// Event listener for window resize
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
let lastTime = 0;

function animate(time) {
    requestAnimationFrame(animate);

    const delta = (time - lastTime) / 1000;
    lastTime = time;

    updateBall(delta);
    lightHelper.update();
    renderer.render(scene, camera);
}

animate(lastTime);
