import * as THREE from 'three';
import { Snake } from './snake.js';
import { FoodManager } from './food-manager.js';
import { AudioManager } from './audio-manager.js';
import { ReplayRecorder } from './replay-recorder.js';

export class Game {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Constants
        this.EARTH_RADIUS = 10;
        
        // State
        this.isPlaying = false;
        this.isGameOver = false;
        this.score = 0;
        this.growthPoints = 0;
        this.time = 0;
        
        // Player Info
        this.playerInfo = { username: 'Player', avatarUrl: '' };
        
        // Components
        this.audioManager = new AudioManager();
        this.recorder = new ReplayRecorder(30);
        
        // Entities
        this.earth = null;
        this.snake = null; // Replaces head, segments, pathHistory
        this.foodManager = null; // Replaces food, bonusFoods, spawn logic

        this.targetPoint = null;

        this.init();
    }

    setPlayerInfo(info) {
        this.playerInfo = info;
        const avatarEl = document.getElementById('player-avatar');
        const nameEl = document.getElementById('player-name');
        
        if (avatarEl) {
            if (info.avatarUrl) {
                avatarEl.src = info.avatarUrl;
                // Fallback if image fails to load
                avatarEl.onerror = () => {
                    avatarEl.src = './default_avatar.png';
                    avatarEl.onerror = null;
                };
            } else {
                avatarEl.src = './default_avatar.png';
            }
        }
        
        if(nameEl && info.username) nameEl.textContent = info.username;
    }

    init() {
        // removed loadSound calls - now in AudioManager

        this.audioManager.load('eat', './snake_eat.mp3');
        this.audioManager.load('die', './game_over.mp3');

        // Create Earth
        this.createEarth();

        // removed Snake Head creation - moved to Snake class
        this.snake = new Snake(this.scene, this.EARTH_RADIUS);

        // removed Food creation/spawning - moved to FoodManager
        this.foodManager = new FoodManager(this.scene, this.EARTH_RADIUS);
        this.foodManager.spawnFood(this.snake.head.position, this.snake.segments);

        this.resetGame();
    }
    
    createEarth() {
        const geometry = new THREE.SphereGeometry(this.EARTH_RADIUS, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            emissive: 0x002244, 
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.7,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        this.earth = new THREE.Mesh(geometry, material);
        this.scene.add(this.earth);
        
        const atmGeometry = new THREE.SphereGeometry(this.EARTH_RADIUS * 1.03, 64, 64);
        const atmMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        this.scene.add(new THREE.Mesh(atmGeometry, atmMaterial));
    }
    
    resetGame() {
        // removed reset logic for segments/bonus foods - delegated to managers
        this.snake.reset();
        this.foodManager.reset();
        this.foodManager.spawnFood(this.snake.head.position, this.snake.segments);
        
        this.recorder.reset();
        
        // Reset Camera
        this.updateCamera(0.1, true); // Force snap
        
        this.score = 0;
        this.growthPoints = 0;
        this.isGameOver = false;
        this.isPlaying = true;
        this.targetPoint = null;

        const scoreEl = document.getElementById('player-score');
        if(scoreEl) scoreEl.innerText = this.score;
        document.getElementById('game-over').classList.add('hidden');
    }

    playSound(name) {
        this.audioManager.play(name);
        this.recorder.recordEvent(name);
    }

    setTarget(point) {
        if(this.isGameOver) return;
        this.audioManager.resume();
        this.targetPoint = point.clone().normalize().multiplyScalar(this.EARTH_RADIUS);
    }

    update(dt) {
        if(this.isGameOver) return;

        // 1. Update Snake
        // removed movement logic block - delegated to Snake.update
        const moveDist = this.snake.update(dt, this.targetPoint);
        if (moveDist > 0 && this.targetPoint && this.snake.head.position.distanceTo(this.targetPoint) < 1.0) {
            this.targetPoint = null;
        }

        // 2. Update Food Manager (Pulse anims, Bonus spawning)
        // removed bonus spawn logic - delegated to FoodManager
        this.foodManager.update(moveDist, this.snake.getTailPosition());

        // 3. Collision Checks
        const collisions = this.foodManager.checkCollisions(this.snake.head.position);
        
        if (collisions.mainFood) {
            this.playSound('eat');
            this.score += 5;
            this.growthPoints += 5;
            
            const scoreEl = document.getElementById('player-score');
            if(scoreEl) scoreEl.innerText = this.score;
            
            this.foodManager.spawnFood(this.snake.head.position, this.snake.segments);
            
            if (Math.random() < 0.5) {
                this.foodManager.spawnBonusTrail(5);
            }
        }
        
        // Sort indices descending to remove safely
        collisions.bonusIndices.sort((a,b) => b-a).forEach(idx => {
            this.playSound('eat');
            this.score += 1;
            this.growthPoints += 1;
            const scoreEl = document.getElementById('player-score');
            if(scoreEl) scoreEl.innerText = this.score;
            this.foodManager.removeBonusFood(idx);
        });

        // Check Growth
        while (this.growthPoints >= 10) {
            this.snake.addSegment();
            this.growthPoints -= 10;
        }

        // 4. Check Self Collision
        // removed loop - delegated to Snake
        if (this.snake.checkSelfCollision()) {
            this.gameOver();
        }

        // 5. Update Camera
        this.updateCamera(dt);

        // 6. Record Frame
        // removed recordFrame implementation - delegated to ReplayRecorder
        this.recorder.update(dt, () => this.getSnapshot());
    }
    
    updateCamera(dt, snap = false) {
        const idealCameraPos = this.snake.head.position.clone().normalize().multiplyScalar(30);
        if (snap) {
            this.camera.position.copy(idealCameraPos);
        } else {
            this.camera.position.lerp(idealCameraPos, 2.0 * dt);
        }
        this.camera.lookAt(0, 0, 0);
        
        const snakeForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.snake.head.quaternion);
        this.camera.up.copy(snakeForward);
    }

    getSnapshot() {
        return {
            head: {
                pos: this.snake.head.position.toArray(),
                quat: this.snake.head.quaternion.toArray()
            },
            camera: {
                pos: this.camera.position.toArray(),
                quat: this.camera.quaternion.toArray(),
                up: this.camera.up.toArray()
            },
            food: this.foodManager.food.position.toArray(),
            bonusFoods: this.foodManager.bonusFoods.map(b => b.position.toArray()),
            segments: this.snake.segments.map(seg => ({
                pos: seg.position.toArray(),
                quat: seg.quaternion.toArray(),
                color: seg.material.color.getHex()
            })),
            score: this.score,
            events: [] // Filled by recorder
        };
    }

    getReplayJSON() {
        return this.recorder.getReplayJSON({
            earthRadius: this.EARTH_RADIUS,
            fps: this.recorder.RECORD_FPS,
            playerInfo: this.playerInfo,
            sounds: {
                eat: './snake_eat.mp3',
                die: './game_over.mp3'
            }
        });
    }

    gameOver() {
        this.isGameOver = true;
        this.playSound('die');
        // Force a final record
        this.recorder.update(100, () => this.getSnapshot()); 
        
        document.getElementById('game-over').classList.remove('hidden');
        this.isPlaying = false;
    }
}