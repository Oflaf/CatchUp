'use strict';

class SoundManager {
    constructor() {
        this.sounds = {};
        this.isReady = false;
        this.masterVolume = 0.4; // Domyślna głośność (0.0 to 1.0)
        this.exclusiveInstances = {};
        this.strikeSoundInstance = null; // <-- NOWA WŁAŚCIWOŚĆ
    }

    async loadSounds(soundPaths) {
        console.log('Loading sounds...');
        const promises = Object.entries(soundPaths).map(([name, path]) => {
            return new Promise((resolve, reject) => {
                const audio = new Audio(path);
                audio.addEventListener('canplaythrough', () => {
                    this.sounds[name] = audio;
                    resolve();
                });
                audio.addEventListener('error', (e) => {
                    console.error(`Failed to load sound: ${name} at ${path}`);
                    reject(e);
                });
            });
        });

        try {
            await Promise.all(promises);
            this.isReady = true;
            console.log('All sounds loaded successfully.');
        } catch (error) {
            console.error('An error occurred while loading sounds:', error);
        }
    }

    play(name) {
        if (!this.isReady || !this.sounds[name]) {
            return;
        }
        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = this.masterVolume;
        soundClone.play().catch(error => {
            // Błędy są normalne, jeśli użytkownik nie wszedł w interakcję ze stroną
        });
    }

    playWithVolume(name, volumeMultiplier) {
        if (!this.isReady || !this.sounds[name]) {
            return;
        }

        const soundClone = this.sounds[name].cloneNode();
        
        const finalVolume = Math.max(0, Math.min(1, this.masterVolume * volumeMultiplier));
        soundClone.volume = finalVolume;

        soundClone.play().catch(error => {
            // Błędy są normalne, jeśli użytkownik nie wszedł w interakcję ze stroną
        });
    }

    playExclusive(name) {
        if (!this.isReady || !this.sounds[name]) {
            return;
        }

        const currentInstance = this.exclusiveInstances[name];
        if (currentInstance && !currentInstance.ended) {
            return;
        }

        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = this.masterVolume;
        soundClone.play().catch(error => {
            // Obsługa błędu
        });

        this.exclusiveInstances[name] = soundClone;
    }

    // ======================= POCZĄTEK NOWEGO KODU =======================
    playStrikeSound() {
        if (!this.isReady || !this.sounds['strike']) {
            return;
        }
        // Nie odtwarzaj, jeśli dźwięk już gra
        if (this.strikeSoundInstance && !this.strikeSoundInstance.ended) {
            return;
        }

        const soundClone = this.sounds['strike'].cloneNode();
        soundClone.volume = this.masterVolume;
        soundClone.play().catch(error => { /* Błędy są normalne */ });
        this.strikeSoundInstance = soundClone;

        // Wyczyść instancję, gdy dźwięk się skończy naturalnie
        this.strikeSoundInstance.onended = () => {
            this.strikeSoundInstance = null;
        };
    }

    stopStrikeSound() {
        if (this.strikeSoundInstance && !this.strikeSoundInstance.paused) {
            this.strikeSoundInstance.pause();
            this.strikeSoundInstance.currentTime = 0;
            this.strikeSoundInstance = null;
        }
    }
    // ======================== KONIEC NOWEGO KODU ========================

    startLoop(name) {
        if (!this.isReady || !this.sounds[name]) {
            return;
        }
        const sound = this.sounds[name];
        if (sound.paused) {
            sound.loop = true;
            sound.volume = this.masterVolume;
            sound.play().catch(e => console.error(`Loop sound error for '${name}':`, e));
        }
    }

    stopLoop(name) {
        if (this.sounds[name] && !this.sounds[name].paused) {
            this.sounds[name].pause();
            this.sounds[name].currentTime = 0;
        }
    }

    setVolume(level) {
        this.masterVolume = Math.max(0, Math.min(1, level));
    }
}