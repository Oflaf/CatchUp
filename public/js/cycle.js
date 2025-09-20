'use strict';

class CycleManager {
    constructor() {
        this.image = null;
        this.isLoaded = false;
        
        this.moonImages = [];
        this.moonImagePaths = [
            'img/world/moon.png',
            'img/world/moon2.png',
            'img/world/moon3.png',
            'img/world/moon4.png'
        ];
        this.areMoonsLoaded = false;
        this.currentMoonImage = null;

        this.rotation = 0;
        this.ROTATION_SPEED = 0.0071;
        this.SCALE = 6.4;
        this.MOON_SCALE = 2.4;
    }

    load() {
        this.image = new Image();
        this.image.src = 'img/world/cycle.png';
        this.image.onload = () => {
            this.isLoaded = true;
            console.log("Obraz cyklu dnia i nocy został załadowany przez CycleManager.");
        };
        this.image.onerror = () => {
            console.error("Błąd podczas ładowania obrazu cyklu dnia i nocy: 'img/world/cycle.png'");
        };

        let loadedMoons = 0;
        this.moonImagePaths.forEach((path, index) => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                loadedMoons++;
                this.moonImages[index] = img;
                if (loadedMoons === this.moonImagePaths.length) {
                    this.areMoonsLoaded = true;
                    this.currentMoonImage = this.moonImages[0];
                    console.log("Wszystkie obrazy księżyca zostały załadowane przez CycleManager.");
                }
            };
            img.onerror = () => {
                console.error(`Błąd podczas ładowania obrazu księżyca: '${path}'`);
            };
        });
    }

    update(deltaTime) {
        if (!this.isLoaded) return;
        this.rotation += this.ROTATION_SPEED * deltaTime;
        this.rotation %= (Math.PI * 12);

        if (this.areMoonsLoaded) {
            const dayInCycle = Math.floor(this.rotation / (Math.PI * 2));
            switch (dayInCycle) {
                case 0: this.currentMoonImage = this.moonImages[0]; break;
                case 1: this.currentMoonImage = this.moonImages[1]; break;
                case 2: this.currentMoonImage = this.moonImages[2]; break;
                case 3: this.currentMoonImage = this.moonImages[3]; break;
                case 4: this.currentMoonImage = this.moonImages[2]; break;
                case 5: this.currentMoonImage = this.moonImages[1]; break;
                default: this.currentMoonImage = this.moonImages[0]; break;
            }
        }
    }

    // ================== POCZĄTEK ZMIAN ==================

    /**
     * Rysuje TŁO cyklu dnia i nocy (obraz cycle.png).
     * Zakłada, że transformacje (translate/rotate) zostały już zastosowane.
     */
    drawBackground(ctx) {
        if (!this.isLoaded) return;
        const scaledWidth = this.image.width * this.SCALE;
        const scaledHeight = this.image.height * this.SCALE;
        ctx.drawImage(
            this.image,
            -scaledWidth / 2,
            -scaledHeight / 2,
            scaledWidth,
            scaledHeight
        );
    }

    /**
     * Rysuje KSIĘŻYC na odpowiedniej pozycji na orbicie.
     * Zakłada, że transformacje (translate/rotate) zostały już zastosowane.
     */
    drawMoon(ctx) {
        if (!this.isLoaded || !this.areMoonsLoaded || !this.currentMoonImage) return;
        const scaledHeight = this.image.height * this.SCALE;
        const moonScaledWidth = this.currentMoonImage.width * this.MOON_SCALE;
        const moonScaledHeight = this.currentMoonImage.height * this.MOON_SCALE;
        const orbitRadius = scaledHeight / 2;
        ctx.drawImage(
            this.currentMoonImage,
            -moonScaledWidth / 2,
            orbitRadius - (moonScaledHeight / 2 + 342),
            moonScaledWidth,
            moonScaledHeight
        );
    }
    // =================== KONIEC ZMIAN ===================
}