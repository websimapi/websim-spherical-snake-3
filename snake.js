import * as THREE from 'three';
import { getTangentDirection } from './math-utils.js';

export class Snake {
    constructor(scene, earthRadius) {
        this.scene = scene;
        this.EARTH_RADIUS = earthRadius;
        
        // Constants
        this.SPEED = 8.0;
        this.TURN_SPEED = 6.0;
        this.SEGMENT_DISTANCE = 0.8;
        this.STARTING_SEGMENTS = 5;
        
        // State
        this.head = null;
        this.segments = [];
        this.pathHistory = [];
        this.currentDir = new THREE.Vector3(1, 0, 0);
        
        this.init();
    }
    
    init() {
        const headGeo = new THREE.BoxGeometry(0.8, 0.4, 0.8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x004400 });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.scene.add(this.head);
    }

    reset() {
        // Clear segments
        this.segments.forEach(seg => this.scene.remove(seg));
        this.segments = [];
        this.pathHistory = [];
        
        // Reset Head
        this.head.position.set(0, this.EARTH_RADIUS, 0);
        this.head.lookAt(new THREE.Vector3(1, this.EARTH_RADIUS, 0));
        this.head.quaternion.identity(); 
        
        this.currentDir.set(1, 0, 0);
        
        // Rebuild initial body
        for(let i=0; i<this.STARTING_SEGMENTS; i++) {
            this.addSegment();
        }
        
        // Pre-fill history
        const startPos = this.head.position.clone();
        for(let i=0; i<100; i++) {
            this.pathHistory.push({
                pos: startPos.clone(),
                quat: this.head.quaternion.clone()
            });
        }
    }

    addSegment() {
        const segGeo = new THREE.BoxGeometry(0.6, 0.3, 0.6);
        const color = new THREE.Color().setHSL(0.3 + (this.segments.length * 0.02) % 0.5, 1.0, 0.5);
        const segMat = new THREE.MeshStandardMaterial({ color: color });
        const segment = new THREE.Mesh(segGeo, segMat);
        this.scene.add(segment);
        this.segments.push(segment);
    }
    
    getTailPosition() {
        return this.segments.length > 0 ? 
               this.segments[this.segments.length - 1].position.clone() : 
               this.head.position.clone();
    }

    update(dt, targetPoint) {
        // 1. Parallel Transport Movement Logic
        const headPos = this.head.position.clone();
        const surfaceNormal = headPos.clone().normalize();
        
        let currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.head.quaternion);
        currentForward.projectOnPlane(surfaceNormal).normalize();

        // Steering
        if (targetPoint) {
            const dist = headPos.distanceTo(targetPoint);
            if (dist >= 1.0) {
                const desiredTangent = getTangentDirection(headPos, targetPoint, new THREE.Vector3(0,0,0));
                currentForward.lerp(desiredTangent, this.TURN_SPEED * dt).normalize();
                
                const m = new THREE.Matrix4().lookAt(currentForward.clone().add(headPos), headPos, surfaceNormal);
                this.head.quaternion.setFromRotationMatrix(m);
            }
        } else {
            const m = new THREE.Matrix4().lookAt(currentForward.clone().add(headPos), headPos, surfaceNormal);
            this.head.quaternion.setFromRotationMatrix(m);
        }

        // 2. Move Head Forward
        const moveDist = this.SPEED * dt;
        const angularSpeed = moveDist / this.EARTH_RADIUS;
        const rotationAxis = new THREE.Vector3().crossVectors(surfaceNormal, currentForward).normalize();
        const qRot = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angularSpeed);
        
        this.head.position.applyQuaternion(qRot);
        this.head.quaternion.premultiply(qRot);

        // 3. Record History
        if (this.pathHistory.length === 0 || 
            this.pathHistory[0].pos.distanceTo(this.head.position) > 0.1) {
            
            this.pathHistory.unshift({
                pos: this.head.position.clone(),
                quat: this.head.quaternion.clone()
            });
            
            const maxHistory = (this.segments.length + 2) * (this.SEGMENT_DISTANCE * 10);
            if(this.pathHistory.length > maxHistory) {
                this.pathHistory.length = Math.floor(maxHistory);
            }
        }

        // 4. Update Segments
        this.updateSegments();

        return moveDist;
    }

    updateSegments() {
        let distanceAccumulator = 0;
        let historyIndex = 0;
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const targetDist = (i + 1) * this.SEGMENT_DISTANCE;
            
            while(historyIndex < this.pathHistory.length - 1) {
                const p1 = this.pathHistory[historyIndex].pos;
                const p2 = this.pathHistory[historyIndex + 1].pos;
                const d = p1.distanceTo(p2);
                
                if (distanceAccumulator + d >= targetDist) {
                    const remainder = targetDist - distanceAccumulator;
                    const alpha = remainder / d;
                    
                    segment.position.lerpVectors(p1, p2, alpha);
                    segment.quaternion.slerpQuaternions(this.pathHistory[historyIndex].quat, this.pathHistory[historyIndex+1].quat, alpha);
                    break;
                }
                
                distanceAccumulator += d;
                historyIndex++;
            }
        }
    }

    checkSelfCollision() {
        // Skip first few segments
        for(let i = 4; i < this.segments.length; i++) {
            if (this.head.position.distanceTo(this.segments[i].position) < 0.6) {
                return true;
            }
        }
        return false;
    }
}