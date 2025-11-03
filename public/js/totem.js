// totem.js

'use strict';

const TOTEM_BASE_WIDTH = 24;
const TOTEM_BASE_HEIGHT = 60;
const TOTEM_SCALE = 3.8;

class Totem {
    constructor(x, y, image, biomeName) {
        this.x = x;
        this.y = y;
        this.image = image;
        this.biomeName = biomeName;

        this.width = TOTEM_BASE_WIDTH * TOTEM_SCALE;
        this.height = TOTEM_BASE_HEIGHT * TOTEM_SCALE;
        this.isHighlighted = false;

        // --- ZMIANA: Nowe, bardziej opisowe stany ---
        this.states = {
            IDLE: 'IDLE',
            // Faza 1: Narastające trzęsienie totemu
            TOTEM_SHAKE_INCREASING: 'TOTEM_SHAKE_INCREASING',
            // Faza 2: Narastające trzęsienie świata (totem wciąż się trzęsie)
            SCREEN_SHAKE_INCREASING: 'SCREEN_SHAKE_INCREASING',
            // Faza 3: Zmniejszające się trzęsienie totemu (świat wciąż się trzęsie)
            TOTEM_SHAKE_DECREASING: 'TOTEM_SHAKE_DECREASING',
            // Faza 4: Zmniejszające się trzęsienie świata
            SCREEN_SHAKE_DECREASING: 'SCREEN_SHAKE_DECREASING',
            TRANSITIONING: 'TRANSITIONING',
            ACTIVE: 'ACTIVE'
        };
        this.state = this.states.IDLE;
        this.stateTimer = 0;
        this.transitionAlpha = 0;

        // --- ZMIANA: Definicja czasów trwania dla każdej fazy ---
        this.PHASE1_DURATION = 1.5; // Czas narastania wstrząsów totemu
        this.PHASE2_DURATION = 2.0; // Czas narastania wstrząsów ekranu
        this.PHASE3_DURATION = 1.5; // Czas opadania wstrząsów totemu
        this.PHASE4_DURATION = 2.5; // Czas opadania wstrząsów ekranu
        this.TRANSITION_DURATION = 1.5;

        this.MAX_SHAKE_INTENSITY = 8; // Maksymalna siła wstrząsów totemu
        this.MAX_SCREEN_SHAKE_INTENSITY = 5; // Maksymalna siła wstrząsów ekranu (możesz dostosować)

        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        // UWAGA: Trzęsienie ekranu będzie obsługiwane globalnie, np. przez modyfikację kamery
        // Tutaj klasa Totem będzie jedynie informować o potrzebie wstrząsu.
        // Jeśli nie masz globalnego obiektu kamery, dodaj go lub zmodyfikuj poniższy kod.
        this.screenShakeX = 0;
        this.screenShakeY = 0;

        this.particles = [];
        this.particleSpawnTimer = 0;
        this.PARTICLE_SPAWN_RATE = 0.02;
    }

    startAwakening() {
        if (this.state === this.states.IDLE) {
            console.log("Totem awakening sequence started!");
            // --- ZMIANA: Rozpoczęcie od Fazy 1 ---
            this.state = this.states.TOTEM_SHAKE_INCREASING;
            this.stateTimer = this.PHASE1_DURATION;
        }
    }
    
    // Metody cząsteczek (spawnParticle, spawnParticleBurst) pozostają bez zmian...
    spawnParticle() {
        if (!window.particleCharImage || !window.particleCharImage.complete) {
            return;
        }
        const size = Math.random() < 0.5 ? 5 : 6;
        const charImageWidth = 6;
        const charImageHeight = 24;
        this.particles.push({
            startX: this.x + (Math.random() * this.width * 1.2 - this.width * 0.1),
            startY: this.y + this.height * 0.9,
            x: 0, y: 0,
            sourceX: Math.floor(Math.random() * (charImageWidth - size + 1)),
            sourceY: Math.floor(Math.random() * (charImageHeight - size + 1)),
            size: size,
            life: 0,
            maxLife: 5.5 + Math.random() * 3.5,
            scale: 1,
            verticalFactor: 80 + Math.random() * 50,
            rockingSpeed: 2 + Math.random() * 2,
            rockingAmplitude: 10 + Math.random() * 25,
            rockingOffset: Math.random() * Math.PI * 2,
            drawBehind: Math.random() < 0.5
        });
    }

    spawnParticleBurst(count) {
        for (let i = 0; i < count; i++) {
            this.spawnParticle();
        }
    }


