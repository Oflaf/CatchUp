function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

class FishingManager {
    constructor() {
        this.fishData = {};
        this._initializeFishData();

        // Stan procesu łowienia
        this.isWaitingForBite = false;
        this.isBiting = false;
        this.isFishHooked = false; 
        this.showFishFrame = false;

        // ID timeoutów
        this.biteTimeoutId = null;
        this.strikeTimeoutId = null;

        // Zasoby graficzne
        this.strikeImage = null;
        this.fishFrameImage = null;
        this.fishImages = {};
        
        // Czas animacji
        this.strikeAnimationTime = 0;
        this.onFishingResetCallback = null;

        // Stan mini-gry z paskiem gracza
        this.minigameBarPosition = 0;
        this.minigameBarVelocity = 0;
        this.minigameBarDirection = 0;
        this.maxSpeed = 700;
        this.acceleration = 0.15;
        this.fishFrameScale = 3.3;

        // Stan złapanej ryby w mini-grze
        this.currentFish = null;
        this.fishPosition = 0;
        this.fishVelocity = 0;
        this.fishTargetVelocity = 0;
        this.fishMoveTimer = 0;
    }

    startFishing() {
        if (this.isWaitingForBite || this.isBiting) return;
        this.cancelFishing(); 

        this.isWaitingForBite = true;
        this.biteTimeoutId = setTimeout(() => {
            this.startBite();
        }, 5000 + Math.random() * 5000);
    }

    startBite() {
        this.isWaitingForBite = false;
        this.isBiting = true;
        this.strikeAnimationTime = 0;
        this.strikeTimeoutId = setTimeout(() => this.failFishing(), 2000);
    }

    playerRightClicked(biomeName) {
        if (!this.isBiting) return;
        
        this.currentFish = this.getRandomCatch(biomeName);
        if (!this.currentFish) {
            this.failFishing();
            return;
        }

        clearTimeout(this.strikeTimeoutId);
        this.strikeTimeoutId = null;
        this.isBiting = false;
        this.isFishHooked = true;
        this.showFishFrame = true;

        this.fishPosition = 0;
        this.fishVelocity = 0;
        this.fishTargetVelocity = 0;
        this.fishMoveTimer = 0;
    }

    setBarMovementDirection(direction) {
        if (this.isFishHooked) {
            this.minigameBarDirection = direction;
        }
    }

    failFishing() {
        this.isBiting = false;
        if (this.onFishingResetCallback) this.onFishingResetCallback();
    }

    cancelFishing() {
        clearTimeout(this.biteTimeoutId);
        clearTimeout(this.strikeTimeoutId);
        this.biteTimeoutId = null;
        this.strikeTimeoutId = null;
        this.isWaitingForBite = false;
        this.isBiting = false;
        this.isFishHooked = false; 
        this.showFishFrame = false; 
        this.minigameBarPosition = 0;
        this.minigameBarVelocity = 0;
        this.minigameBarDirection = 0;
        this.currentFish = null;
    }

    update(deltaTime) {
        if (this.isBiting || this.isFishHooked) {
            this.strikeAnimationTime += deltaTime;
        }

        if (this.isFishHooked && this.currentFish) {
            const targetPlayerVelocity = this.minigameBarDirection * this.maxSpeed;
            this.minigameBarVelocity = lerp(this.minigameBarVelocity, targetPlayerVelocity, this.acceleration);
            if (Math.abs(this.minigameBarVelocity) < 1) this.minigameBarVelocity = 0;
            this.minigameBarPosition += this.minigameBarVelocity * deltaTime;

            this.fishMoveTimer -= deltaTime;
            if (this.fishMoveTimer <= 0) {
                const direction = (Math.random() < 0.5) ? 1 : -1;
                const speedMultiplier = 0.2 + Math.random() * 0.8;
                const fishMaxSpeed = this.currentFish.power * 15; 
                this.fishTargetVelocity = direction * fishMaxSpeed * speedMultiplier;
                this.fishMoveTimer = 0.5 + Math.random() * 1.5;
            }

            this.fishVelocity = lerp(this.fishVelocity, this.fishTargetVelocity, 0.05);
            this.fishPosition += this.fishVelocity * deltaTime;

            if (this.fishFrameImage) {
                const barWidth = 128;
                const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
                const barMaxOffset = (frameWidth / 2) - (barWidth / 2);
                
                if (this.minigameBarPosition > barMaxOffset) {
                    this.minigameBarPosition = barMaxOffset;
                    this.minigameBarVelocity = 0;
                } else if (this.minigameBarPosition < -barMaxOffset) {
                    this.minigameBarPosition = -barMaxOffset;
                    this.minigameBarVelocity = 0;
                }

                const fishImg = this.fishImages[this.currentFish.name];
                const fishWidth = fishImg ? (fishImg.width * 3) : 60;
                const fishMaxOffset = (frameWidth / 2) - (fishWidth / 2);

                if (this.fishPosition > fishMaxOffset) {
                    this.fishPosition = fishMaxOffset;
                    this.fishVelocity *= -1;
                    this.fishTargetVelocity *= -1;
                } else if (this.fishPosition < -fishMaxOffset) {
                    this.fishPosition = -fishMaxOffset;
                    this.fishVelocity *= -1;
                    this.fishTargetVelocity *= -1;
                }
            }
        }
    }


