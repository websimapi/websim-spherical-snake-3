import * as THREE from 'three';
import { Game } from './game.js';

// Setup basic Three.js scene
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
// Position camera for a nice orbital view
const cameraRig = new THREE.Group();
scene.add(cameraRig);
cameraRig.add(camera);
camera.position.z = 25;
camera.position.y = 10;
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimize for mobile
document.getElementById('game-container').appendChild(renderer.domElement);

// Lighting
// Bright ambient light to ensure no part of the sphere is too dark
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
scene.add(ambientLight);

// Hemisphere light for natural, omnidirectional illumination
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemiLight);

// Camera-mounted light removed to prevent glare.
// Note: Camera is already added to the scene via cameraRig

// Initialize Game
const game = new Game(scene, camera, renderer);



// Setup User Info via WebsimSocket
const room = new WebsimSocket();
room.initialize().then(() => {
    const me = room.peers[room.clientId];
    if(me) {
        game.setPlayerInfo(me);
    }
});

// Raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function handleInput(x, y) {
    // Convert screen coords to Normalized Device Coordinates (-1 to +1)
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Raycast against the earth
    const intersects = raycaster.intersectObject(game.earth);

    if (intersects.length > 0) {
        // Pass the intersection point to the game logic
        game.setTarget(intersects[0].point);
        
        // Remove start message on first tap
        const msg = document.getElementById('start-message');
        if(msg) msg.style.display = 'none';
    }
}

// Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Touch events for mobile
window.addEventListener('touchstart', (e) => {
    if (game.isGameOver) {
        // Simple debounce for restart
        if (Date.now() - game.time > 1000) { // arbitrary reuse of logic, better to just use DOM click
            // Handled by click listener on game over modal
        }
    } else {
        const touch = e.touches[0];
        handleInput(touch.clientX, touch.clientY);
    }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    // Allow dragging to update direction continuously
    if(!game.isGameOver) {
        const touch = e.touches[0];
        handleInput(touch.clientX, touch.clientY);
    }
}, { passive: false });

// Mouse events for desktop testing
window.addEventListener('mousedown', (e) => {
    if(!game.isGameOver) handleInput(e.clientX, e.clientY);
});
window.addEventListener('mousemove', (e) => {
    if(e.buttons === 1 && !game.isGameOver) handleInput(e.clientX, e.clientY);
});

// UI Event Handlers
const gameOverScreen = document.getElementById('game-over');
const replayContainer = document.getElementById('replay-container');

// Restart
document.getElementById('btn-restart').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent bubbling issues
    if(game.isGameOver) {
        game.resetGame();
    }
});

// Watch Replay
document.getElementById('btn-replay').addEventListener('click', async (e) => {
    e.stopPropagation();
    
    // Hide Game UI
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('game-container').classList.add('hidden');
    
    // Show Replay
    replayContainer.classList.remove('hidden');
    
    // Load Replay Logic
    // We use dynamic import for the JSX/Remotion module
    const { mountReplay } = await import('./replay.jsx');
    
    const data = game.getReplayJSON();
    mountReplay('replay-root', data);
});

// Close Replay
document.getElementById('close-replay').addEventListener('click', async () => {
    // Hide Replay
    replayContainer.classList.add('hidden');
    
    // Unmount React
    const { unmountReplay } = await import('./replay.jsx');
    unmountReplay();
    
    // Show Game UI
    document.getElementById('ui-layer').classList.remove('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    // Ensure Game Over screen is still visible
    document.getElementById('game-over').classList.remove('hidden');
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1); // Cap delta time
    
    if (game.isPlaying) {
        game.update(dt);
    }
    
    renderer.render(scene, camera);
}

animate();