'use strict';

/**
 * Zarządza interfejsem samouczka łowienia ryb.
 * Działa podobnie do tablicy ogłoszeń, ale wyświetla serię obrazków instruktażowych.
 */
class FishingTutorialManager {
    constructor() {
        this.isOpen = false;
        this.images = []; // Przechowuje załadowane obrazki samouczka (1-6.png)
        this.currentImageIndex = 0;
        
        this.isHovered = false;
        this.currentScale = 1.0;
        this.targetScale = 1.0;

        // Właściwości animacji przesuwania między obrazkami
        this.isAnimating = false;
        this.animationProgress = 0;
        this.animationDirection = 0; 
        this.outgoingImageIndex = 0;
        this.ANIMATION_DURATION_SECONDS = 0.4;

        // Właściwości animacji bujania
        this.SWAY_ANGLE_DEGREES = 4;
        this.SWAY_SPEED = 1.5;
        
        // Właściwości przybliżania/oddalania
        this.MIN_SCALE = 0.7;
        this.MAX_SCALE = 2.0;
        this.ZOOM_SENSITIVITY = 0.1;
        this.SCALE_SMOOTHING = 0.1;
    }

    /**
     * Ładuje obrazy samouczka przekazane z głównego skryptu.
     * @param {HTMLImageElement[]} images - Tablica załadowanych obrazów.
     */
    loadImages(images) {
        this.images = images;
        console.log(`Załadowano ${this.images.length} obrazów samouczka.`);
    }

    /**
     * Otwiera lub zamyka interfejs samouczka.
     */
    toggleUI() {
        this.isOpen ? this.close() : this.open();
    }

    /**
     * Otwiera widok samouczka.
     */
    open() {
        if (this.images.length === 0) {
            showNotification("Samouczek jest niedostępny.", "warning");
            return;
        }
        this.isOpen = true;
        this.targetScale = 1.0;
        this.currentScale = 0.8; // Rozpocznij z lekkim oddaleniem dla efektu
        soundManager.play('paper');
    }

    /**
     * Zamyka widok samouczka.
     */
    close() {
        this.isOpen = false;
        soundManager.play('paper');
    }

    /**
     * Przełącza na następny obrazek w samouczku.
     */
    nextImage() {
        if (!this.isOpen || this.images.length <= 1 || this.isAnimating) return;
        this.isAnimating = true;
        this.animationProgress = 0;
        this.animationDirection = 1; // Kierunek w prawo
        this.outgoingImageIndex = this.currentImageIndex;
        this.currentImageIndex = (this.currentImageIndex + 1) % this.images.length;
        soundManager.play('paper');
    }

    /**
     * Przełącza na poprzedni obrazek w samouczku.
     */
    previousImage() {
        if (!this.isOpen || this.images.length <= 1 || this.isAnimating) return;
        this.isAnimating = true;
        this.animationProgress = 0;
        this.animationDirection = -1; // Kierunek w lewo
        this.outgoingImageIndex = this.currentImageIndex;
        this.currentImageIndex = (this.currentImageIndex - 1 + this.images.length) % this.images.length;
        soundManager.play('paper');
    }

    /**
     * Aktualizuje stan animacji i skalowania.
     * @param {number} deltaTime - Czas od ostatniej klatki w sekundach.
     */
    update(deltaTime) {
        if (!this.isOpen) return;
        
        // Płynne skalowanie do wartości docelowej
        this.currentScale += (this.targetScale - this.currentScale) * this.SCALE_SMOOTHING;

        // Aktualizacja postępu animacji przesuwania
        if (this.isAnimating) {
            this.animationProgress += deltaTime / this.ANIMATION_DURATION_SECONDS;
            if (this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.isAnimating = false;
            }
        }
    }
    