    draw(ctx, player, bobberPosition, cameraX, currentZoom) {

        // Rysowanie ikony "strike.png"
        if (this.isBiting && this.strikeImage && this.strikeImage.complete && bobberPosition) {
            const PULSE_SPEED = 25; 
            const PULSE_AMPLITUDE = 0.4;
            const BASE_SCALE = 1.2;
            const ROCKING_SPEED = 10;
            const MAX_ROCKING_ANGLE_DEG = 25;
            const scale = BASE_SCALE + Math.sin(this.strikeAnimationTime * PULSE_SPEED) * PULSE_AMPLITUDE;
            const maxRotationRad = MAX_ROCKING_ANGLE_DEG * (Math.PI / 180);
            const rotation = Math.sin(this.strikeAnimationTime * ROCKING_SPEED) * maxRotationRad;
            const imgWidth = this.strikeImage.width * scale;
            const imgHeight = this.strikeImage.height * scale;
            const x = bobberPosition.x - imgWidth / 2;
            const y = bobberPosition.y - imgHeight / 2 - 50;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(x + imgWidth / 2, y + imgHeight / 2);
            ctx.rotate(rotation);
            ctx.drawImage(this.strikeImage, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
            ctx.restore();
        }

        // Rysowanie ramki "fishframe.png" i zielonego paska
                if (this.showFishFrame && this.fishFrameImage && this.fishFrameImage.complete && bobberPosition) {
            const FRAME_ROCKING_SPEED = 2;
            const FRAME_ROCKING_ANGLE_DEG = 5;
            const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
            const frameHeight = this.fishFrameImage.height * this.fishFrameScale;
            const x = bobberPosition.x + 40;
            const y = bobberPosition.y - frameHeight;
            const frameRotation = Math.sin(Date.now() / 1000 * FRAME_ROCKING_SPEED) * (FRAME_ROCKING_ANGLE_DEG * Math.PI / 180);
            
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(x + frameWidth / 2, y + frameHeight / 2);
            ctx.rotate(frameRotation);
            
            const barWidth = 128;
            const barHeight = frameHeight;
            const barX = this.minigameBarPosition - (barWidth / 2);
            const barY = -frameHeight / 2;
            ctx.fillStyle = 'rgba(11, 207, 34, 0.9)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            ctx.drawImage(this.fishFrameImage, -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
            
            if (this.currentFish) {
                const fishImg = this.fishImages[this.currentFish.name];
                if (fishImg && fishImg.complete) {
                    // ======================= POCZĄTEK ZMIAN =======================
                    // 1. Oblicz granice paska i ryby
                    const fishHeight = fishImg.height * 3;
                    const fishWidth = fishImg.width * 3;
                    const fishX = this.fishPosition;
                    const fishY = 0;

                    const barLeftEdge = this.minigameBarPosition - (barWidth / 2);
                    const barRightEdge = this.minigameBarPosition + (barWidth / 2);
                    const fishLeftEdge = this.fishPosition - (fishWidth / 2);
                    const fishRightEdge = this.fishPosition + (fishWidth / 2);

                    // 2. Sprawdź, czy występuje kolizja (overlap)
                    const isOverlapping = barLeftEdge < fishRightEdge && barRightEdge > fishLeftEdge;

                    // 3. Ustaw przezroczystość na podstawie kolizji
                    const targetAlpha = isOverlapping ? 1.0 : 0.3; // Pełna widoczność lub prawie niewidoczna
                    ctx.globalAlpha = lerp(ctx.globalAlpha, targetAlpha, 0.7); // Płynne przejście alpha
                    
                    // 4. Narysuj rybę z obliczoną przezroczystością i obrotem
                    const FISH_ROCKING_SPEED = 8;
                    const FISH_ROCKING_ANGLE_DEG = 14;
                    const fishRotation = Math.sin(Date.now() / 1000 * FISH_ROCKING_SPEED) * (FISH_ROCKING_ANGLE_DEG * Math.PI / 180);

                    ctx.save();
                    ctx.translate(fishX, fishY);
                    ctx.rotate(fishRotation);
                    ctx.drawImage(fishImg, -fishWidth / 2, -fishHeight / 2, fishWidth, fishHeight);
                    ctx.restore();
                    // ======================== KONIEC ZMIAN =========================
                }
            }
            
            ctx.restore();
        }
    }

    _initializeFishData() {
        this.fishData = {
            'grassland': {
                'roach': {chance: 50, power: 20 },
                'crucian': {chance: 30, power: 8 },
            },
            'jurassic': {
                'roach': {chance: 50, power: 8 },
                'crucian': {chance: 30, power: 16 },
            }
        };
    }
    
    // Zwraca całą strukturę danych, przydatne do ładowania obrazków
    getFishData() {
        return this.fishData;
    }

    getRandomCatch(biomeName) {
        const biomeFish = this.fishData[biomeName];
        if (!biomeFish) {
            console.warn(`[FishingManager] Nie znaleziono danych dla biomu: ${biomeName}`);
            return null;
        }
        const availableFish = Object.entries(biomeFish).map(([name, data]) => ({ name, ...data }));
        if (availableFish.length === 0) return null;

        const totalChanceWeight = availableFish.reduce((sum, fish) => sum + fish.chance, 0);
        let randomPick = Math.random() * totalChanceWeight;

        for (const fish of availableFish) {
            if (randomPick < fish.chance) {
                // Usuwamy size, bo nie jest już potrzebny w tej wersji
                return { name: fish.name, power: fish.power };
            }
            randomPick -= fish.chance;
        }
        return null;
    }
}