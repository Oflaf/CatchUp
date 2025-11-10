'use strict';

class GraphicsSettingsManager {
    constructor() {
        this.QUALITY_LEVELS = [
            { name: 'Cut off', scale: 0.96 },
            { name: 'Auto', scale: 1.0 },
        ];
        // Zmieniamy definicję: ratio to teraz liczba, a ostatnia opcja to "Fill Window"
        this.ASPECT_RATIOS = [
            { name: 'Auto', ratio: 16 / 9 },
            { name: '16:10', ratio: 16 / 10 },
            { name: '21:9', ratio: 21 / 9 },
            { name: 'Stretch', ratio: null } // Rozciągnie obraz, by wypełnić okno
        ];

        this.settings = {
            quality: 2,
            aspectRatio: 0,
            gamma: 50,
            contrast: 50,
            brightness: 50
        };

        this._bindElements();
        this._loadSettings();
        this._setupEventListeners();

        this.updateAllDisplays();
        this.applyAllSettings();
    }

    _bindElements() {
        this.gameCanvas = document.getElementById('gameCanvas');
        this.valueDisplays = {
            quality: document.getElementById('resolution-value'),
            aspectRatio: document.getElementById('aspect-ratio-value'),
            gamma: document.getElementById('gamma-value'),
            contrast: document.getElementById('contrast-value'),
            brightness: document.getElementById('brightness-value')
        };
        this.arrows = {
            quality: { left: document.getElementById('resolution-left'), right: document.getElementById('resolution-right') },
            aspectRatio: { left: document.getElementById('aspect-ratio-left'), right: document.getElementById('aspect-ratio-right') },
            gamma: { left: document.getElementById('gamma-left'), right: document.getElementById('gamma-right') },
            contrast: { left: document.getElementById('contrast-left'), right: document.getElementById('contrast-right') },
            brightness: { left: document.getElementById('brightness-left'), right: document.getElementById('brightness-right') }
        };
    }

    _setupEventListeners() {
        this.arrows.quality.left.addEventListener('click', () => this._changeQuality(-1));
        this.arrows.quality.right.addEventListener('click', () => this._changeQuality(1));
        this.arrows.aspectRatio.left.addEventListener('click', () => this._changeAspectRatio(-1));
        this.arrows.aspectRatio.right.addEventListener('click', () => this._changeAspectRatio(1));
        this.arrows.gamma.left.addEventListener('click', () => this._changeSlider('gamma', -5));
        this.arrows.gamma.right.addEventListener('click', () => this._changeSlider('gamma', 5));
        this.arrows.contrast.left.addEventListener('click', () => this._changeSlider('contrast', -5));
        this.arrows.contrast.right.addEventListener('click', () => this._changeSlider('contrast', 5));
        this.arrows.brightness.left.addEventListener('click', () => this._changeSlider('brightness', -5));
        this.arrows.brightness.right.addEventListener('click', () => this._changeSlider('brightness', 5));
    }

    // --- Metody do zmiany ustawień ---

    _changeQuality(direction) {
        this.settings.quality = (this.settings.quality + direction + this.QUALITY_LEVELS.length) % this.QUALITY_LEVELS.length;
        this.updateDisplay('quality');
        this.applyAllSettings(); // Musi aplikować obie zmiany
        this._saveSettings();
    }

    _changeAspectRatio(direction) {
        this.settings.aspectRatio = (this.settings.aspectRatio + direction + this.ASPECT_RATIOS.length) % this.ASPECT_RATIOS.length;
        this.updateDisplay('aspectRatio');
        this.applyAllSettings(); // Musi aplikować obie zmiany
        this._saveSettings();
    }
    
    _changeSlider(key, amount) {
        this.settings[key] = Math.max(0, Math.min(100, this.settings[key] + amount));
        this.updateDisplay(key);
        this._applyFilters();
        this._saveSettings();
    }

    // --- Metody do aplikowania ustawień ---

    applyAllSettings() {
        const selectedRatio = this.ASPECT_RATIOS[this.settings.aspectRatio];
        const quality = this.QUALITY_LEVELS[this.settings.quality];

        // Krok 1: Zaktualizuj style CSS
        if (selectedRatio.ratio === null) {
            // Tryb "Fill Window" (rozciąganie)
            this.gameCanvas.style.objectFit = 'fill';
            this.gameCanvas.style.aspectRatio = 'auto';
        } else {
            // Tryb proporcji (wypełnij i utnij)
            this.gameCanvas.style.objectFit = 'cover';
            this.gameCanvas.style.aspectRatio = `${selectedRatio.ratio * 10000} / 10000`; // Precyzyjny zapis dla CSS
        }
        
        // Krok 2: Ustaw bazową, logiczną szerokość gry
        // Jeśli rozciągamy, bazą jest 16:9. W przeciwnym razie, obliczamy nową szerokość.
        const baseWidth = selectedRatio.ratio ? DEDICATED_GAME_HEIGHT * selectedRatio.ratio : 1920;

        // Krok 3: Zmień faktyczne wymiary płótna, uwzględniając skalę jakości
        const newCanvasWidth = Math.round(baseWidth * quality.scale);
        const newCanvasHeight = Math.round(DEDICATED_GAME_HEIGHT * quality.scale);

        if (this.gameCanvas.width !== newCanvasWidth || this.gameCanvas.height !== newCanvasHeight) {
            this.gameCanvas.width = newCanvasWidth;
            this.gameCanvas.height = newCanvasHeight;
            
            // Poinformuj główny skrypt o zmianie LOGICZNEJ szerokości
            // To kluczowe dla kamery i innych elementów
            if (window.DEDICATED_GAME_WIDTH !== baseWidth) {
                window.DEDICATED_GAME_WIDTH = baseWidth;
                // Poinformuj menedżera gwiazd, aby przerysował tło dla nowego rozmiaru
                if (window.starManager) {
                    window.starManager.initialize(window.DEDICATED_GAME_WIDTH, window.DEDICATED_GAME_HEIGHT);
                }
            }
            
            // Zresetuj wygładzanie
            const ctx = this.gameCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
        }

        // Krok 4: Zastosuj filtry
        this._applyFilters();
    }

    _applyFilters() {
        const brightness = this.settings.brightness / 50;
        const contrast = this.settings.contrast / 50;
        const gamma = this.settings.gamma / 50;
        this.gameCanvas.style.filter = `brightness(${brightness * gamma}) contrast(${contrast})`;
    }

    // --- Metody UI i zapisu (bez zmian) ---

    updateDisplay(key) {
        const display = this.valueDisplays[key];
        if (!display) return;

        if (key === 'quality') {
            display.textContent = this.QUALITY_LEVELS[this.settings.quality].name;
        } else if (key === 'aspectRatio') {
            display.textContent = this.ASPECT_RATIOS[this.settings.aspectRatio].name;
        } else {
            display.textContent = `${this.settings[key]}%`;
        }
    }

    updateAllDisplays() {
        for (const key in this.settings) this.updateDisplay(key);
    }

    _saveSettings() {
        localStorage.setItem('catchinClub_graphicsSettings', JSON.stringify(this.settings));
    }

    _loadSettings() {
        const saved = localStorage.getItem('catchinClub_graphicsSettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) { console.error("Failed to load graphics settings:", e); }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.graphicsSettingsManager = new GraphicsSettingsManager();
});