    update(deltaTime) {
        // Logika cząsteczek pozostaje bez zmian...
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += deltaTime;
            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                continue;
            }
            const progress = p.life / p.maxLife;
            p.y = p.startY - Math.sin(progress * Math.PI) * p.verticalFactor;
            p.x = p.startX + Math.sin(p.life * p.rockingSpeed + p.rockingOffset) * p.rockingAmplitude;
            p.scale = 1 - progress;
        }

        if (this.state === this.states.ACTIVE) {
            this.particleSpawnTimer -= deltaTime;
            if (this.particleSpawnTimer <= 0) {
                this.spawnParticle();
                this.particleSpawnTimer = this.PARTICLE_SPAWN_RATE;
            }
        }
        
        // Reset wstrząsów, jeśli totem jest bezczynny
        if (this.state === this.states.IDLE) {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
            this.screenShakeX = 0;
            this.screenShakeY = 0;
            // W stanie ACTIVE już nie resetujemy, bo wstrząsy same wygasną
        }


        if (this.state === this.states.IDLE || this.state === this.states.ACTIVE) {
            // Nie aktualizuj timera w tych stanach
        } else {
             this.stateTimer -= deltaTime;
        }

        // --- ZMIANA: Całkowicie nowa logika `switch` oparta na fazach ---
        let progress = 0;
        let currentIntensity = 0;

        switch (this.state) {
            // Faza 1: Trzęsienie totemu narasta liniowo od 0 do MAX
            case this.states.TOTEM_SHAKE_INCREASING:
                progress = 1 - (this.stateTimer / this.PHASE1_DURATION);
                currentIntensity = this.MAX_SHAKE_INTENSITY * progress;

                this.shakeOffsetX = (Math.random() - 0.5) * currentIntensity;
                this.shakeOffsetY = (Math.random() - 0.5) * currentIntensity;

                if (this.stateTimer <= 0) {
                    this.state = this.states.SCREEN_SHAKE_INCREASING;
                    this.stateTimer = this.PHASE2_DURATION;
                }
                break;

            // Faza 2: Trzęsienie świata narasta liniowo od 0 do MAX, totem trzęsie się z pełną mocą
            case this.states.SCREEN_SHAKE_INCREASING:
                // Totem trzęsie się z pełną mocą
                this.shakeOffsetX = (Math.random() - 0.5) * this.MAX_SHAKE_INTENSITY;
                this.shakeOffsetY = (Math.random() - 0.5) * this.MAX_SHAKE_INTENSITY;

                // Świat narasta
                progress = 1 - (this.stateTimer / this.PHASE2_DURATION);
                currentIntensity = this.MAX_SCREEN_SHAKE_INTENSITY * progress;
                // WAŻNE: Te wartości powinny być używane do przesunięcia kamery w głównym pliku gry
                this.screenShakeX = (Math.random() - 0.5) * currentIntensity;
                this.screenShakeY = (Math.random() - 0.5) * currentIntensity;

                if (this.stateTimer <= 0) {
                    this.state = this.states.TOTEM_SHAKE_DECREASING;
                    this.stateTimer = this.PHASE3_DURATION;
                }
                break;

            // Faza 3: Trzęsienie totemu opada liniowo do 0, świat trzęsie się z pełną mocą
            case this.states.TOTEM_SHAKE_DECREASING:
                progress = Math.max(0, this.stateTimer / this.PHASE3_DURATION);
                currentIntensity = this.MAX_SHAKE_INTENSITY * progress;
                
                this.shakeOffsetX = (Math.random() - 0.5) * currentIntensity;
                this.shakeOffsetY = (Math.random() - 0.5) * currentIntensity;

                // Świat wciąż trzęsie się z pełną mocą
                this.screenShakeX = (Math.random() - 0.5) * this.MAX_SCREEN_SHAKE_INTENSITY;
                this.screenShakeY = (Math.random() - 0.5) * this.MAX_SCREEN_SHAKE_INTENSITY;

                if (this.stateTimer <= 0) {
                    this.shakeOffsetX = 0; // Upewnij się, że totem jest nieruchomy
                    this.shakeOffsetY = 0;
                    this.state = this.states.SCREEN_SHAKE_DECREASING;
                    this.stateTimer = this.PHASE4_DURATION;
                }
                break;

            // Faza 4: Trzęsienie świata opada liniowo do 0
            case this.states.SCREEN_SHAKE_DECREASING:
                progress = Math.max(0, this.stateTimer / this.PHASE4_DURATION);
                currentIntensity = this.MAX_SCREEN_SHAKE_INTENSITY * progress;

                this.screenShakeX = (Math.random() - 0.5) * currentIntensity;
                this.screenShakeY = (Math.random() - 0.5) * currentIntensity;

                if (this.stateTimer <= 0) {
                    this.screenShakeX = 0; // Gwarancja zerowego wstrząsu na koniec
                    this.screenShakeY = 0;
                    this.state = this.states.TRANSITIONING;
                    this.stateTimer = this.TRANSITION_DURATION;
                }
                break;

            case this.states.TRANSITIONING:
                progress = 1 - (this.stateTimer / this.TRANSITION_DURATION);
                this.transitionAlpha = Math.min(1, progress);
                if (this.stateTimer <= 0) {
                    this.state = this.states.ACTIVE;
                    this.transitionAlpha = 1;
                    this.spawnParticleBurst(80);
                }
                break;
        }
    }

    setStateFromServer(newState, remainingTime) {
        if (this.states[newState] && this.state !== newState) {
            console.log(`[TOTEM SYNC] Ustawianie stanu na: ${newState} z czasem: ${remainingTime.toFixed(2)}s`);
            this.state = newState;
            this.stateTimer = remainingTime;

            // Specjalna obsługa przejścia do stanu ACTIVE
            if (newState === this.states.ACTIVE) {
                this.transitionAlpha = 1;
            }
        }
    }
    
    // Metoda draw pozostaje bez zmian, ale musisz zaimplementować screen shake
    draw(ctx) {
        // Rysowanie cząsteczek ZA totemem
        ctx.save();
        if (window.particleCharImage && window.particleCharImage.complete) {
            this.particles.forEach(p => {
                if (p.drawBehind) {
                    this.drawParticle(ctx, p);
                }
            });
        }
        ctx.restore();
        
        ctx.save();
        // WAŻNE: Aby zobaczyć trzęsienie ekranu, musisz zastosować `screenShakeX` i `screenShakeY`
        // do globalnego kontekstu rysowania (ctx) lub obiektu kamery PRZED narysowaniem czegokolwiek.
        // Na przykład: ctx.translate(this.screenShakeX, this.screenShakeY);
        // Poniższy kod przesuwa tylko totem.
        const drawX = this.x + this.shakeOffsetX;
        const drawY = this.y + this.shakeOffsetY;

        if (this.isHighlighted && this.state === this.states.IDLE) {
            ctx.filter = 'brightness(1.6)';
        }

        if (this.image && this.image.complete) {
            ctx.drawImage(this.image, drawX, drawY, this.width, this.height);
        } else {
            ctx.fillStyle = 'saddlebrown';
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }
       
        if (this.state === this.states.TRANSITIONING || this.state === this.states.ACTIVE) {
            const activeImage = window.totemActiveImages[this.biomeName];
            if (activeImage && activeImage.complete) {
                ctx.globalAlpha = this.transitionAlpha;
                ctx.drawImage(activeImage, drawX, drawY, this.width, this.height);
            }
        }
        
        ctx.restore();

        // Rysowanie cząsteczek PRZED totemem
        if (window.particleCharImage && window.particleCharImage.complete) {
            this.particles.forEach(p => {
                if (!p.drawBehind) {
                    this.drawParticle(ctx, p);
                }
            });
        }
    }
    
    // Metoda drawParticle pozostaje bez zmian
    drawParticle(ctx, p) {
        const progress = p.life / p.maxLife;
        const PARTICLE_BASE_SCALE = 4.2;
        ctx.save();
        ctx.globalAlpha = Math.sin((1 - progress) * Math.PI);
        ctx.translate(p.x + (p.size * p.scale * PARTICLE_BASE_SCALE) / 2, p.y + (p.size * p.scale * PARTICLE_BASE_SCALE) / 2);
        ctx.scale(p.scale, p.scale);
        ctx.drawImage(
            window.particleCharImage,
            p.sourceX, p.sourceY,
            p.size, p.size,
            -p.size / 2 * PARTICLE_BASE_SCALE, -p.size / 2 * PARTICLE_BASE_SCALE,
            p.size * PARTICLE_BASE_SCALE, p.size * PARTICLE_BASE_SCALE
        );
        ctx.restore();
    }
}


