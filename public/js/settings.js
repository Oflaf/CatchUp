'use strict';

class SettingsManager {
    constructor(soundManager) {
        this.soundManager = soundManager;

        // Domyślne wartości
        this.settings = {
            masterVolume: 100,
            world: 100,
            music: 100,
            mobileControls: false
        };

        this.isVisible = false;
        this._bindElements();
        this._setupEventListeners();
        this.updateAllDisplays();
        this._applyMobileControlsVisibility();
    }

    _bindElements() {
        this.settingsWindow = document.getElementById('settings-window');
        this.closeButton = document.getElementById('settings-close-btn');
        this.optionsButton = document.getElementById('optionsBtn');
        this.inGameSettingsBtn = document.getElementById('inGameSettingsBtn');
        this.mobileControlsContainer = document.getElementById('mobile-controls');

        this.valueDisplays = {
            masterVolume: document.getElementById('master-volume-value'),
            world: document.getElementById('world-value'),
            music: document.getElementById('music-value'),
            mobileControls: document.getElementById('mobile-controls-value')
        };

        this.arrows = {
            masterVolume: { left: document.getElementById('master-volume-left'), right: document.getElementById('master-volume-right') },
            world: { left: document.getElementById('world-left'), right: document.getElementById('world-right') },
            music: { left: document.getElementById('music-left'), right: document.getElementById('music-right') },
            mobileControls: { left: document.getElementById('mobile-controls-left'), right: document.getElementById('mobile-controls-right') }
        };
    }

    _setupEventListeners() {
        this.closeButton.addEventListener('click', () => this.close());
        this.optionsButton.addEventListener('click', () => this.open());
        this.inGameSettingsBtn.addEventListener('click', () => this.open());

        for (const key in this.arrows) {
            this.arrows[key].left.addEventListener('click', () => this._changeValue(key, -5));
            this.arrows[key].right.addEventListener('click', () => this._changeValue(key, 5));
        }
        
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Escape' && this.isVisible) {
                this.close();
            }
        });
    }

    _changeValue(key, amount) {
        // === DODANO DŹWIĘK NAWIGACJI ===
        this.soundManager.play('menuNavigate');

        if (key === 'mobileControls') {
            this.settings.mobileControls = !this.settings.mobileControls;
            this.updateDisplay(key);
            this._applyMobileControlsVisibility();
            return;
        }

        let currentValue = this.settings[key];
        let newValue = currentValue + amount;
        newValue = Math.max(0, Math.min(100, newValue));

        if (this.settings[key] !== newValue) {
            this.settings[key] = newValue;
            this.updateDisplay(key);

            if (key === 'masterVolume') {
                this.soundManager.setMasterVolume(newValue / 100);
            }
        }
    }

    _applyMobileControlsVisibility() {
        if (this.settings.mobileControls) {
            this.mobileControlsContainer.classList.remove('hidden');
        } else {
            this.mobileControlsContainer.classList.add('hidden');
        }
    }

    updateDisplay(key) {
        const value = this.settings[key];
        const displayElement = this.valueDisplays[key];

        if (key === 'mobileControls') {
            displayElement.textContent = value ? "ON" : "OFF";
            return;
        }

        if (value === 0) {
            displayElement.textContent = "MUTE";
        } else {
            displayElement.textContent = `${value}%`;
        }
    }

    updateAllDisplays() {
        for (const key in this.settings) {
            this.updateDisplay(key);
        }
    }

    open() {
        if (this.isVisible) return;
        // === DODANO DŹWIĘK OTWIERANIA ===
        this.soundManager.play('menuClick'); 
        this.isVisible = true;
        this.settingsWindow.classList.add('visible');
    }

    close() {
        if (!this.isVisible) return;
        // === DODANO DŹWIĘK ZAMYKANIA ===
        this.soundManager.play('menuClick');
        this.isVisible = false;
        this.settingsWindow.classList.remove('visible');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof soundManager !== 'undefined') {
        window.settingsManager = new SettingsManager(soundManager);
    } else {
        console.error('SoundManager not found for Settings initialization.');
    }
});