    /**
     * Obsługuje przybliżanie/oddalanie za pomocą kółka myszy.
     * @param {WheelEvent} event - Obiekt zdarzenia kółka myszy.
     */
    handleWheel(event) {
        if (!this.isOpen || !this.isHovered) return;
        event.preventDefault();
        
        const delta = event.deltaY > 0 ? -1 : 1;
        this.targetScale += delta * this.ZOOM_SENSITIVITY;
        
        this.targetScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.targetScale));
    }

    /**
     * Sprawdza, czy kursor myszy znajduje się nad obrazkiem samouczka.
     * @param {number} mouseX - Pozycja X myszy.
     * @param {number} mouseY - Pozycja Y myszy.
     */
    handleMouseMove(mouseX, mouseY) {
        if (!this.isOpen) {
            this.isHovered = false;
            return;
        }
        
        const img = this.images[this.currentImageIndex];
        if (!img) return;

        const { imgWidth, imgHeight } = this._calculateImageDimensions();
        const x = (canvas.width - imgWidth) / 2;
        const y = (canvas.height - imgHeight) / 2;

        this.isHovered = (mouseX > x && mouseX < x + imgWidth && mouseY > y && mouseY < y + imgHeight);
    }
    
    /**
     * Funkcja wygładzająca dla animacji.
     * @param {number} x - Postęp animacji (0-1).
     */
    easeOutCubic(x) { 
        return 1 - Math.pow(1 - x, 3); 
    }

    /**
     * Rysuje interfejs samouczka na canvasie.
     * @param {CanvasRenderingContext2D} ctx - Kontekst rysowania.
     */
    draw(ctx) {
        if (!this.isOpen) return;

        // Przyciemnij tło
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();

        // Rysuj aktualne i/lub animowane obrazki
        if (this.isAnimating) {
            const easedProgress = this.easeOutCubic(this.animationProgress);
            const outgoingXOffset = -easedProgress * ctx.canvas.width * this.animationDirection;
            this._drawImage(ctx, this.outgoingImageIndex, outgoingXOffset);
            
            const incomingXOffset = ctx.canvas.width * this.animationDirection * (1 - easedProgress);
            this._drawImage(ctx, this.currentImageIndex, incomingXOffset);
        } else {
            this._drawImage(ctx, this.currentImageIndex, 0);
        }
    }

    /**
     * Oblicza wymiary obrazka, aby pasował do ekranu, zachowując proporcje.
     * @returns {{imgWidth: number, imgHeight: number}}
     */
    _calculateImageDimensions() {
        const image = this.images[this.currentImageIndex];
        if (!image) return { imgWidth: 0, imgHeight: 0 };

        const aspect = image.width / image.height;
        let imgHeight = canvas.height * 0.8 * this.currentScale;
        let imgWidth = imgHeight * aspect;

        if (imgWidth > canvas.width * 0.8 * this.currentScale) {
            imgWidth = canvas.width * 0.8 * this.currentScale;
            imgHeight = imgWidth / aspect;
        }
        return { imgWidth, imgHeight };
    }

    /**
     * Rysuje pojedynczy obrazek samouczka z animacjami.
     * @param {CanvasRenderingContext2D} ctx - Kontekst rysowania.
     * @param {number} imageIndex - Indeks obrazka do narysowania.
     * @param {number} xOffset - Przesunięcie w osi X na potrzeby animacji przesuwania.
     */
    _drawImage(ctx, imageIndex, xOffset) {
        const image = this.images[imageIndex];
        if (!image || !image.complete) return;

        const time = Date.now() / 1000;
        const { imgWidth, imgHeight } = this._calculateImageDimensions();
        
        const x = (ctx.canvas.width / 2) + xOffset;
        const y = ctx.canvas.height / 2;

        ctx.save();
        ctx.translate(x, y);

        // Animacja bujania
        const swayAngle = Math.sin(time * this.SWAY_SPEED) * (this.SWAY_ANGLE_DEGREES * Math.PI / 180);
        ctx.rotate(swayAngle);

        ctx.drawImage(image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        
        ctx.restore();
    }
}