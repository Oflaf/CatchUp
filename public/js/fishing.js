function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

/**
 * Zarządza tworzeniem, animacją i rysowaniem cząsteczek (np. rozprysków wody).
 */
class ParticleManager {
    constructor() {
        this.particles = [];
        this.GRAVITY = 150; // Grawitacja w pikselach na sekundę^2
    }

    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vy += this.GRAVITY * deltaTime;
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        if (this.particles.length === 0) return;
        
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
    }

    createWaterSplash(x, y, particleCount = 2, speedMultiplier = 1) {
        if (x === null || y === null) return;
        const colors = ['#aedffc81', '#6fa8dd6c', '#ffffff52'];
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI;
            const speed = (60 + Math.random() * 90) * speedMultiplier;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed * (Math.random() < 0.8 ? 1 : -1),
                vy: -Math.sin(angle)*1.5 * speed,
                life: 0.15 + Math.random() * 0.22,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 4,
            });
        }
    }
}

class FishingManager {
    constructor() {
        this.fishData = {};
        this.baitData = {};
        this.hookData = {};
        this.particleManager = new ParticleManager(); // UTWORZENIE INSTANCJI
        
        this._initializeFishData();
        this._initializeBaitData();
        this._initializeHookData();

        this.isWaitingForBite = false;
        this.isBiting = false;
        this.isFishHooked = false;
        this.showFishFrame = false;
        this.biteTimeoutId = null;
        this.strikeTimeoutId = null;
        this.strikeImage = null;
        this.fishFrameImage = null;
        this.fishImages = {};
        this.baitImages = {}; 
        this.currentHook = null;
        this.strikeAnimationTime = 0;
        this.onFishingResetCallback = null;
        this.onBaitConsumedCallback = null;
        this.minigameBarPosition = 0;
        this.minigameBarVelocity = 0;
        this.minigameBarDirection = 0;
        this.maxSpeed = 700;
        this.acceleration = 0.15;
        this.fishFrameScale = 3.3;
        this.currentFish = null;
        this.fishPosition = 0;
        this.fishVelocity = 0;
        this.fishTargetVelocity = 0;
        this.fishMoveTimer = 0;
        this.catchProgressBarWidth = 0; 
        this.isCatchComplete = false;
        this.CATCH_PROGRESS_INCREASE_RATE = 50; 
        this.CATCH_PROGRESS_DECREASE_RATE = 150; 
        this.dugBaitAnimations = [];
        this.currentBait = null;
    }

    // Nowa metoda do wywoływania z zewnątrz
    createWaterSplash(x, y, particleCount, speedMultiplier) {
        this.particleManager.createWaterSplash(x, y + 10, particleCount, speedMultiplier);
    }

    startFishing(equippedBait, equippedHook) {
        if (this.isWaitingForBite || this.isBiting) return;
        this.cancelFishing();
        this.isWaitingForBite = true;
        if (!equippedBait || !equippedHook) {
            this.currentBait = null;
            this.currentHook = null;
            return;
        }
        this.currentBait = this.baitData[equippedBait.name];
        if (!this.currentBait) {
            console.error(`Brak danych dla przynęty o nazwie: ${equippedBait.name}`);
            this.cancelFishing();
            return;
        }
        this.currentHook = this.hookData[equippedHook.name];
        if (!this.currentHook) {
            console.error(`Brak danych dla haczyka o nazwie: ${equippedHook.name}`);
            this.cancelFishing();
            return;
        }
        const waitTimeReduction = this.currentBait.waitTimeReduction || 0;
        const baseWaitTime = 5000;
        const randomWaitComponent = Math.max(0, 5000 - waitTimeReduction);
        const totalWaitTime = baseWaitTime + Math.random() * randomWaitComponent;
        this.biteTimeoutId = setTimeout(() => { this.startBite(); }, totalWaitTime);
    }

    startBite() {
        this.isWaitingForBite = false;
        this.isBiting = true;
        this.strikeAnimationTime = 0;
        if (this.currentBait && this.onBaitConsumedCallback) {
            this.onBaitConsumedCallback();
        }
        this.strikeTimeoutId = setTimeout(() => this.failFishing(), 2000);
    }

