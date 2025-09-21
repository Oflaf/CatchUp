function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

class InventoryManager {
    constructor() {
        this.isOpen = false;
        this.frameImage = null;
        this.assetsLoaded = false;
        this.slots = [];
        this.mousePos = { x: 0, y: 0 };

        this.SLOT_SIZE = 92;
        this.GRID_GAP = 12;
        
        // --- NOWOŚĆ: Przenoszenie przedmiotów ---
        this.heldItem = null; // Przedmiot trzymany przez myszkę
        this.heldItemOriginalSlot = -1; // Z którego slotu podniesiono przedmiot

        this._initSlots();
        this.loadAssets();
    }

    _initSlots() {
        for (let i = 0; i < 9; i++) {
            this.slots.push({
                id: i,
                item: null, // <-- NOWOŚĆ: Każdy slot może przechowywać przedmiot
                scale: 1.0,
                targetScale: 1.0,
                rotation: 0,
                rockingTimer: Math.random() * Math.PI * 2,
                rockingSpeed: 1.8 + Math.random() * 0.5,
                rockingAmplitude: (1.5 + Math.random()) * (Math.PI / 180)
            });
        }
    }

    async loadAssets() {
        try {
            const img = new Image();
            img.src = 'img/ui/frame.png';
            await img.decode();
            this.frameImage = img;
            this.assetsLoaded = true;
            console.log('Inventory assets loaded successfully.');
        } catch (error) {
            console.error('Failed to load inventory assets:', error);
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        // Jeśli zamykamy ekwipunek trzymając przedmiot, odłóż go na miejsce
        if (!this.isOpen && this.heldItem) {
            this._dropItem(this.heldItemOriginalSlot);
        }
    }

    updateMousePosition(x, y) {
        this.mousePos = { x, y };
    }

    /**
     * NOWA FUNKCJA: Dodaje przedmiot do pierwszego wolnego slota.
     * @param {object} itemData - Obiekt z danymi przedmiotu (np. { name, image, tier }).
     * @returns {boolean} - Zwraca true, jeśli udało się dodać przedmiot, w przeciwnym razie false.
     */
    addItem(itemData) {
        const freeSlot = this.slots.find(slot => slot.item === null);
        if (freeSlot) {
            freeSlot.item = itemData;
            console.log(`Dodano ${itemData.name} do slotu ${freeSlot.id}`);
            return true;
        }
        console.warn("Ekwipunek jest pełny!");
        return false;
    }

    /**
     * NOWA FUNKCJA: Wywoływana przy kliknięciu myszką.
     * @param {object} inventoryOrigin - Pozycja lewego górnego rogu ekwipunku.
     */
    handleMouseDown(inventoryOrigin) {
    if (!this.isOpen) return false;

    const hoveredSlot = this._getHoveredSlot(inventoryOrigin);

    if (this.heldItem) {
        if (hoveredSlot) {
            // Upuszczamy na inny slot
            this._dropItem(hoveredSlot.id);
        } else {
            // Upuszczamy poza ekwipunkiem -> SYGNAŁ DO WYRZUCENIA
            const itemToDrop = this.heldItem;
            this.heldItem = null; // Czyścimy rękę
            this.heldItemOriginalSlot = -1;
            return itemToDrop; // Zwróć przedmiot, który ma zostać wyrzucony
        }
        return true; // Akcja wewnątrz ekwipunku została wykonana
    } else if (hoveredSlot && hoveredSlot.item) {
        this._pickupItem(hoveredSlot.id);
        return true; // Akcja wewnątrz ekwipunku została wykonana
    }

    return false; // Nie wykonano żadnej akcji
}

    /**
     * NOWA FUNKCJA WEWNĘTRZNA: Podnosi przedmiot ze slota.
     * @private
     */
    _pickupItem(slotId) {
        this.heldItem = this.slots[slotId].item;
        this.slots[slotId].item = null;
        this.heldItemOriginalSlot = slotId;
    }

    /**
     * NOWA FUNKCJA WEWNĘTRZNA: Upuszcza trzymany przedmiot.
     * @private
     */
    _dropItem(targetSlotId) {
        // Jeśli nie trafiliśmy w żaden slot, zwróć przedmiot na oryginalne miejsce
        if (targetSlotId === -1) {
            this.slots[this.heldItemOriginalSlot].item = this.heldItem;
        } else {
            const targetSlot = this.slots[targetSlotId];
            // Jeśli slot jest zajęty, zamień przedmioty miejscami
            if (targetSlot.item) {
                this.slots[this.heldItemOriginalSlot].item = targetSlot.item;
            }
            targetSlot.item = this.heldItem;
        }
        // Wyczyść stan trzymania
        this.heldItem = null;
        this.heldItemOriginalSlot = -1;
    }

    /**
     * NOWA FUNKCJA WEWNĘTRZNA: Znajduje slot, nad którym jest myszka.
     * @private
     * @returns {object|null} - Obiekt slota lub null.
     */
    _getHoveredSlot() { // Bez argumentu
    for (const slot of this.slots) {
        const col = slot.id % 3;
        const row = Math.floor(slot.id / 3);
        const slotX = this.origin.x + col * (this.SLOT_SIZE + this.GRID_GAP); // Użyj this.origin
        const slotY = this.origin.y + row * (this.SLOT_SIZE + this.GRID_GAP);
        if (this.mousePos.x >= slotX && this.mousePos.x <= slotX + this.SLOT_SIZE &&
            this.mousePos.y >= slotY && this.mousePos.y <= slotY + this.SLOT_SIZE) {
            return slot;
        }
    }
    return null;
}


    update(deltaTime, inventoryOrigin) {
        if (!this.isOpen || !this.assetsLoaded) return;

        const hoveredSlot = this._getHoveredSlot(inventoryOrigin);
        
        this.slots.forEach(slot => {
            slot.rockingTimer += slot.rockingSpeed * deltaTime;
            const isHovered = hoveredSlot && hoveredSlot.id === slot.id;

            if (isHovered) {
                slot.targetScale = 1.15;
                slot.rotation = Math.sin(slot.rockingTimer * 2.5) * (6 * Math.PI / 180);
            } else {
                slot.targetScale = 1.0;
                slot.rotation = Math.sin(slot.rockingTimer) * slot.rockingAmplitude;
            }
            slot.scale = lerp(slot.scale, slot.targetScale, 0.2);
        });
    }

    draw(ctx, inventoryOrigin) {
    if (!this.isOpen || !this.assetsLoaded) {
        return;
    }

    const gridCols = 3;

    // --- RYSOWANIE SLOTÓW I PRZEDMIOTÓW W NICH ---
    this.slots.forEach((slot, index) => {
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        
        const centerX = inventoryOrigin.x + col * (this.SLOT_SIZE + this.GRID_GAP) + this.SLOT_SIZE / 2;
        const centerY = inventoryOrigin.y + row * (this.SLOT_SIZE + this.GRID_GAP) + this.SLOT_SIZE / 2;

        ctx.save();
        
        // Przesuń punkt odniesienia do środka slotu
        ctx.translate(centerX, centerY);
        
        // Zastosuj skalowanie i rotację dla całego slota
        ctx.scale(slot.scale, slot.scale);
        ctx.rotate(slot.rotation);
        
        // Narysuj ramkę slota, centrując ją
        ctx.drawImage(this.frameImage, -this.SLOT_SIZE / 2, -this.SLOT_SIZE / 2, this.SLOT_SIZE, this.SLOT_SIZE);
        
        // --- POPRAWKA ---
        // Rysuj przedmiot W TYM SAMYM MIEJSCU, przed ctx.restore()
        // Przekazujemy środek (0, 0), ponieważ jesteśmy już w przesuniętym kontekście.
        if (slot.item) {
            this._drawItem(ctx, slot.item, 0, 0); // Zmieniono centerX, centerY na 0, 0
        }
        
        ctx.restore();
    });

    // Rysowanie przedmiotu trzymanego przez myszkę pozostaje bez zmian
    if (this.heldItem) {
        // Ta funkcja jest wywoływana z globalnymi koordynatami myszy, więc działa poprawnie.
        this._drawItem(ctx, this.heldItem, this.mousePos.x, this.mousePos.y);
    }
}

    /**
     * NOWA FUNKCJA WEWNĘTRZNA: Rysuje pojedynczy przedmiot.
     * @private
     */
    _drawItem(ctx, item, x, y) {
        const ITEM_IMAGE_SIZE = this.SLOT_SIZE * 0.7; // Przedmiot jest mniejszy niż slot
        const STAR_SIZE = 24;
        
        // Rysowanie obrazka przedmiotu (ryby)
        if (item.image && item.image.complete) {
            ctx.drawImage(item.image, x - ITEM_IMAGE_SIZE / 2, y - ITEM_IMAGE_SIZE / 2, ITEM_IMAGE_SIZE, ITEM_IMAGE_SIZE);
        }

        // Rysowanie gwiazdki, jeśli przedmiot ją posiada
        if (item.tier && item.tier > 0) {
            const tierConfig = FISH_TIER_CONFIG[item.tier];
            if (tierConfig && tierConfig.imageKey) {
                const starImg = starImages[tierConfig.imageKey];
                if (starImg && starImg.complete) {
                    const starX = x + ITEM_IMAGE_SIZE / 2 - STAR_SIZE; // Prawy dolny róg
                    const starY = y + ITEM_IMAGE_SIZE / 2 - STAR_SIZE;
                    ctx.drawImage(starImg, starX, starY, STAR_SIZE, STAR_SIZE);
                }
            }
        }
    }
}