// === NOWA KLASA: TotemManager ===
class TotemManager {
    constructor(inventoryManager) {
        this.isOpen = false;
        this.inventoryManager = inventoryManager;

        // Definicja slotu na ofiarę dla totemu, teraz z właściwościami animacji
        this.cavitySlot = {
            id: 'totem_cavity',
            type: 'totem',
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
     * Otwiera lub zamyka interfejs totemu.
     */
    toggleUI() {
        if (this.inventoryManager.tradingManager && this.inventoryManager.tradingManager.isTradeWindowOpen) {
            return;
        }

        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            soundManager.play('inventory');
            if (isCustomizationMenuOpen) {
                isCustomizationMenuOpen = false;
            }
            this.inventoryManager.isOpen = true;
        } else {
            if (this.inventoryManager.heldItem) {
                this.inventoryManager._returnHeldItem();
            }

            // === NOWA LOGIKA: Sprawdź przedmiot i uruchom sekwencję ===
            const itemInCavity = this.cavitySlot.item;
            if (itemInCavity && mineralImagePaths[itemInCavity.name]) {
                // Zamiast wywoływać startAwakening() lokalnie,
                // wysyłamy prośbę o aktywację do hosta.
                sendPlayerAction('activateTotem'); 
            }
            // Zawsze usuwaj przedmiot po zamknięciu
            this.cavitySlot.item = null;
            
            this.inventoryManager.isOpen = false;
        }
    }
    
    _getHoveredSlot() {
        if (!this.isOpen) return null;
        const { x, y } = this._getSlotPosition();
        const mouse = this.inventoryManager.mousePos;
        const size = this.inventoryManager.SLOT_SIZE;
        if (mouse.x >= x && mouse.x <= x + size && mouse.y >= y && mouse.y <= y + size) {
            return this.cavitySlot;
        }
        return null;
    }

    _getSlotPosition() {
        const ROLLER_X_OFFSET_FROM_PLAYER = playerSize * currentZoomLevel * 1.5;
        const ROLLER_Y_OFFSET = -playerSize * currentZoomLevel * 0.5;
        const playerScreenX = (localPlayer.x - cameraX) * currentZoomLevel;
        const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;
        const menuX = playerScreenX + (playerSize / 2) * currentZoomLevel + ROLLER_X_OFFSET_FROM_PLAYER;
        const menuY = playerScreenY + (playerSize / 2) * currentZoomLevel + ROLLER_Y_OFFSET;
        return { x: menuX, y: menuY };
    }

    /**
     * NOWA METODA: Aktualizuje logikę animacji slotu.
     * @param {number} deltaTime - Czas od ostatniej klatki.
     */
    update(deltaTime) {
        if (!this.isOpen) return;

        const slot = this.cavitySlot;
        slot.rockingTimer += slot.rockingSpeed * deltaTime;

        const isHovered = this._getHoveredSlot() !== null;

        // Ustaw docelową skalę i oblicz rotację, tak jak w InventoryManager
        slot.targetScale = isHovered ? 1.15 : 1.0;
        slot.rotation = isHovered 
            ? Math.sin(slot.rockingTimer * 2.5) * (6 * Math.PI / 180) 
            : Math.sin(slot.rockingTimer) * slot.rockingAmplitude;
        
        // Płynnie animuj skalę do wartości docelowej
        slot.scale = lerp(slot.scale, slot.targetScale, 0.2);
    }

    /**
     * Rysuje interfejs totemu na ekranie.
     * @param {CanvasRenderingContext2D} ctx - Kontekst rysowania.
     */
    draw(ctx) {
        const frameImage = customizationUIImages.frame;
        if (!this.isOpen || !frameImage || !frameImage.complete) {
            return;
        }

        const pos = this._getSlotPosition();
        const size = this.inventoryManager.SLOT_SIZE;
        const slot = this.cavitySlot; // Użyjemy referencji dla czytelności
        
        const centerX = pos.x + size / 2;
        const centerY = pos.y + size / 2;
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Rysowanie napisu "Cavity" (ze zmniejszoną czcionką)
        const text = "Cavity";
        const textY = pos.y - 10;
        ctx.font = `bold 14px ${PIXEL_FONT}`; // <-- ZMIANA: 22px -> 20px
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(text, centerX, textY);
        ctx.fillStyle = 'white';
        ctx.fillText(text, centerX, textY);
        
        // Rysowanie ramki slotu z uwzględnieniem animacji
        ctx.translate(centerX, centerY);
        ctx.scale(slot.scale, slot.scale);
        ctx.rotate(slot.rotation); // <-- NOWA LINIA: Zastosowanie rotacji
        ctx.drawImage(frameImage, -size / 2, -size / 2, size, size);
        
        // Rysowanie przedmiotu w slocie
        if (slot.item) {
            this.inventoryManager._drawItem(ctx, slot.item, 0, 0);
        }

        ctx.restore();
    }
}