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

        // Zmienne dla paska postępu łapania ryby
        this.catchProgressBarWidth = 0; 
        this.isCatchComplete = false;
        this.CATCH_PROGRESS_INCREASE_RATE = 50; 
        this.CATCH_PROGRESS_DECREASE_RATE = 150; 
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

        this.catchProgressBarWidth = 0;
        this.isCatchComplete = false;
    }

    // ======================= POCZĄTEK ZMIAN =======================
    /**
     * Czyści UI minigry i resetuje stan po udanym złapaniu,
     * przygotowując do animacji złapanej ryby.
     */
    cleanUpAfterCatch() {
        this.showFishFrame = false;
        this.isFishHooked = false;
        this.isBiting = false; // Na wszelki wypadek
        this.catchProgressBarWidth = 0;
        this.isCatchComplete = false;
        
        // Wywołaj callback, aby schować wędkę
        if (this.onFishingResetCallback) {
            this.onFishingResetCallback();
        }
        // Celowo nie czyścimy this.currentFish, bo serwer może go potrzebować do weryfikacji
    }
    // ======================== KONIEC ZMIAN =========================

    setBarMovementDirection(direction) {
        if (this.isFishHooked) {
            this.minigameBarDirection = direction;
        }
    }

    failFishing() {
        this.isBiting = false;
        this.catchProgressBarWidth = 0;
        this.isCatchComplete = false;
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
        this.catchProgressBarWidth = 0;
        this.isCatchComplete = false;
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
                
                const barLeftEdge = this.minigameBarPosition - (barWidth / 2);
                const barRightEdge = this.minigameBarPosition + (barWidth / 2);
                const fishLeftEdge = this.fishPosition - (fishWidth / 2);
                const fishRightEdge = this.fishPosition + (fishWidth / 2);

                const isOverlapping = barLeftEdge < fishRightEdge && barRightEdge > fishLeftEdge;
                
                if (isOverlapping) {
                    this.catchProgressBarWidth += this.CATCH_PROGRESS_INCREASE_RATE * deltaTime;
                } else {
                    this.catchProgressBarWidth -= this.CATCH_PROGRESS_DECREASE_RATE * deltaTime;
                }

                this.catchProgressBarWidth = Math.max(0, Math.min(this.catchProgressBarWidth, frameWidth));
                this.isCatchComplete = this.catchProgressBarWidth >= frameWidth;
            }
        }
    }


    draw(ctx, player, bobberPosition, cameraX, currentZoom) {
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
            
            const progressBarHeight = 20; 
            const progressBarY = (frameHeight / 2) + 8; 
            const gradient = ctx.createLinearGradient(-frameWidth / 2, 0, frameWidth / 2, 0);
            gradient.addColorStop(0, 'red');
            gradient.addColorStop(0.5, 'yellow');
            gradient.addColorStop(1, 'lime');
            ctx.fillStyle = gradient;
            ctx.fillRect(-frameWidth / 2, progressBarY, this.catchProgressBarWidth, progressBarHeight);

            if (this.currentFish) {
                const fishImg = this.fishImages[this.currentFish.name];
                if (fishImg && fishImg.complete) {
                    const fishHeight = fishImg.height * 3;
                    const fishWidth = fishImg.width * 3;
                    const fishX = this.fishPosition;
                    const fishY = 0;
                    const barLeftEdge = this.minigameBarPosition - (barWidth / 2);
                    const barRightEdge = this.minigameBarPosition + (barWidth / 2);
                    const fishLeftEdge = this.fishPosition - (fishWidth / 2);
                    const fishRightEdge = this.fishPosition + (fishWidth / 2);
                    const isOverlapping = barLeftEdge < fishRightEdge && barRightEdge > fishLeftEdge;
                    const targetAlpha = isOverlapping ? 1.0 : 0.3;
                    ctx.globalAlpha = lerp(ctx.globalAlpha, targetAlpha, 0.7);
                    const FISH_ROCKING_SPEED = 8;
                    const FISH_ROCKING_ANGLE_DEG = 14;
                    const fishRotation = Math.sin(Date.now() / 1000 * FISH_ROCKING_SPEED) * (FISH_ROCKING_ANGLE_DEG * Math.PI / 180);
                    ctx.save();
                    ctx.translate(fishX, fishY);
                    ctx.rotate(fishRotation);
                    ctx.drawImage(fishImg, -fishWidth / 2, -fishHeight / 2, fishWidth, fishHeight);
                    ctx.restore();
                    ctx.globalAlpha = 1.0; 
                }
            }
            
            if (this.isCatchComplete && this.strikeImage && this.strikeImage.complete) {
                const PULSE_SPEED = 25; 
                const PULSE_AMPLITUDE = 0.4;
                const BASE_SCALE = 1.0; 
                const ROCKING_SPEED = 10;
                const MAX_ROCKING_ANGLE_DEG = 25;
                const scale = BASE_SCALE + Math.sin(this.strikeAnimationTime * PULSE_SPEED) * PULSE_AMPLITUDE;
                const maxRotationRad = MAX_ROCKING_ANGLE_DEG * (Math.PI / 180);
                const rotation = Math.sin(this.strikeAnimationTime * ROCKING_SPEED) * maxRotationRad;
                const strikeBaseWidth = this.strikeImage.width * 1.5;
                const strikeBaseHeight = this.strikeImage.height * 1.5;
                const imgWidth = strikeBaseWidth * scale;
                const imgHeight = strikeBaseHeight * scale;
                const xPos = (frameWidth / 2) - (strikeBaseWidth / 2) - 5; 
                const yPos = (-frameHeight / 2) + (strikeBaseHeight / 2) + 5;
                ctx.save();
                ctx.translate(xPos, yPos);
                ctx.rotate(rotation);
                ctx.drawImage(this.strikeImage, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                ctx.restore();
            }

            ctx.restore();
        }
    }

    // ======================= POCZĄTEK ZMIAN =======================
    _initializeFishData() {
        this.fishData = {
            'grassland': {
                'roach': {chance: 50, power: 22, minsize: 15, maxsize: 40, tier: 1},
                'crucian': {chance: 30, power: 28, minsize: 15, maxsize: 45, tier: 2},
            },
            'jurassic': {
                'roach': {chance: 40, power: 18, minsize: 15, maxsize: 40, tier: 0},
                'crucian': {chance: 30, power: 22, minsize: 15, maxsize: 45, tier: 2},
            }
        };
    }
    // ======================== KONIEC ZMIAN =========================
    
    getFishData() { return this.fishData; }

    getRandomCatch(biomeName) {
        const biomeFish = this.fishData[biomeName];
        if (!biomeFish) {
            console.warn(`[FishingManager] Nie znaleziono danych dla biomu: ${biomeName}`);
            return null;
        }
        // ZMIANA: Object.entries zwraca [klucz, wartość], więc musimy zmapować to poprawnie
        const availableFish = Object.entries(biomeFish).map(([name, data]) => ({ name, ...data }));
        if (availableFish.length === 0) return null;

        const totalChanceWeight = availableFish.reduce((sum, fish) => sum + fish.chance, 0);
        let randomPick = Math.random() * totalChanceWeight;

        for (const fish of availableFish) {
            if (randomPick < fish.chance) {
                // ======================= POCZĄTEK ZMIAN =======================
                // POPRAWKA: Zamiast tworzyć nowy, wybiorczy obiekt, zwracamy
                // cały znaleziony obiekt 'fish', który zawiera już pole 'tier'.
                return fish; 
                // ======================== KONIEC ZMIAN =========================
            }
            randomPick -= fish.chance;
        }
        return null;
    }
}