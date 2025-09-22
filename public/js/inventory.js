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
        this.origin = { x: 0, y: 0 }; 

        this.SLOT_SIZE = 92;
        this.GRID_GAP = 12;
        
        this.heldItem = null;
        this.heldItemOriginalSlot = null;

        this._initSlots();
        this.loadAssets();
    }

    _initSlots() {
        this.slots = []; 
        
        this.slots.push(this._createSlot('hook', 'hook'));
        this.slots.push(this._createSlot('bait', 'bait'));
        
        for (let i = 0; i < 9; i++) {
            this.slots.push(this._createSlot(i, 'main'));
        }
    }

    _createSlot(id, type) {
        return {
            id: id,
            type: type,
            item: null,
            scale: 1.0,
            targetScale: 1.0,
            rotation: 0,
            rockingTimer: Math.random() * Math.PI * 2,
            rockingSpeed: 1.8 + Math.random() * 0.5,
            rockingAmplitude: (1.5 + Math.random()) * (Math.PI / 180)
        };
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
        if (!this.isOpen && this.heldItem) {
            const originalSlot = this._getSlotById(this.heldItemOriginalSlot);
            this._dropItem(originalSlot); 
        }
    }

    updateMousePosition(x, y) {
        this.mousePos = { x, y };
    }

    addItem(itemData) {
        const freeSlot = this.slots.find(slot => slot.type === 'main' && slot.item === null);
        if (freeSlot) {
            freeSlot.item = itemData;
            console.log(`Dodano ${itemData.name} do slotu ${freeSlot.id}`);
            return true;
        }
        console.warn("Główny ekwipunek jest pełny!");
        return false;
    }
    
    // ======================= POCZĄTEK ZMIAN =======================
    /**
     * Umieszcza przedmiot w określonym slocie specjalnym (np. 'hook' lub 'bait').
     * Jeśli slot jest zajęty, próbuje dodać przedmiot do głównego ekwipunku.
     * @param {object} itemData - Pełny obiekt przedmiotu do dodania.
     * @param {string} slotType - Typ slotu docelowego ('hook' lub 'bait').
     * @returns {boolean} True, jeśli przedmiot został pomyślnie dodany.
     */
    placeItemInSlot(itemData, slotType) {
        const targetSlot = this.slots.find(slot => slot.type === slotType);
        
        if (targetSlot) {
            // Umieść przedmiot tylko wtedy, gdy slot jest pusty
            if (targetSlot.item === null) {
                targetSlot.item = itemData;
                console.log(`Umieszczono ${itemData.name} w slocie ${slotType}.`);
                return true;
            }
        }
        
        // Jeśli slot docelowy był zajęty lub nie znaleziono go, spróbuj dodać do ekwipunku
        console.warn(`Slot ${slotType} jest zajęty. Próba dodania do głównego ekwipunku.`);
        return this.addItem(itemData);
    }
    // ======================== KONIEC ZMIAN =========================

    handleMouseDown() {
        if (!this.isOpen) return false;

        const hoveredSlot = this._getHoveredSlot();

        if (this.heldItem) {
            if (hoveredSlot) {
                this._dropItem(hoveredSlot);
            } else {
                const itemToDrop = this.heldItem;
                this.heldItem = null;
                this.heldItemOriginalSlot = null;
                return itemToDrop; 
            }
            return true;
        } else if (hoveredSlot && hoveredSlot.item) {
            this._pickupItem(hoveredSlot);
            return true;
        }

        return false;
    }
    
    getBaitItem() {
        const baitSlot = this.slots.find(slot => slot.type === 'bait');
        return baitSlot ? baitSlot.item : null;
    }
    
    consumeBait() {
        const baitSlot = this.slots.find(slot => slot.type === 'bait');
        if (baitSlot && baitSlot.item) {
            baitSlot.item = null;
        }
    }
    
    getHookItem() {
        const hookSlot = this.slots.find(slot => slot.type === 'hook');
        return hookSlot ? hookSlot.item : null;
    }

    _getSlotById(id) {
        return this.slots.find(slot => slot.id === id);
    }

    _pickupItem(slot) {
        this.heldItem = slot.item;
        slot.item = null;
        this.heldItemOriginalSlot = slot.id;
    }

    _dropItem(targetSlot) {
        if (!targetSlot) {
            const originalSlot = this._getSlotById(this.heldItemOriginalSlot);
            if(originalSlot) originalSlot.item = this.heldItem;
        } else {
            const originalSlot = this._getSlotById(this.heldItemOriginalSlot);
            if (targetSlot.item) {
                if(originalSlot) originalSlot.item = targetSlot.item;
            } else { 
                 if(originalSlot) originalSlot.item = null;
            }
            targetSlot.item = this.heldItem;
        }
        this.heldItem = null;
        this.heldItemOriginalSlot = null;
    }

    _getHoveredSlot() {
        for (const slot of this.slots) {
            const { x, y } = this._getSlotPosition(slot); 
            if (this.mousePos.x >= x && this.mousePos.x <= x + this.SLOT_SIZE &&
                this.mousePos.y >= y && this.mousePos.y <= y + this.SLOT_SIZE) {
                return slot;
            }
        }
        return null;
    }
    
    _getSlotPosition(slot) {
        if (!this.origin) return { x: -1000, y: -1000 };

        const gridCols = 3;
        const gridWidth = gridCols * this.SLOT_SIZE + (gridCols - 1) * this.GRID_GAP;
        
        if (slot.type === 'hook' || slot.type === 'bait') {
            const totalSpecialWidth = 2 * this.SLOT_SIZE + this.GRID_GAP;
            const startX = this.origin.x + (gridWidth - totalSpecialWidth) / 2;
            const y = this.origin.y - this.SLOT_SIZE - this.GRID_GAP * 2;
            
            if (slot.type === 'hook') {
                return { x: startX, y: y };
            } else { // bait
                return { x: startX + this.SLOT_SIZE + this.GRID_GAP, y: y };
            }
        } else { // main
            const col = slot.id % gridCols;
            const row = Math.floor(slot.id / gridCols);
            const x = this.origin.x + col * (this.SLOT_SIZE + this.GRID_GAP);
            const y = this.origin.y + row * (this.SLOT_SIZE + this.GRID_GAP);
            return { x, y };
        }
    }


    update(deltaTime) {
        if (!this.isOpen || !this.assetsLoaded) return;

        const hoveredSlot = this._getHoveredSlot();
        
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

    draw(ctx) {
        if (!this.isOpen || !this.assetsLoaded) {
            return;
        }

        this.slots.forEach(slot => {
            const pos = this._getSlotPosition(slot);
            
            const centerX = pos.x + this.SLOT_SIZE / 2;
            const centerY = pos.y + this.SLOT_SIZE / 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(slot.scale, slot.scale);
            ctx.rotate(slot.rotation);
            ctx.drawImage(this.frameImage, -this.SLOT_SIZE / 2, -this.SLOT_SIZE / 2, this.SLOT_SIZE, this.SLOT_SIZE);
            if (slot.item) {
                this._drawItem(ctx, slot.item, 0, 0);
            }
            ctx.restore();

            if (slot.type === 'hook' || slot.type === 'bait') {
                const labelText = slot.type === 'hook' ? 'Hook' : 'Bait';
                const textX = pos.x + this.SLOT_SIZE / 2;
                const textY = pos.y - 8;

                ctx.font = `16px ${PIXEL_FONT}`
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillText(labelText, textX + 1, textY + 1);

                ctx.fillStyle = 'white';
                ctx.fillText(labelText, textX, textY);
            }
        });

        if (this.heldItem) {
            this._drawItem(ctx, this.heldItem, this.mousePos.x, this.mousePos.y);
        }
    }

    _drawItem(ctx, item, x, y) {
        const ITEM_IMAGE_SIZE = this.SLOT_SIZE * 0.7;
        const STAR_SIZE = 24;
        
        if (item.image && item.image.complete) {
            ctx.drawImage(item.image, x - ITEM_IMAGE_SIZE / 2, y - ITEM_IMAGE_SIZE / 2, ITEM_IMAGE_SIZE, ITEM_IMAGE_SIZE);
        }

        if (item.tier && item.tier > 0) {
            const tierConfig = FISH_TIER_CONFIG[item.tier];
            if (tierConfig && tierConfig.imageKey) {
                const starImg = starImages[tierConfig.imageKey];
                if (starImg && starImg.complete) {
                    const starX = x + ITEM_IMAGE_SIZE / 2 - STAR_SIZE;
                    const starY = y + ITEM_IMAGE_SIZE / 2 - STAR_SIZE;
                    ctx.drawImage(starImg, starX, starY, STAR_SIZE, STAR_SIZE);
                }
            }
        }
    }
}