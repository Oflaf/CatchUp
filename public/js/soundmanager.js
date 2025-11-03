'use strict';

class SoundManager {
    constructor() {
        this.sounds = {};
        this.isReady = false;
        // Zmieniamy domyślną głośność na 1.0 (100%), aby pasowała do ustawień
        this.masterVolume = 1.0; 
        this.exclusiveInstances = {};
        this.strikeSoundInstance = null;

        this.weatherSounds = {
            drizzle: { instance: null, targetVolume: 0 },
            rain: { instance: null, targetVolume: 0 },
            storm: { instance: null, targetVolume: 0 },
        };
        this.FADE_SPEED = 0.33;
    }

    async loadSounds(soundPaths) {
        console.log('Loading sounds...');
        const promises = Object.entries(soundPaths).map(([name, path]) => {
            return new Promise((resolve, reject) => {
                const audio = new Audio(path);
                audio.addEventListener('canplaythrough', () => {
                    this.sounds[name] = audio;
                    
                    if (this.weatherSounds[name]) {
                        const instance = audio.cloneNode();
                        instance.loop = true;
                        instance.volume = 0;
                        this.weatherSounds[name].instance = instance;
                    }

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

    update(deltaTime) {
        if (!this.isReady) return;

        for (const soundName in this.weatherSounds) {
            const soundData = this.weatherSounds[soundName];
            if (!soundData.instance) continue;

            const currentVolume = soundData.instance.volume;
            // Cel głośności jest teraz mnożony przez masterVolume
            const targetVolume = soundData.targetVolume * this.masterVolume;

            if (currentVolume !== targetVolume) {
                const difference = targetVolume - currentVolume;
                const change = this.FADE_SPEED * deltaTime * Math.sign(difference);

                let newVolume;
                if (Math.abs(difference) > Math.abs(change)) {
                    newVolume = currentVolume + change;
                } else {
                    newVolume = targetVolume;
                }
                
                // Głośność instancji nie może przekroczyć masterVolume
                soundData.instance.volume = Math.max(0, Math.min(this.masterVolume, newVolume));

                if (soundData.instance.volume > 0 && soundData.instance.paused) {
                    soundData.instance.play().catch(e => {});
                }
                else if (soundData.instance.volume <= 0 && !soundData.instance.paused) {
                    soundData.instance.pause();
                }
            }
        }
    }
    
    setWeatherSound(weatherType) {
        if (!this.isReady) return;

        for (const soundName in this.weatherSounds) {
            if (soundName === weatherType) {
                // Ustawiamy cel na 1 (100%), który potem będzie skalowany przez masterVolume
                this.weatherSounds[soundName].targetVolume = 1.0;
            } else {
                this.weatherSounds[soundName].targetVolume = 0;
            }
        }
    }

    play(name) {
        if (!this.isReady || !this.sounds[name]) return;
        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = this.masterVolume;
        soundClone.play().catch(error => {});
    }
    
    playRandomThunder() {
        if (!this.isReady) return;
        
        const thunderSounds = ['thunder', 'thunder_2', 'thunder_3'];
        const randomSound = thunderSounds[Math.floor(Math.random() * thunderSounds.length)];
        
        this.play(randomSound);
    }
    
    playWithVolume(name, volumeMultiplier) {
        if (!this.isReady || !this.sounds[name]) return;
        const soundClone = this.sounds[name].cloneNode();
        const finalVolume = Math.max(0, Math.min(1, this.masterVolume * volumeMultiplier));
        soundClone.volume = finalVolume;
        soundClone.play().catch(error => {});
    }

    playExclusive(name) {
        if (!this.isReady || !this.sounds[name]) return;
        const currentInstance = this.exclusiveInstances[name];
        if (currentInstance && !currentInstance.ended) return;
        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = this.masterVolume;
        soundClone.play().catch(error => {});
        this.exclusiveInstances[name] = soundClone;
    }

    playStrikeSound() {
        if (!this.isReady || !this.sounds['strike']) return;
        if (this.strikeSoundInstance && !this.strikeSoundInstance.ended) return;
        const soundClone = this.sounds['strike'].cloneNode();
        soundClone.volume = this.masterVolume;
        soundClone.play().catch(error => {});
        this.strikeSoundInstance = soundClone;
        this.strikeSoundInstance.onended = () => { this.strikeSoundInstance = null; };
    }

    stopStrikeSound() {
        if (this.strikeSoundInstance && !this.strikeSoundInstance.paused) {
            this.strikeSoundInstance.pause();
            this.strikeSoundInstance.currentTime = 0;
            this.strikeSoundInstance = null;
        }
    }

    startLoop(name) {
        if (!this.isReady || !this.sounds[name]) return;
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

    stopAllLoops() {
        this.stopLoop('walk');
        this.setWeatherSound(null);
    }
    
    // ================== POCZĄTEK NOWEGO KODU ==================
    /**
     * Ustawia główną głośność i aktualizuje wszystkie aktywne dźwięki.
     * @param {number} level - Głośność w zakresie od 0.0 do 1.0.
     */
    setMasterVolume(level) {
        this.masterVolume = Math.max(0, Math.min(1, level));

        // Aktualizacja dźwięków w pętli (np. chodzenie)
        if (this.sounds['walk'] && !this.sounds['walk'].paused) {
            this.sounds['walk'].volume = this.masterVolume;
        }
        if (this.sounds['walking_wood'] && !this.sounds['walking_wood'].paused) {
            this.sounds['walking_wood'].volume = this.masterVolume;
        }
        
        // Aktualizacja głośności dźwięków pogody (które mają własną logikę fade)
        // wywoła się automatycznie w następnej klatce pętli `update`
    }
    // =================== KONIEC NOWEGO KODU ===================
}