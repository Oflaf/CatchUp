'use strict';

class SoundManager {
    constructor(soundtrackManager) {
        this.soundtrackManager = soundtrackManager;
        this.sounds = {};
        this.isReady = false;

        this.volumes = {
            master: 1.0,
            world: 1.0,
            player: 1.0,
            ui: 1.0,
            music: 1.0
        };

        this.soundCategories = {
            'background': 'world',
            'night': 'world',
            'bird': 'world',
            'waterSplash': 'world',
            'drizzle': 'world',
            'rain': 'world',
            'storm': 'world',
            'thunder': 'world',
            'thunder_2': 'world',
            'thunder_3': 'world',
            'camp': 'world',
            'walk': 'player',
            'walking_wood': 'player',
            'jump': 'player',
            'land': 'player',
            'cast': 'player',
            'reelIn': 'player',
            'dig': 'player',
            'stone_breaking': 'player',
            'strike': 'player',
            'strike_2': 'player',
            'fishing': 'player',
            'catchin': 'player',
            'catchout': 'player',
            'catch': 'player',
            'menuClick': 'ui',
            'menuNavigate': 'ui',
            'clothNavigate': 'ui',
            'info': 'ui',
            'inventory': 'ui',
            'throw': 'ui',
            'fish': 'ui',
            'hook': 'ui',
            'bait': 'ui',
            'itemChange': 'ui',
            'gem_found': 'ui'
        };

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

    // === JEDYNA ZMIANA TUTAJ: Użycie operatora `??` zamiast `||` ===
    _getFinalVolume(category, volumeMultiplier = 1) {
        const categoryVolume = this.volumes[category] ?? 1.0; // Używamy ?? aby 0 było traktowane jako poprawna wartość
        return Math.max(0, Math.min(1, this.volumes.master * categoryVolume * volumeMultiplier));
    }
    
    update(deltaTime) {
        if (!this.isReady) return;

        for (const soundName in this.weatherSounds) {
            const soundData = this.weatherSounds[soundName];
            if (!soundData.instance) continue;

            const currentVolume = soundData.instance.volume;
            const targetVolume = this._getFinalVolume('world', soundData.targetVolume);

            if (currentVolume !== targetVolume) {
                const difference = targetVolume - currentVolume;
                const change = this.FADE_SPEED * deltaTime * Math.sign(difference);

                let newVolume = Math.abs(difference) > Math.abs(change) ? currentVolume + change : targetVolume;
                soundData.instance.volume = newVolume;

                if (soundData.instance.volume > 0 && soundData.instance.paused) {
                    soundData.instance.play().catch(e => {});
                } else if (soundData.instance.volume <= 0 && !soundData.instance.paused) {
                    soundData.instance.pause();
                }
            }
        }
    }

    setWeatherSound(weatherType) {
        if (!this.isReady) return;
        for (const soundName in this.weatherSounds) {
            this.weatherSounds[soundName].targetVolume = (soundName === weatherType) ? 1.0 : 0;
        }
    }

    play(name) {
        if (!this.isReady || !this.sounds[name]) return;
        const category = this.soundCategories[name] || 'world';
        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = this._getFinalVolume(category);
        soundClone.play().catch(error => {});
    }
    
    playRandomThunder() {
        if (!this.isReady) return;
        this.play('thunder');
    }
    
    playWithVolume(name, volumeMultiplier) {
        if (!this.isReady || !this.sounds[name]) return;
        const category = this.soundCategories[name] || 'player';
        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = this._getFinalVolume(category, volumeMultiplier);
        soundClone.play().catch(error => {});
    }

    playExclusive(name) {
        if (!this.isReady || !this.sounds[name]) return;
        const currentInstance = this.exclusiveInstances[name];
        if (currentInstance && !currentInstance.ended) return;
        const category = this.soundCategories[name] || 'player';
        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = this._getFinalVolume(category);
        soundClone.play().catch(error => {});
        this.exclusiveInstances[name] = soundClone;
    }

    playStrikeSound() {
        if (!this.isReady || !this.sounds['strike']) return;
        if (this.strikeSoundInstance && !this.strikeSoundInstance.ended) return;
        const soundClone = this.sounds['strike'].cloneNode();
        soundClone.volume = this._getFinalVolume('player');
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
            const category = this.soundCategories[name] || 'world';
            sound.loop = true;
            sound.volume = this._getFinalVolume(category);
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
        this.stopLoop('walking_wood');
        this.stopLoop('night');
        this.stopLoop('background');
        this.setWeatherSound(null);
    }

    _updateAllVolumes() {
        if (this.sounds['walk'] && !this.sounds['walk'].paused) {
            this.sounds['walk'].volume = this._getFinalVolume('player');
        }
        if (this.sounds['walking_wood'] && !this.sounds['walking_wood'].paused) {
            this.sounds['walking_wood'].volume = this._getFinalVolume('player');
        }
        if (this.sounds['night'] && !this.sounds['night'].paused) {
            this.sounds['night'].volume = this._getFinalVolume('world');
        }
        if (this.sounds['background'] && !this.sounds['background'].paused) {
            this.sounds['background'].volume = this._getFinalVolume('world');
        }
        if (this.soundtrackManager) {
            this.soundtrackManager.setVolume(this._getFinalVolume('music'));
        }
    }

    setMasterVolume(level) {
        this.volumes.master = level;
        this._updateAllVolumes();
    }
    setWorldVolume(level) {
        this.volumes.world = level;
        this._updateAllVolumes();
    }
    setPlayerVolume(level) {
        this.volumes.player = level;
        this._updateAllVolumes();
    }
    setUiVolume(level) {
        this.volumes.ui = level;
    }
    setMusicVolume(level) {
        this.volumes.music = level;
        if (this.soundtrackManager) {
            this.soundtrackManager.setVolume(this._getFinalVolume('music'));
        }
    }
}