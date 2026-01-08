export class AudioManager {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
    }

    async load(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            this.sounds[name] = audioBuffer;
        } catch (e) {
            console.error('Error loading sound:', name, e);
        }
    }

    play(name) {
        if (this.sounds[name] && this.audioCtx.state === 'running') {
            const source = this.audioCtx.createBufferSource();
            source.buffer = this.sounds[name];
            source.connect(this.audioCtx.destination);
            source.start(0);
        }
    }

    resume() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    getState() {
        return this.audioCtx.state;
    }
}