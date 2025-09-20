'use strict';

class CycleManager {
    constructor() {
        this.image = null;
        this.isLoaded = false;
        this.rotation = 0; // Kąt w radianach
        this.ROTATION_SPEED = 0.0071; // Prędkość obrotu (w radianach na sekundę)
        this.SCALE = 6.4; // Mnożnik powiększenia grafiki
    }

    /**
     * Wczytuje obraz cyklu dnia i nocy.
     */
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
    }

    /**
     * Aktualizuje kąt obrotu na podstawie czasu, który upłynął od ostatniej klatki.
     * @param {number} deltaTime - Czas w sekundach od ostatniej klatki.
     */
    update(deltaTime) {
        if (!this.isLoaded) return;
        
        this.rotation += this.ROTATION_SPEED * deltaTime;
        // Utrzymuje wartość obrotu w zakresie 0 - 2*PI, aby uniknąć dużych liczb
        this.rotation %= (Math.PI * 8);
    }

    /**
     * Rysuje obrócony i przeskalowany obraz cyklu na podanym kontekście canvas.
     * Ta funkcja powinna być wywoływana jako pierwsza, zaraz po wyczyszczeniu canvas.
     * @param {CanvasRenderingContext2D} ctx - Kontekst 2D canvas.
     */
    draw(ctx) {
        if (!this.isLoaded) return;

        const canvas = ctx.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const scaledWidth = this.image.width * this.SCALE;
        const scaledHeight = this.image.height * this.SCALE;

        ctx.save();
        // Przesuń punkt odniesienia do środka canvas
        ctx.translate(centerX, centerY+2150);
        // Obróć kontekst
        ctx.rotate(this.rotation);
        // Narysuj obraz, centrując go w nowym punkcie (0,0)
        ctx.drawImage(
            this.image,
            -scaledWidth / 2,
            -scaledHeight / 2,
            scaledWidth,
            scaledHeight
        );
        ctx.restore();
    }
}