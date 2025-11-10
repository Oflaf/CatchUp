'use strict';

class SettingsManager {
    constructor(soundManager) {
        this.soundManager = soundManager;

        this.settings = {
            masterVolume: 100,
            world: 100,
            music: 100,
            player: 100,
            ui: 100,
            mobile: false,
            fastKeyResponse: false
        };

        this.isVisible = false;
        this.activeTab = 'sound';

        this._bindElements();
        this._setupEventListeners();
        this.updateAllDisplays();
        this._applyMobileControlsVisibility();
        this._switchTab(this.activeTab);
    }

    _bindElements() {
        this.settingsWindow = document.getElementById('settings-window');
        this.closeButton = document.getElementById('settings-close-btn');
        this.optionsButton = document.getElementById('optionsBtn');
        this.inGameSettingsBtn = document.getElementById('inGameSettingsBtn');
        this.mobileControlsContainer = document.getElementById('mobile-controls');

        this.tabs = {
            sound: document.getElementById('tab-sound'),
            console: document.getElementById('tab-console'),
            graphics: document.getElementById('tab-graphics')
        };

        this.panels = {
            sound: document.getElementById('sound-settings-panel'),
            console: document.getElementById('console-settings-panel'),
            graphics: document.getElementById('graphics-settings-panel')
        };

        this.valueDisplays = {
            masterVolume: document.getElementById('master-volume-value'),
            world: document.getElementById('world-value'),
            music: document.getElementById('music-value'),
            player: document.getElementById('player-volume-value'),
            ui: document.getElementById('ui-volume-value'),
        };

        this.muteIcons = {
            masterVolume: document.getElementById('master-volume-mute'),
            world: document.getElementById('world-mute'),
            music: document.getElementById('music-mute'),
            player: document.getElementById('player-mute'),
            ui: document.getElementById('ui-mute'),
        };

        this.checkImages = {
            mobile: document.getElementById('mobile-check-img'),
            fastKeyResponse: document.getElementById('fast-key-response-check-img')
        };

        this.arrows = {
            masterVolume: { left: document.getElementById('master-volume-left'), right: document.getElementById('master-volume-right') },
            world: { left: document.getElementById('world-left'), right: document.getElementById('world-right') },
            music: { left: document.getElementById('music-left'), right: document.getElementById('music-right') },
            player: { left: document.getElementById('player-volume-left'), right: document.getElementById('player-volume-right') },
            ui: { left: document.getElementById('ui-volume-left'), right: document.getElementById('ui-volume-right') }
        };

        this.toggles = {
            mobile: document.getElementById('mobile-toggle'),
            fastKeyResponse: document.getElementById('fast-key-response-toggle')
        };
    }

    _setupEventListeners() {
        this.closeButton.addEventListener('click', () => this.close());
        this.optionsButton.addEventListener('click', () => this.open());
        this.inGameSettingsBtn.addEventListener('click', () => this.open());

        for (const tabName in this.tabs) {
            this.tabs[tabName].addEventListener('click', () => this._switchTab(tabName));
        }

        for (const key in this.arrows) {
            this.arrows[key].left.addEventListener('click', () => this._changeValue(key, -5));
            this.arrows[key].right.addEventListener('click', () => this._changeValue(key, 5));
        }

        for (const key in this.toggles) {
            this.toggles[key].addEventListener('click', () => this._toggleValue(key));
        }
        
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Escape' && this.isVisible) {
                this.close();
            }
        });
    }

    _switchTab(tabName) {
        this.soundManager.play('menuNavigate');
        this.activeTab = tabName;

        for (const key in this.tabs) {
            this.tabs[key].classList.toggle('active', key === tabName);
            this.panels[key].classList.toggle('active', key === tabName);
        }
    }

    _toggleValue(key) {
        this.soundManager.play('menuNavigate');
        this.settings[key] = !this.settings[key];
        this.updateDisplay(key);

        if (key === 'mobile') {
            this._applyMobileControlsVisibility();
        }
    }

    _changeValue(key, amount) {
        this.soundManager.play('menuNavigate');

        let currentValue = this.settings[key];
        let newValue = currentValue + amount;
        newValue = Math.max(0, Math.min(100, newValue));

        if (this.settings[key] !== newValue) {
            this.settings[key] = newValue;
            this.updateDisplay(key);

            const volumeLevel = newValue / 100;

            // === ZMIANA: Podłączenie wszystkich suwaków ===
            switch (key) {
                case 'masterVolume':
                    this.soundManager.setMasterVolume(volumeLevel);
                    break;
                case 'world':
                    this.soundManager.setWorldVolume(volumeLevel);
                    break;
                case 'music':
                    this.soundManager.setMusicVolume(volumeLevel);
                    break;
                case 'player':
                    this.soundManager.setPlayerVolume(volumeLevel);
                    break;
                case 'ui':
                    this.soundManager.setUiVolume(volumeLevel);
                    break;
            }
        }
    }

    _applyMobileControlsVisibility() {
        if (this.settings.mobile) {
            this.mobileControlsContainer.classList.remove('hidden');
        } else {
            this.mobileControlsContainer.classList.add('hidden');
        }
    }

    updateDisplay(key) {
        const value = this.settings[key];

        if (typeof value === 'boolean') {
            const imgElement = this.checkImages[key];
            if (imgElement) {
                imgElement.src = value ? 'img/ui/tick.png' : 'img/ui/cross.png';
            }
            return;
        }
        
        const displayElement = this.valueDisplays[key];
        const muteIconElement = this.muteIcons[key];

        if (displayElement && muteIconElement) {
            if (value === 0) {
                displayElement.style.display = 'none';
                muteIconElement.style.display = 'block';
            } else {
                displayElement.style.display = 'block';
                muteIconElement.style.display = 'none';
                displayElement.textContent = `${value}%`;
            }
        }
    }

    updateAllDisplays() {
        for (const key in this.settings) {
            this.updateDisplay(key);
        }
    }

    open() {
        if (this.isVisible) return;
        this.soundManager.play('menuClick'); 
        this.isVisible = true;
        this.settingsWindow.classList.add('visible');
        this._switchTab('sound');
    }

    close() {
        if (!this.isVisible) return;
        this.soundManager.play('menuClick');
        this.isVisible = false;
        this.settingsWindow.classList.remove('visible');
    }
}