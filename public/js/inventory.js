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
        
        // ======================= POCZĄTEK ZMIAN =======================
        this.tradingManager = null; // Miejsce na referencję do TradingManagera
        // ======================== KONIEC ZMIAN =========================

        this._initSlots();
        this.loadAssets();
    }
    
    // ======================= POCZĄTEK ZMIAN =======================
    /**
     * Łączy ten manager z managerem handlu.
     * @param {TradingManager} manager - Instancja TradingManagera.
     */
    linkTradingManager(manager) {
        this.tradingManager = manager;
    }
    // ======================== KONIEC ZMIAN =========================

    _initSlots() {
        this.slots = []; 
        
        this.slots.push(this._createSlot('hook', 'hook'));
        this.slots.push(this._createSlot('bait', 'bait'));
        
        for (let i = 0; i < 16; i++) {
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
        if (this.tradingManager && this.tradingManager.isTradeWindowOpen) return;

        this.isOpen = !this.isOpen;
        if (!this.isOpen && this.heldItem) {
            this._returnHeldItem(); 
        }
    }

    updateMousePosition(x, y) {
        this.mousePos = { x, y };
    }

    addItem(itemData) {
        const freeSlot = this.slots.find(slot => slot.type === 'main' && slot.item === null);
        if (freeSlot) {
            freeSlot.item = itemData;
            return true;
        }
        console.warn("Główny ekwipunek jest pełny!");
        return false;
    }
    
    placeItemInSlot(itemData, slotType) {
        const targetSlot = this.slots.find(slot => slot.type === slotType);
        if (targetSlot && targetSlot.item === null) {
            targetSlot.item = itemData;
            return true;
        }
        return this.addItem(itemData);
    }

   handleMouseDown() {
        if (!this.isOpen) return null; // Zwracamy null zamiast false dla spójności

        const hoveredSlot = this._getHoveredSlot();

        // Scenariusz 1: Gracz trzyma przedmiot i klika
        if (this.heldItem) {
            const itemBeingPlaced = this.heldItem; // Zapisujemy, jaki przedmiot jest odkładany

            if (hoveredSlot) {
                // Kliknięto na slot -> odłóż lub zamień
                this._dropItem(hoveredSlot);
                return itemBeingPlaced; // Zwróć przedmiot, który został właśnie odłożony
            } else {
                // Kliknięto poza slotami -> wyrzuć przedmiot
                const itemToDrop = this.heldItem;
                this.heldItem = null;
                this.heldItemOriginalSlot = null;
                return itemToDrop; // Zwróć przedmiot, który ma być wyrzucony
            }
        } 
        // Scenariusz 2: Gracz nie trzyma przedmiotu i klika na slot z przedmiotem
        else if (hoveredSlot && hoveredSlot.item) {
            const itemBeingPickedUp = hoveredSlot.item; // Zapisujemy, jaki przedmiot jest podnoszony
            this._pickupItem(hoveredSlot);
            return itemBeingPickedUp; // Zwróć przedmiot, który został właśnie podniesiony
        }

        return null; // Nie wykonano żadnej akcji
    }
    
    getBaitItem() {
        return this.slots.find(slot => slot.type === 'bait')?.item || null;
    }
    
    consumeBait() {
        const baitSlot = this.slots.find(slot => slot.type === 'bait');
        if (baitSlot) baitSlot.item = null;
    }
    
    getHookItem() {
        return this.slots.find(slot => slot.type === 'hook')?.item || null;
    }

    _getSlotById(id) {
        return this.slots.find(slot => slot.id === id);
    }
    
    _returnHeldItem() {
        if (!this.heldItem || this.heldItemOriginalSlot === null) return;
        let originalSlot = this._getSlotById(this.heldItemOriginalSlot) || this.tradingManager?.slots.find(s => s.id === this.heldItemOriginalSlot);
        if (originalSlot) originalSlot.item = this.heldItem;
        this.heldItem = null;
        this.heldItemOriginalSlot = null;
    }

     _pickupItem(slot) {
        // ======================= POCZĄTEK ZMIANY =======================
        // Przechwyć próbę podniesienia przedmiotu z oferty NPC
        if (slot.type === 'trade' && slot.id === 'npc_offer') {
            if (slot.item) {
                // Przedmiot jest w ofercie, więc finalizujemy wymianę
                const receivedItem = slot.item;
                
                // Powiedz TradingManagerowi, żeby wyczyścił sloty
                this.tradingManager.finalizeTrade();
                
                // Umieść otrzymany przedmiot w ręce gracza
                this.heldItem = receivedItem;
                this.heldItemOriginalSlot = null; // Ten przedmiot nie ma "domu", bo jest nowy
            }
            return; // Zakończ funkcję, aby nie wykonać domyślnej logiki podnoszenia
        }
        // ======================== KONIEC ZMIANY =========================

        // Domyślna logika podnoszenia dla wszystkich innych slotów
        this.heldItem = slot.item;
        slot.item = null;
        this.heldItemOriginalSlot = slot.id;
    }

    _dropItem(targetSlot) {
        if (targetSlot.type === 'trade' && targetSlot.id === 'npc_offer') {
            this._returnHeldItem();
            return;
        }

        // ======================= POCZĄTEK ZMIANY =======================
        // Dodatkowa walidacja: nie można upuścić przedmiotu na ofertę gracza,
        // jeśli już coś tam jest (zamiana nie ma sensu w tym slocie).
        if (targetSlot.type === 'trade' && targetSlot.id === 'player_offer' && targetSlot.item) {
            this._returnHeldItem();
            return;
        }
        // ======================== KONIEC ZMIANY =========================

        if (!targetSlot) {
            this._returnHeldItem();
            return;
        }
        
        const originalSlot = this._getSlotById(this.heldItemOriginalSlot) || this.tradingManager?.slots.find(s => s.id === this.heldItemOriginalSlot);
        if (targetSlot.item) {
            if(originalSlot) originalSlot.item = targetSlot.item;
        } else {
            if(originalSlot) originalSlot.item = null;
        }
        targetSlot.item = this.heldItem;
        
        this.heldItem = null;
        this.heldItemOriginalSlot = null;
    }

    _dropItem(targetSlot) {
        if (targetSlot.type === 'trade' && targetSlot.id === 'npc_offer') {
            this._returnHeldItem();
            return;
        }
        if (!targetSlot) {
            this._returnHeldItem();
            return;
        }
        
        const originalSlot = this._getSlotById(this.heldItemOriginalSlot) || this.tradingManager?.slots.find(s => s.id === this.heldItemOriginalSlot);
        if (targetSlot.item) {
            if(originalSlot) originalSlot.item = targetSlot.item;
        } else {
            if(originalSlot) originalSlot.item = null;
        }
        targetSlot.item = this.heldItem;
        
        this.heldItem = null;
        this.heldItemOriginalSlot = null;
    }
    
    // ======================= POCZĄTEK ZMIAN =======================
    _getHoveredSlot() {
        for (const slot of this.slots) {
            const { x, y } = this._getSlotPosition(slot); 
            if (this.mousePos.x >= x && this.mousePos.x <= x + this.SLOT_SIZE &&
                this.mousePos.y >= y && this.mousePos.y <= y + this.SLOT_SIZE) {
                return slot;
            }
        }
        
        if (this.tradingManager && this.tradingManager.isTradeWindowOpen) {
            const hoveredTradeSlot = this.tradingManager._getHoveredSlot();
            if (hoveredTradeSlot) return hoveredTradeSlot;
        }
        
        return null;
    }
    // ======================== KONIEC ZMIAN =========================
    
    _getSlotPosition(slot) {
        if (!this.origin) return { x: -1000, y: -1000 };
        const gridCols = 4;
        const gridWidth = gridCols * this.SLOT_SIZE + (gridCols - 1) * this.GRID_GAP;
        
        if (slot.type === 'hook' || slot.type === 'bait') {
            const totalSpecialWidth = 2 * this.SLOT_SIZE + this.GRID_GAP;
            const startX = this.origin.x + (gridWidth - totalSpecialWidth) / 2;
            const y = this.origin.y - this.SLOT_SIZE - this.GRID_GAP * 2;
            return { x: startX + (slot.type === 'bait' ? this.SLOT_SIZE + this.GRID_GAP : 0), y: y };
        } else {
            const col = slot.id % gridCols;
            const row = Math.floor(slot.id / gridCols);
            return { x: this.origin.x + col * (this.SLOT_SIZE + this.GRID_GAP), y: this.origin.y + row * (this.SLOT_SIZE + this.GRID_GAP) };
        }
    }

    _drawTextWithOutline(ctx, text, x, y, fillStyle, outlineWidth = 2) {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = outlineWidth;
        ctx.lineJoin = 'round'; 
        ctx.miterLimit = 2;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = fillStyle;
        ctx.fillText(text, x, y);
    }
    
    _drawTooltip(ctx, slot, pixelFont) {
        if (!slot.item || !this.tierConfig || !this.tierNames) return;

        ctx.save();

        const item = slot.item;
        const tierConfig = this.tierConfig[item.tier] || this.tierConfig[0];
        
        const PADDING = 32;
        const NAME_FONT = `bold 17px ${pixelFont}`;
        const DESC_FONT = `16px ${pixelFont}`;
        const TIER_FONT = `14px ${pixelFont}`;
        const TIER_ALPHA = 0.8;
        const LINE_HEIGHT = 20;
        const MARGIN_ABOVE_SLOT = 16;
        const GAP_BETWEEN_LINES = 6;
        
        const ROCKING_SPEED = 2.5;
        const ROCKING_AMPLITUDE_DEGREES = 2.3;

        // --- Obliczanie szerokości (potrzebne do centrowania) ---
        const tierName = this.tierNames[item.tier];
        const tierText = tierName ? ` (${tierName})` : '';

        ctx.font = NAME_FONT;
        const itemNameWidth = ctx.measureText(item.name).width;
        ctx.font = TIER_FONT;
        const tierTextWidth = ctx.measureText(tierText).width;
        
        const titleLineWidth = itemNameWidth + tierTextWidth;

        ctx.font = DESC_FONT;
        const descText = item.description || "";
        const descWidth = ctx.measureText(descText).width;
        
        let sizeText = null;
        if (item.size) sizeText = `Size: ${item.size}cm`;
        const sizeWidth = sizeText ? ctx.measureText(sizeText).width : 0;
        
        const tooltipWidth = Math.max(titleLineWidth, descWidth, sizeWidth);
        
        let tooltipHeight = LINE_HEIGHT * 2 + GAP_BETWEEN_LINES;
        if (sizeText) tooltipHeight += LINE_HEIGHT + GAP_BETWEEN_LINES;
        
        // --- Pozycja i rotacja ---
        const slotPos = this._getSlotPosition(slot);
        const x = slotPos.x + (this.SLOT_SIZE / 2) - (tooltipWidth / 2);
        let y = slotPos.y - tooltipHeight - MARGIN_ABOVE_SLOT;
        
        // --- Korekta pozycji Y, aby tekst był poprawnie umiejscowiony ---
        y += PADDING / 2;
        
        const rotationAngle = Math.sin(Date.now() / 1000 * ROCKING_SPEED) * (ROCKING_AMPLITUDE_DEGREES * Math.PI / 180);
        const centerX = x + tooltipWidth / 2;
        const centerY = y + tooltipHeight / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle);
        ctx.translate(-centerX, -centerY);

        // --- Rysowanie tła (USUNIĘTE) ---
        // ctx.fillStyle = 'rgba(0, 0, 0, 0.29)';
        // ctx.fillRect(...);
        // ctx.strokeStyle = tierConfig.color;
        // ctx.strokeRect(...);

        // --- Rysowanie tekstów z obramówką ---
        const textStartX = x;
        const textStartY = y;
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // 1. Rysuj nazwę przedmiotu
        ctx.font = NAME_FONT;
        this._drawTextWithOutline(ctx, item.name, textStartX, textStartY, tierConfig.color, 3);

        // 2. Rysuj nazwę tieru
        if (tierText) {
            ctx.font = TIER_FONT;
            const tierColorWithAlpha = tierConfig.color.replace(', 1)', `, ${TIER_ALPHA})`);
            this._drawTextWithOutline(ctx, tierText, textStartX + itemNameWidth, textStartY, tierColorWithAlpha, 3);
        }

        // 3. Rysuj opis
        ctx.font = DESC_FONT;
        this._drawTextWithOutline(ctx, descText, textStartX, textStartY + LINE_HEIGHT + GAP_BETWEEN_LINES, '#FFFFFF', 2);

        // 4. Rysuj rozmiar (jeśli istnieje)
        if (sizeText) {
            const sizeY = textStartY + (LINE_HEIGHT + GAP_BETWEEN_LINES) * 2;
            this._drawTextWithOutline(ctx, sizeText, textStartX, sizeY, '#b3b3b3ff', 2);
        }

        ctx.restore();
    }
    // ======================== KONIEC ZMIAN =========================


    update(deltaTime) {
        if (!this.isOpen || !this.assetsLoaded) return;
        this.slots.forEach(slot => {
            slot.rockingTimer += slot.rockingSpeed * deltaTime;
            const hoveredSlot = this._getHoveredSlot();
            const isHovered = hoveredSlot && hoveredSlot.id === slot.id && hoveredSlot.type !== 'trade';
            slot.targetScale = isHovered ? 1.15 : 1.0;
            slot.rotation = isHovered 
                ? Math.sin(slot.rockingTimer * 2.5) * (6 * Math.PI / 180) 
                : Math.sin(slot.rockingTimer) * slot.rockingAmplitude;
            slot.scale = lerp(slot.scale, slot.targetScale, 0.2);
        });
    }

    draw(ctx, pixelFont) {
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
                
                ctx.font = `18px ${pixelFont}`
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillText(labelText, textX + 1, textY + 1);

                ctx.fillStyle = 'white';
                ctx.fillText(labelText, textX, textY);
            }
        });

        const hoveredSlot = this._getHoveredSlot();
        if (hoveredSlot && hoveredSlot.item) {
            this._drawTooltip(ctx, hoveredSlot, pixelFont);
        }

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

        if (this.tierConfig && this.starImages && item.tier && item.tier > 0) {
            const tierConfig = this.tierConfig[item.tier];
            if (tierConfig && tierConfig.imageKey) {
                const starImg = this.starImages[tierConfig.imageKey];
                
                if (starImg && starImg.complete) {
                    const starX = x + ITEM_IMAGE_SIZE / 2 - STAR_SIZE;
                    const starY = y + ITEM_IMAGE_SIZE / 2 - STAR_SIZE;
                    ctx.drawImage(starImg, starX, starY, STAR_SIZE, STAR_SIZE);
                }
            }
        }
    }
}