    playerRightClicked(biomeName) {
        if (!this.isBiting) return;
        this.currentFish = this.getRandomCatch(biomeName, this.currentBait);
        if (!this.currentFish) {
            this.failFishing();
            return;
        }
        if (this.currentHook && this.currentHook.fishPowerModifier) {
            this.currentFish = {
                ...this.currentFish,
                power: this.currentFish.power * this.currentHook.fishPowerModifier
            };
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

    cleanUpAfterCatch() {
        this.showFishFrame = false;
        this.isFishHooked = false;
        this.isBiting = false; 
        this.catchProgressBarWidth = 0;
        this.isCatchComplete = false;
        this.currentBait = null; 
        this.currentHook = null;
        if (this.onFishingResetCallback) {
            this.onFishingResetCallback();
        }
    }

    setBarMovementDirection(direction) {
        if (this.isFishHooked) {
            this.minigameBarDirection = direction;
        }
    }

    failFishing() {
        this.isBiting = false;
        this.catchProgressBarWidth = 0;
        this.isCatchComplete = false;
        this.currentBait = null; 
        this.currentHook = null;
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
        this.currentBait = null; 
        this.currentHook = null;
    }

    update(deltaTime, player) {
    this.particleManager.update(deltaTime); // Aktualizacja cząsteczek

    // Generowanie cząsteczek podczas brania (strike) i walki z rybą (minigra)
    if ((this.isBiting || this.isFishHooked) && player && player.hasLineCast) {
        if (Math.random() < 0.7) { 
            this.createWaterSplash(
                player.floatWorldX,
                player.floatWorldY,
                3,
                1.2
            );
        }
    }

    // ================== KLUCZOWA POPRAWKA ==================
    // Ta linia musi tu być, aby animacja pulsowania i bujania działała.
    if (this.isBiting || this.isFishHooked) {
        this.strikeAnimationTime += deltaTime;
    }
    // ========================================================

    if (this.isFishHooked && this.currentFish) {
        const speedModifier = this.currentHook?.playerBarSpeedModifier || 1.0;
        const widthModifier = this.currentHook?.playerBarWidthModifier || 1.0;
        const actualMaxSpeed = this.maxSpeed * speedModifier;
        const targetPlayerVelocity = this.minigameBarDirection * actualMaxSpeed;
        
        // Poprawka prędkości minigry (niezależna od FPS)
        this.minigameBarVelocity = lerp(this.minigameBarVelocity, targetPlayerVelocity, 1 - Math.pow(1 - this.acceleration, deltaTime * 60));
        
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

        // Poprawka prędkości ryby (niezależna od FPS)
        const fishLerpFactor = 0.05;
        this.fishVelocity = lerp(this.fishVelocity, this.fishTargetVelocity, 1 - Math.pow(1 - fishLerpFactor, deltaTime * 60));
        
        this.fishPosition += this.fishVelocity * deltaTime;
        
        if (this.fishFrameImage) {
            const baseBarWidth = 128;
            const barWidth = baseBarWidth * widthModifier;
            const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
            const frameHeight = this.fishFrameImage.height * this.fishFrameScale;
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
        // Rysowanie cząsteczek odbywa się w tle, w przestrzeni świata
        ctx.save();
        ctx.scale(currentZoom, currentZoom);
        ctx.translate(-cameraX, -cameraY);
        this.particleManager.draw(ctx); // RYSOWANIE CZĄSTECZEK
        ctx.restore();

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

    _initializeHookData() {
        this.hookData = {
            'weedless': { name: 'weedless', fishPowerModifier: 1, playerBarWidthModifier: 1, playerBarSpeedModifier: 1 },
            'sharp': { name: 'sharp', fishPowerModifier: 1.1, playerBarWidthModifier: 0.8, playerBarSpeedModifier: 1.25 },
        };
    }

    _initializeBaitData() {
        this.baitData = {
            'worm': { name: 'worm', chance: 65, fishChanceBonus: { 'roach': 1.2, 'perch': 1.2, 'crucian': 1.1 } },
            'bloodworm': { name: 'bloodworm', chance: 25, waitTimeReduction: 3000, fishChanceBonus: { 'catfish': 1.8, 'carp': 1.4, 'roach': 0.5 } },
        };
    }

    getRandomBait() {
        const availableBaits = Object.values(this.baitData);
        if (availableBaits.length === 0) return null;
        const totalChanceWeight = availableBaits.reduce((sum, bait) => sum + bait.chance, 0);
        let randomPick = Math.random() * totalChanceWeight;
        for (const bait of availableBaits) {
            if (randomPick < bait.chance) return bait; 
            randomPick -= bait.chance;
        }
        return null;
    }

    startDiggingAnimation(playerId, bait, startPos) {
        if (!playerId || !bait || !startPos || typeof startPos.clickX !== 'number' || typeof startPos.clickY !== 'number') {
             console.error("Invalid data provided to startDiggingAnimation", { playerId, bait, startPos });
             return;
        }
        this.dugBaitAnimations.push({
            playerId, baitName: bait.name, startTime: Date.now(),
            startPos: { x: startPos.clickX, y: startPos.clickY }
        });
    }

    updateAndDrawDugBaitAnimations(ctx, players, cameraX, cameraY, currentZoom) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const now = Date.now();
        const BAIT_ANIMATION_DURATION = 1200;
        const BAIT_DISPLAY_DURATION = 3000;
        for (let i = this.dugBaitAnimations.length - 1; i >= 0; i--) {
            const anim = this.dugBaitAnimations[i];
            const player = players[anim.playerId];
            if (!player || now > anim.startTime + BAIT_ANIMATION_DURATION + BAIT_DISPLAY_DURATION) {
                this.dugBaitAnimations.splice(i, 1);
                continue;
            }
            const startScreenPos = { x: (anim.startPos.x - cameraX) * currentZoom, y: (anim.startPos.y - cameraY) * currentZoom };
            const targetScreenPos = { x: (player.x + playerSize / 2 - cameraX) * currentZoom, y: (player.y - 60 - cameraY) * currentZoom };
            const elapsed = now - anim.startTime;
            const baitImg = this.baitImages[anim.baitName];
            if (!baitImg || !baitImg.complete) continue;
            let currentPos;
            if (elapsed < BAIT_ANIMATION_DURATION) {
                const progress = elapsed / BAIT_ANIMATION_DURATION;
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                currentPos = {
                    x: lerp(startScreenPos.x, targetScreenPos.x, easeProgress),
                    y: lerp(startScreenPos.y, targetScreenPos.y, easeProgress)
                };
                const baitWidth = baitImg.width * 1.4;
                const baitHeight = baitImg.height * 1.4;
                ctx.drawImage(baitImg, currentPos.x - baitWidth / 2, currentPos.y - baitHeight / 2, baitWidth, baitHeight);
            } else {
                currentPos = targetScreenPos;
                const baitWidth = baitImg.width * 1.4;
                const baitHeight = baitImg.height * 1.4;
                ctx.drawImage(baitImg, currentPos.x - baitWidth / 2, currentPos.y - baitHeight / 2, baitWidth, baitHeight);
                const text = anim.baitName;
                ctx.font = `16px ${PIXEL_FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const displayElapsed = elapsed - BAIT_ANIMATION_DURATION;
                const FADE_TIME = 500;
                let textAlpha = 1.0;
                if (displayElapsed < FADE_TIME) {
                    textAlpha = displayElapsed / FADE_TIME;
                } else if (displayElapsed > BAIT_DISPLAY_DURATION - FADE_TIME) {
                    textAlpha = (BAIT_DISPLAY_DURATION - displayElapsed) / FADE_TIME;
                }
                ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * textAlpha})`;
                ctx.fillText(text, currentPos.x + 1, currentPos.y - 30 + 1);
                ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
                ctx.fillText(text, currentPos.x, currentPos.y - 30);
            }
        }
        ctx.restore();
    }
    
    _initializeFishData() {
        this.fishData = {
            'grassland': { 'roach': {chance: 5, power: 22, minsize: 10, maxsize: 40, tier: 1}, 'crucian': {chance: 30, power: 28, minsize: 15, maxsize: 45, tier: 1}, 'carp': {chance: 30, power: 31, minsize: 30, maxsize: 90, tier: 2}, 'catfish': {chance: 20, power: 38, minsize: 30, maxsize: 100, tier: 4}, 'perch': {chance: 50, power: 28, minsize: 10, maxsize: 60, tier: 1}, 'longear sunfish': {chance: 20, power: 34, minsize: 6, maxsize: 15, tier: 4}, },
            'jurassic': { 'roach': {chance: 40, power: 18, minsize: 15, maxsize: 40, tier: 0}, 'crucian': {chance: 30, power: 22, minsize: 15, maxsize: 45, tier: 2}, 'carp': {chance: 30, power: 31, minsize: 30, maxsize: 90, tier: 3}, 'catfish': {chance: 20, power: 38, minsize: 30, maxsize: 100, tier: 4}, 'perch': {chance: 50, power: 28, minsize: 10, maxsize: 60, tier: 1}, 'longear sunfish': {chance: 20, power: 34, minsize: 6, maxsize: 15, tier: 4}, }
        };
    }
    
    getFishData() { return this.fishData; }

    getRandomCatch(biomeName, currentBait) {
        const biomeFish = this.fishData[biomeName];
        if (!biomeFish) {
            console.warn(`[FishingManager] Nie znaleziono danych dla biomu: ${biomeName}`);
            return null;
        }
        let availableFish = Object.entries(biomeFish).map(([name, data]) => ({ name, ...data }));
        if (currentBait && currentBait.fishChanceBonus) {
            availableFish = availableFish.map(fish => {
                const bonus = currentBait.fishChanceBonus[fish.name];
                if (bonus) {
                    return { ...fish, chance: Math.max(0, fish.chance * bonus) };
                }
                return fish;
            });
        }
        if (availableFish.length === 0) return null;
        const totalChanceWeight = availableFish.reduce((sum, fish) => sum + fish.chance, 0);
        let randomPick = Math.random() * totalChanceWeight;
        for (const fish of availableFish) {
            if (randomPick < fish.chance) return fish; 
            randomPick -= fish.chance;
        }
        return null;
    }
}