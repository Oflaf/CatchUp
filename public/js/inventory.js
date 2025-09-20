function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

class InventoryManager {
    constructor() {
        this.isOpen = false;
        this.frameImage = null; // Tutaj przechowamy załadowany obrazek slotu
        this.assetsLoaded = false;
        this.slots = [];
        this.mousePos = { x: 0, y: 0 }; // Pozycja myszy na canvasie

        this.SLOT_SIZE = 92; // Bazowy rozmiar slotu
        this.GRID_GAP = 12;  // Odstęp między slotami

        this._initSlots();
        this.loadAssets();
    }

    /**
     * Inicjalizuje 9 obiektów slotów z ich unikalnymi właściwościami animacji.
     * @private
     */
    _initSlots() {
        for (let i = 0; i < 9; i++) {
            this.slots.push({
                id: i,
                // Właściwości animacji
                scale: 1.0,
                targetScale: 1.0, // Cel, do którego dąży skala
                rotation: 0,
                // Parametry unikalne dla każdego slotu
                rockingTimer: Math.random() * Math.PI * 2, // Losowy punkt startowy animacji
                rockingSpeed: 1.8 + Math.random() * 0.5,   // Różna prędkość kołysania
                rockingAmplitude: (1.5 + Math.random()) * (Math.PI / 180) // Różna amplituda w radianach
            });
        }
    }

    /**
     * Asynchronicznie ładuje obrazek 'frame.png'.
     */
    async loadAssets() {
        try {
            const img = new Image();
            img.src = 'img/ui/frame.png';
            await img.decode(); // Czekaj na pełne załadowanie i zdekodowanie obrazu
            this.frameImage = img;
            this.assetsLoaded = true;
            console.log('Inventory assets loaded successfully.');
        } catch (error) {
            console.error('Failed to load inventory assets:', error);
        }
    }

    /**
     * Przełącza widoczność ekwipunku.
     */
    toggle() {
        this.isOpen = !this.isOpen;
    }

    /**
     * Aktualizuje pozycję myszy. Wywoływane z głównego skryptu.
     * @param {number} x Pozycja X myszy na canvasie.
     * @param {number} y Pozycja Y myszy na canvasie.
     */
    updateMousePosition(x, y) {
        this.mousePos = { x, y };
    }

    /**
     * Główna funkcja aktualizująca logikę ekwipunku, wywoływana w każdej klatce.
     * @param {number} deltaTime Czas od ostatniej klatki.
     * @param {object} inventoryOrigin Obiekt {x, y} z lewym górnym rogiem ekwipunku na ekranie.
     */
    update(deltaTime, inventoryOrigin) {
        if (!this.isOpen || !this.assetsLoaded) {
            return;
        }

        const gridCols = 3;
        
        this.slots.forEach((slot, index) => {
            // Aktualizacja timera animacji kołysania
            slot.rockingTimer += slot.rockingSpeed * deltaTime;

            // Obliczanie pozycji slotu na ekranie
            const col = index % gridCols;
            const row = Math.floor(index / gridCols);
            const slotX = inventoryOrigin.x + col * (this.SLOT_SIZE + this.GRID_GAP);
            const slotY = inventoryOrigin.y + row * (this.SLOT_SIZE + this.GRID_GAP);

            // Sprawdzanie, czy mysz jest nad slotem (kolizja AABB)
            const isHovered = this.mousePos.x >= slotX &&
                              this.mousePos.x <= slotX + this.SLOT_SIZE &&
                              this.mousePos.y >= slotY &&
                              this.mousePos.y <= slotY + this.SLOT_SIZE;

            // Ustawianie docelowej skali i parametrów animacji na podstawie najechania
            if (isHovered) {
                slot.targetScale = 1.15;
                // Mocniejsze kołysanie
                slot.rotation = Math.sin(slot.rockingTimer * 2.5) * (6 * Math.PI / 180);
            } else {
                slot.targetScale = 1.0;
                // Delikatne kołysanie
                slot.rotation = Math.sin(slot.rockingTimer) * slot.rockingAmplitude;
            }

            // Płynne przejście do docelowej skali
            slot.scale = lerp(slot.scale, slot.targetScale, 0.2);
        });
    }

    /**
     * Rysuje ekwipunek na podanym kontekście canvasa.
     * @param {CanvasRenderingContext2D} ctx Kontekst 2D canvasa.
     * @param {object} inventoryOrigin Obiekt {x, y} z lewym górnym rogiem ekwipunku na ekranie.
     */
    draw(ctx, inventoryOrigin) {
        if (!this.isOpen || !this.assetsLoaded) {
            return;
        }

        const gridCols = 3;

        // Pamiętaj, że wyłączenie wygładzania (imageSmoothingEnabled = false)
        // jest już ustawione w `script.js`, więc tutaj będzie respektowane.

        this.slots.forEach((slot, index) => {
            const col = index % gridCols;
            const row = Math.floor(index / gridCols);
            
            // Obliczanie środka slotu
            const centerX = inventoryOrigin.x + col * (this.SLOT_SIZE + this.GRID_GAP) + this.SLOT_SIZE / 2;
            const centerY = inventoryOrigin.y + row * (this.SLOT_SIZE + this.GRID_GAP) + this.SLOT_SIZE / 2;

            ctx.save();
            
            // Przesuń punkt odniesienia do środka slotu, aby transformacje działały poprawnie
            ctx.translate(centerX, centerY);
            
            // Zastosuj skalowanie i rotację
            ctx.scale(slot.scale, slot.scale);
            ctx.rotate(slot.rotation);
            
            // Narysuj obrazek, centrując go w nowym punkcie odniesienia
            ctx.drawImage(this.frameImage, -this.SLOT_SIZE / 2, -this.SLOT_SIZE / 2, this.SLOT_SIZE, this.SLOT_SIZE);
            
            ctx.restore();
        });
    }
}