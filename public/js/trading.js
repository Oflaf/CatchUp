class TradingManager {
    constructor(inventoryManager, fishingManager) {
        this.inventoryManager = inventoryManager;
        this.fishingManager = fishingManager; // Przechowujemy referencję
        this.isTradeWindowOpen = false;
        this.activeNpc = null;
        this.slots = [];
        this.lastPlayerOffer = null; // Do śledzenia zmian w ofercie gracza

        // ======================= POCZĄTEK ZMIAN =======================
        
        // Tworzymy jedną, kompletną listę wszystkich ryb z obu biomów.
        const allTradableFish = [
            'roach', 'great roach', 'crucian', 'great crucian', 'carp', 'great carp',
            'catfish', 'great catfish', 'olympic catfish', 'perch', 'great perch',
            'longear sunfish', 'great longear sunfish', 'rudd', 'great rudd',
            'spined loach', 'european chub', 'great european chub', 'bream', 'great bream', 'tench',
            'great tench', 'common bleak', 'piranha', 'great piranha', 'peacock bass',
            'great peacock bass', 'redtail catfish', 'great redtail catfish', 'payara',
            'great payara', 'pacu', 'great pacu', 'silver dollar fish', 'green oscar', 'tiger oscar'
        ];
        
        // Definiujemy, czym można handlować w poszczególnych biomach.
        this.tradableItemsByBiome = {
            'grassland': {
                // NPC w Grassland akceptuje WSZYSTKIE ryby.
                playerCanOffer: allTradableFish,
                // W zamian oferuje przedmioty typowe dla tego biomu.
                npcWillGive: ['red chubby wobbler', 'green kavasaki wobbler', 'beaked', 'double', 'treble', 'walker', 'high contrast wobbler', 'spoon']
            },
            'jurassic': {
                // NPC w Jurassic również akceptuje WSZYSTKIE ryby.
                playerCanOffer: allTradableFish,
                // W zamian oferuje przedmioty typowe dla biomu jurajskiego.
                npcWillGive: ['wooden two-jointed wobbler', 'handmade jig', 'soft lure painted with oil', 'beaked', 'double', 'treble']
            }
            // Możesz dodać tutaj kolejne biomy w przyszłości
        };
        
        this.activeBiome = null; // Będzie przechowywać nazwę aktualnego biomu podczas handlu

        // ======================== KONIEC ZMIAN =========================

        this.SLOT_SIZE = inventoryManager.SLOT_SIZE;
        this.GRID_GAP = inventoryManager.GRID_GAP;
    }

    /**
     * Wewnętrzna funkcja do tworzenia obiektów slotów.
     */
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

    /**
     * Rozpoczyna sesję handlową z danym NPC.
     * @param {object} npc - Obiekt NPC, z którym rozpoczynamy handel.
     * @param {string} biomeName - Nazwa biomu, w którym znajduje się NPC.
     */
    startTrading(npc, biomeName) {
        if (!npc || !biomeName) return;
        this.isTradeWindowOpen = true;
        this.activeNpc = npc;
        this.activeBiome = biomeName; // Zapisujemy aktywny biom

        this.slots = [];
        this.slots.push(this._createSlot('player_offer', 'trade'));
        this.slots.push(this._createSlot('npc_offer', 'trade'));

        if (!this.inventoryManager.isOpen) {
            this.inventoryManager.isOpen = true;
        }
        if (isCustomizationMenuOpen) {
            isCustomizationMenuOpen = false;
        }
        console.log(`Rozpoczęto handel z NPC: ${npc.id} w biomie: ${biomeName}`);
    }

    /**
     * Kończy sesję handlową.
     */
    stopTrading() {
        if (!this.isTradeWindowOpen) return;

        const playerOfferSlot = this.slots.find(s => s.id === 'player_offer');
        if (playerOfferSlot && playerOfferSlot.item) {
            if (!this.inventoryManager.addItem(playerOfferSlot.item)) {
                console.warn("Nie można było zwrócić przedmiotu - ekwipunek pełny!");
            }
            playerOfferSlot.item = null;
        }

        this.isTradeWindowOpen = false;
        this.activeNpc = null;
        this.activeBiome = null; // Resetujemy aktywny biom
        this.slots = [];
        
        if (this.inventoryManager.isOpen) {
            this.inventoryManager.isOpen = false;
        }
        console.log("Zakończono handel.");
    }

    /**
     * Przełącza stan okna handlu.
     * @param {object} npc - Obiekt NPC.
     * @param {string} biomeName - Nazwa biomu.
     */
    toggleTrading(npc, biomeName) {
        if (this.isTradeWindowOpen) {
            this.stopTrading();
        } else {
            soundManager.play('inventory'); // <-- DODANA LINIA
            this.startTrading(npc, biomeName);
        }
    }

    /**
     * Oblicza pozycję slotów handlu na ekranie.
     */
    _getSlotPosition(slot) {
        const inventoryWidth = 4 * this.SLOT_SIZE + 3 * this.GRID_GAP;
        const startX = invX + inventoryWidth + this.SLOT_SIZE * 3.2;
        const startY = invY + (this.SLOT_SIZE + this.GRID_GAP);
        
        if (slot.id === 'player_offer') {
            return { x: startX, y: startY };
        } else if (slot.id === 'npc_offer') {
            return { x: startX + this.SLOT_SIZE + this.GRID_GAP, y: startY };
        }
        return { x: -1000, y: -1000 };
    }
    
    /**
     * Sprawdza, czy kursor myszy znajduje się nad którymś ze slotów handlu.
     */
    _getHoveredSlot() {
        if (!this.isTradeWindowOpen) return null;
        for (const slot of this.slots) {
            const { x, y } = this._getSlotPosition(slot);
            const mouse = this.inventoryManager.mousePos;
            if (mouse.x >= x && mouse.x <= x + this.SLOT_SIZE &&
                mouse.y >= y && mouse.y <= y + this.SLOT_SIZE) {
                return slot;
            }
        }
        return null;
    }

    /**
     * Generuje ofertę NPC na podstawie oferty gracza i aktualnego biomu.
     */
    _generateNpcOffer(offeredItem) {
        const npcOfferSlot = this.slots.find(s => s.id === 'npc_offer');
        if (!npcOfferSlot) return;

        // Krok 1: Wyczyść ofertę NPC na starcie
        npcOfferSlot.item = null;

        // Krok 2: Sprawdź, czy gracz cokolwiek oferuje i czy mamy aktywny biom
        if (!offeredItem || !this.activeBiome) {
            return;
        }

        // Krok 3: Pobierz zasady handlu dla bieżącego biomu
        const tradeRules = this.tradableItemsByBiome[this.activeBiome];
        if (!tradeRules) {
            console.warn(`Brak zdefiniowanych zasad handlu dla biomu: ${this.activeBiome}`);
            return;
        }

        // Krok 4: Sprawdź, czy oferowany przedmiot jest na liście akceptowalnych
        const isItemTradable = tradeRules.playerCanOffer.includes(offeredItem.name);

        if (isItemTradable) {
            // Krok 5: Jeśli przedmiot jest akceptowalny, wylosuj nagrodę z puli dla tego biomu
            const potentialRewards = tradeRules.npcWillGive;
            if (potentialRewards.length > 0) {
                const chosenRewardName = potentialRewards[Math.floor(Math.random() * potentialRewards.length)];
                
                // Użyj istniejącej globalnej funkcji do stworzenia pełnego obiektu przedmiotu
                npcOfferSlot.item = createFullItemObject(chosenRewardName);
            }
        }
        // Jeśli przedmiot nie jest akceptowalny (isItemTradable === false), oferta NPC pozostaje pusta (null)
    }


    /**
     * Finalizuje wymianę: czyści slot gracza i resetuje stan.
     * Wywoływane z InventoryManager, gdy gracz podnosi przedmiot z oferty NPC.
     */
    finalizeTrade() {
        const playerSlot = this.slots.find(s => s.id === 'player_offer');
        const npcSlot = this.slots.find(s => s.id === 'npc_offer');

        if (playerSlot) playerSlot.item = null;
        if (npcSlot) npcSlot.item = null;
        
        this.lastPlayerOffer = null; // Zresetuj stan, aby umożliwić nową ofertę
    }

    /**
     * Aktualizuje animacje i logikę handlu.
     */
    update(deltaTime) {
        if (!this.isTradeWindowOpen) return;
        
        // === Logika generowania oferty ===
        const playerOfferSlot = this.slots.find(s => s.id === 'player_offer');
        if (playerOfferSlot) {
            // Sprawdź, czy przedmiot w slocie się zmienił od ostatniej klatki
            if (playerOfferSlot.item !== this.lastPlayerOffer) {
                this._generateNpcOffer(playerOfferSlot.item);
                this.lastPlayerOffer = playerOfferSlot.item; // Zaktualizuj stan
            }
        }
        
        // === Logika animacji ===
        this.slots.forEach(slot => {
            slot.rockingTimer += slot.rockingSpeed * deltaTime;
            const hoveredSlot = this.inventoryManager._getHoveredSlot();
            const isHovered = hoveredSlot && hoveredSlot.id === slot.id && hoveredSlot.type === 'trade';

            slot.targetScale = isHovered ? 1.15 : 1.0;
            slot.rotation = isHovered 
                ? Math.sin(slot.rockingTimer * 2.5) * (6 * Math.PI / 180) 
                : Math.sin(slot.rockingTimer) * slot.rockingAmplitude;

            slot.scale = lerp(slot.scale, slot.targetScale, 0.2);
        });
    }

    /**
     * Rysuje okno handlu.
     */
    draw(ctx, pixelFont) {
        if (!this.isTradeWindowOpen || !this.inventoryManager.assetsLoaded) return;

        this.slots.forEach(slot => {
            const pos = this._getSlotPosition(slot);
            const centerX = pos.x + this.SLOT_SIZE / 2;
            const centerY = pos.y + this.SLOT_SIZE / 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(slot.scale, slot.scale);
            ctx.rotate(slot.rotation);
            ctx.drawImage(this.inventoryManager.frameImage, -this.SLOT_SIZE / 2, -this.SLOT_SIZE / 2, this.SLOT_SIZE, this.SLOT_SIZE);
            if (slot.item) {
                this.inventoryManager._drawItem(ctx, slot.item, 0, 0);
            }
            ctx.restore();
            
            const labelText = slot.id === 'player_offer' ? 'Your Item' : 'You Receive';
            const textX = pos.x + this.SLOT_SIZE / 2;
            const textY = pos.y - 8;
            
            ctx.font = `18px ${pixelFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            this.inventoryManager._drawTextWithOutline(ctx, labelText, textX, textY, 'white', 3);
        });
    }
}