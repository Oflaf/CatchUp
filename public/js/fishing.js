function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

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
                vy: -Math.sin(angle) * 1.5 * speed,
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
        this.particleManager = new ParticleManager();
        
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
        
        this.isFailAnimationPlaying = false; 
        this.failAnimationTimer = 0;       
        this.escapedFish = null;
    }

    _triggerFailAnimation() {
    if (!this.currentFish || this.isFailAnimationPlaying) return;

    this.isFailAnimationPlaying = true;
    this.failAnimationTimer = 0;
    
    const fishImg = this.fishImages[this.currentFish.name];
    const fishWidth = fishImg ? (fishImg.width * 3) : 60;
    const fishHeight = fishImg ? (fishImg.height * 3) : 60;

    this.escapedFish = {
        img: fishImg,
        x: this.fishPosition,
        y: 0,
        width: fishWidth,
        height: fishHeight,
        rotation: 0,
        velocityY: -450,
        rotationSpeed: 10,
        scaleX: -1,
        // ======================= POCZĄTEK ZMIAN =======================
        hasSplashed: false,
        splashTime: 0, // Czas wpadnięcia do wody
        alpha: 1       // Początkowa przezroczystość
        // ======================== KONIEC ZMIAN =========================
    };

    this.isFishHooked = false;
    this.currentFish = null;
}

    handlePrematurePull() {
        if (this.isFishHooked) {
            this._triggerFailAnimation();
        }
    }

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
        this.isFailAnimationPlaying = false; 
        this.escapedFish = null;
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
        this.showFishFrame = false;
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
        this.isFailAnimationPlaying = false;
        this.escapedFish = null;
    }

    update(deltaTime, player, bobberScreenPos) {
        this.particleManager.update(deltaTime);

        if ((this.isBiting || this.isFishHooked) && player && player.hasLineCast) {
            if (Math.random() < 0.7) { 
                this.createWaterSplash(player.floatWorldX, player.floatWorldY, 3, 1.2);
            }
        }

        if (this.isBiting || this.isFishHooked) {
            this.strikeAnimationTime += deltaTime;
        }

        if (this.isFishHooked && this.currentFish) {
            const widthModifier = this.currentHook?.playerBarWidthModifier || 1.0;
            const speedModifier = this.currentHook?.playerBarSpeedModifier || 1.0;
            const actualMaxSpeed = this.maxSpeed * speedModifier;
            const targetPlayerVelocity = this.minigameBarDirection * actualMaxSpeed;
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
            const fishLerpFactor = 0.05;
            this.fishVelocity = lerp(this.fishVelocity, this.fishTargetVelocity, 1 - Math.pow(1 - fishLerpFactor, deltaTime * 60));
            this.fishPosition += this.fishVelocity * deltaTime;
            
            if (this.fishFrameImage) {
                const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
                const barWidth = 128 * widthModifier;
                const barMaxOffset = (frameWidth / 2) - (barWidth / 2);
                this.minigameBarPosition = Math.max(-barMaxOffset, Math.min(barMaxOffset, this.minigameBarPosition));
                
                const fishImg = this.fishImages[this.currentFish.name];
                const fishWidth = fishImg ? (fishImg.width * 3) : 60;
                const fishMaxOffset = (frameWidth / 2) - (fishWidth / 2);
                if (this.fishPosition > fishMaxOffset || this.fishPosition < -fishMaxOffset) {
                    this.fishPosition = Math.max(-fishMaxOffset, Math.min(fishMaxOffset, this.fishPosition));
                    this.fishVelocity *= -1;
                    this.fishTargetVelocity *= -1;
                }

                const barLeftEdge = this.minigameBarPosition - (barWidth / 2);
                const barRightEdge = this.minigameBarPosition + (barWidth / 2);
                const fishLeftEdge = this.fishPosition - (fishWidth / 2);
                const fishRightEdge = this.fishPosition + (fishWidth / 2);
                
                if (barLeftEdge < fishRightEdge && barRightEdge > fishLeftEdge) {
                    this.catchProgressBarWidth += this.CATCH_PROGRESS_INCREASE_RATE * deltaTime;
                } else {
                    this.catchProgressBarWidth -= this.CATCH_PROGRESS_DECREASE_RATE * deltaTime;
                }
                
                this.catchProgressBarWidth = Math.max(0, Math.min(this.catchProgressBarWidth, frameWidth));
                
                this.isCatchComplete = this.catchProgressBarWidth >= frameWidth;

                if (this.catchProgressBarWidth <= 0 && this.isFishHooked) {
                    this._triggerFailAnimation();
                }
            }
        }

        if (this.isFailAnimationPlaying) {
    this.failAnimationTimer += deltaTime;

    if (this.escapedFish) {
        if (this.failAnimationTimer > 0.4) { // Fizyka zaczyna działać po migotaniu
            const GRAVITY = 800;
            this.escapedFish.velocityY += GRAVITY * deltaTime;
            this.escapedFish.y += this.escapedFish.velocityY * deltaTime;
            this.escapedFish.rotation += this.escapedFish.rotationSpeed * deltaTime;
        }

        // ======================= POCZĄTEK ZMIAN =======================
        // Sprawdź, czy ryba "wpadła do wody"
        if (bobberScreenPos && this.escapedFish.y > 0 && !this.escapedFish.hasSplashed) {
            this.escapedFish.hasSplashed = true; // Ustaw flagę, by rozprysk był jednorazowy
            
            // Zapisz czas, w którym ryba wpadła do wody, aby obliczyć zanikanie
            this.escapedFish.splashTime = this.failAnimationTimer;

            const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
            const frameBaseX = bobberScreenPos.x + 40;
            const frameCenterX = frameBaseX + frameWidth / 2;
            const splashX = frameCenterX + this.escapedFish.x;
            
            const splashWorldX = (splashX / currentZoomLevel) + cameraX;
            const splashWorldY = (bobberScreenPos.y / currentZoomLevel) + cameraY;

            // Stwórz WIĘKSZY rozprysk (więcej cząsteczek, większa prędkość)
            this.createWaterSplash(splashWorldX, splashWorldY, 130, 1.5);
        }

        // Oblicz zanikanie (alpha) po wpadnięciu do wody
        if (this.escapedFish.hasSplashed) {
            const FADE_DURATION = 0.3; // Czas trwania zanikania w sekundach
            const timeSinceSplash = this.failAnimationTimer - this.escapedFish.splashTime;
            // Alpha maleje od 1 do 0 w czasie FADE_DURATION
            this.escapedFish.alpha = Math.max(0, 1 - (timeSinceSplash / FADE_DURATION));
        } else {
            this.escapedFish.alpha = 1; // Domyślnie w pełni widoczna
        }
        // ======================== KONIEC ZMIAN =========================
    }

    if (this.failAnimationTimer > 2.0) {
        this.isFailAnimationPlaying = false;
        this.escapedFish = null;
        this.failFishing();
    }
}}

    draw(ctx, player, bobberPosition, cameraX, currentZoom) {
        ctx.save();
        ctx.scale(currentZoom, currentZoom);
        ctx.translate(-cameraX, -cameraY);
        this.particleManager.draw(ctx);
        ctx.restore();

        if (this.isBiting && this.strikeImage && this.strikeImage.complete && bobberPosition) {
            const PULSE_SPEED = 25, PULSE_AMPLITUDE = 0.4, BASE_SCALE = 1.2, ROCKING_SPEED = 10, MAX_ROCKING_ANGLE_DEG = 25;
            const scale = BASE_SCALE + Math.sin(this.strikeAnimationTime * PULSE_SPEED) * PULSE_AMPLITUDE;
            const rotation = Math.sin(this.strikeAnimationTime * ROCKING_SPEED) * (MAX_ROCKING_ANGLE_DEG * Math.PI / 180);
            const imgWidth = this.strikeImage.width * scale, imgHeight = this.strikeImage.height * scale;
            const x = bobberPosition.x - imgWidth / 2, y = bobberPosition.y - imgHeight / 2 - 50;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(x + imgWidth / 2, y + imgHeight / 2);
            ctx.rotate(rotation);
            ctx.drawImage(this.strikeImage, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
            ctx.restore();
        }

        if ((this.showFishFrame || this.isFailAnimationPlaying) && this.fishFrameImage && this.fishFrameImage.complete && bobberPosition) {
            const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
            const frameHeight = this.fishFrameImage.height * this.fishFrameScale;
            const x = bobberPosition.x + 40, y = bobberPosition.y - frameHeight;
            
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(x + frameWidth / 2, y + frameHeight / 2);
            
            const isFlickering = this.isFailAnimationPlaying && this.failAnimationTimer < 0.7;
            const showDuringFlicker = isFlickering ? (Math.floor(this.failAnimationTimer * 10) % 2 === 0) : true;
            const showUI = !this.isFailAnimationPlaying || isFlickering;

            if (showUI && showDuringFlicker) {
                const barWidth = 128 * (this.currentHook?.playerBarWidthModifier || 1.0);
                const barHeight = frameHeight;
                const barX = this.minigameBarPosition - (barWidth / 2);
                const barY = -frameHeight / 2;
                ctx.fillStyle = 'rgba(11, 207, 34, 0.9)';
                ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.drawImage(this.fishFrameImage, -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
                
                const progressBarHeight = 20, progressBarY = (frameHeight / 2) + 8;
                const gradient = ctx.createLinearGradient(-frameWidth / 2, 0, frameWidth / 2, 0);
                gradient.addColorStop(0, 'red');
                gradient.addColorStop(0.5, 'yellow');
                gradient.addColorStop(1, 'lime');
                ctx.fillStyle = gradient;
                ctx.fillRect(-frameWidth / 2, progressBarY, this.catchProgressBarWidth, progressBarHeight);
            }
            
            if (this.isFishHooked && this.currentFish) {
                if(showDuringFlicker) {
                    const fishImg = this.fishImages[this.currentFish.name];
                    if (fishImg && fishImg.complete) {
                        const fishHeight = fishImg.height * 3, fishWidth = fishImg.width * 3;
                        const fishX = this.fishPosition, fishY = 0;
                        const barWidth = 128 * (this.currentHook?.playerBarWidthModifier || 1.0);
                        const barLeftEdge = this.minigameBarPosition - (barWidth / 2);
                        const barRightEdge = this.minigameBarPosition + (barWidth / 2);
                        const fishLeftEdge = this.fishPosition - (fishWidth / 2);
                        const fishRightEdge = this.fishPosition + (fishWidth / 2);
                        const isOverlapping = barLeftEdge < fishRightEdge && barRightEdge > fishLeftEdge;
                        const targetAlpha = isOverlapping ? 1.0 : 0.3;
                        ctx.globalAlpha = lerp(ctx.globalAlpha, targetAlpha, 0.7);
                        const fishRotation = Math.sin(Date.now() / 1000 * 8) * (14 * Math.PI / 180);
                        ctx.save();
                        ctx.translate(fishX, fishY);
                        ctx.rotate(fishRotation);
                        ctx.drawImage(fishImg, -fishWidth / 2, -fishHeight / 2, fishWidth, fishHeight);
                        ctx.restore();
                        ctx.globalAlpha = 1.0;
                    }
                }
            } else if (this.escapedFish) {
     if(showDuringFlicker || !isFlickering) {
        ctx.save();
        
        // ======================= POCZĄTEK ZMIAN =======================
        // Zastosuj obliczoną przezroczystość
        ctx.globalAlpha = this.escapedFish.alpha;
        // ======================== KONIEC ZMIAN =========================

        ctx.translate(this.escapedFish.x, this.escapedFish.y);
        ctx.rotate(this.escapedFish.rotation);
        ctx.scale(this.escapedFish.scaleX, 1);
        ctx.drawImage(this.escapedFish.img, -this.escapedFish.width / 2, -this.escapedFish.height / 2, this.escapedFish.width, this.escapedFish.height);
        ctx.restore();
     }
}

            if (this.isCatchComplete && this.strikeImage && this.strikeImage.complete) {
                const PULSE_SPEED = 25, PULSE_AMPLITUDE = 0.4, BASE_SCALE = 1.0, ROCKING_SPEED = 10, MAX_ROCKING_ANGLE_DEG = 25;
                const scale = BASE_SCALE + Math.sin(this.strikeAnimationTime * PULSE_SPEED) * PULSE_AMPLITUDE;
                const rotation = Math.sin(this.strikeAnimationTime * ROCKING_SPEED) * (MAX_ROCKING_ANGLE_DEG * Math.PI / 180);
                const strikeBaseWidth = this.strikeImage.width * 1.5, strikeBaseHeight = this.strikeImage.height * 1.5;
                const imgWidth = strikeBaseWidth * scale, imgHeight = strikeBaseHeight * scale;
                const xPos = (frameWidth / 2) - (strikeBaseWidth / 2) - 5, yPos = (-frameHeight / 2) + (strikeBaseHeight / 2) + 5;
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
            'weedless': { name: 'weedless', tier: 1, description: 'Reduces the chance of losing the fish.', fishPowerModifier: 1, playerBarWidthModifier: 1, playerBarSpeedModifier: 1 },
            'sharp': { name: 'sharp', tier: 3, description: 'A very sharp hook, makes fish more aggressive.', fishPowerModifier: 1.1, playerBarWidthModifier: 0.8, playerBarSpeedModifier: 1.25 },
        };
    }

     _initializeBaitData() {
        this.baitData = {
            'worm': { name: 'worm', tier: 1, description: 'A common worm. Loved by smaller fish.', chance: 65, fishChanceBonus: { 'roach': 1.2, 'perch': 1.2, 'crucian': 1.1 } },
            'bloodworm': { name: 'bloodworm', tier: 2, description: 'A delicacy for larger, predatory fish.', chance: 25, waitTimeReduction: 3000, fishChanceBonus: { 'catfish': 1.8, 'carp': 1.4, 'roach': 0.5 } },
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
            playerId,
            baitName: bait.name,
            tier: bait.tier || 0,
            startTime: Date.now(),
            startPos: { x: startPos.clickX, y: startPos.clickY }
        });
    }

    updateAndDrawDugBaitAnimations(ctx, players, cameraX, cameraY, currentZoom) {
        if (!this.tierConfig || !this.starImages) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const now = Date.now();
        const BAIT_ANIMATION_DURATION = 1200, BAIT_DISPLAY_DURATION = 3000;

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
                const baitWidth = baitImg.width * 1.4, baitHeight = baitImg.height * 1.4;
                ctx.drawImage(baitImg, currentPos.x - baitWidth / 2, currentPos.y - baitHeight / 2, baitWidth, baitHeight);
            } else {
                currentPos = targetScreenPos;
                const baitWidth = baitImg.width * 1.4, baitHeight = baitImg.height * 1.4;
                ctx.drawImage(baitImg, currentPos.x - baitWidth / 2, currentPos.y - baitHeight / 2, baitWidth, baitHeight);

                const tier = anim.tier || 0;
                const tierConfig = this.tierConfig[tier];
                const text = anim.baitName;
                
                ctx.font = tierConfig.font;
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
                const starImg = tierConfig.imageKey ? this.starImages[tierConfig.imageKey] : null;
                const padding = 4;
                const STAR_SCALE = 1.3;
                const starDrawWidth = starImg ? starImg.width * STAR_SCALE : 0;
                const textWidth = ctx.measureText(text).width;
                const totalWidth = textWidth + (starImg ? starDrawWidth + padding : 0);

                if (starImg && starImg.complete) {
                    const starX = currentPos.x - totalWidth / 2;
                    const starY = currentPos.y - 30 - starImg.height * STAR_SCALE / 2;
                    ctx.globalAlpha = textAlpha;
                    ctx.drawImage(starImg, starX, starY, starDrawWidth, starImg.height * STAR_SCALE);
                    ctx.globalAlpha = 1.0;
                }
                const textX = currentPos.x + (starImg ? (starDrawWidth + padding) / 2 : 0);
                
                ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * textAlpha})`;
                ctx.fillText(text, textX + 1, currentPos.y - 30 + 1);
                
                ctx.fillStyle = tierConfig.color.replace(', 1)', `, ${textAlpha})`);
                ctx.fillText(text, textX, currentPos.y - 30);
            }
        }
        ctx.restore();
    }
    
    _initializeFishData() {
        this.fishData = {
            'grassland': {
                'roach': {chance: 5, power: 22, minsize: 10, maxsize: 40, tier: 1, description: 'A common freshwater fish.'},
                'crucian': {chance: 30, power: 28, minsize: 15, maxsize: 45, tier: 1, description: 'Often found in slow-moving waters.'},
                'carp': {chance: 30, power: 31, minsize: 30, maxsize: 90, tier: 2, description: 'A large, strong fish.'},
                'catfish': {chance: 20, power: 38, minsize: 30, maxsize: 100, tier: 4, description: 'A bottom-dweller with characteristic whiskers.'},
                'perch': {chance: 50, power: 28, minsize: 10, maxsize: 60, tier: 1, description: 'A predatory fish with spiny fins.'},
                'longear sunfish': {chance: 20, power: 34, minsize: 6, maxsize: 15, tier: 4, description: 'A colorful and small sunfish.'},
            },
            'jurassic': {
                'roach': {chance: 40, power: 18, minsize: 15, maxsize: 40, tier: 0, description: 'A common freshwater fish.'},
                'crucian': {chance: 30, power: 22, minsize: 15, maxsize: 45, tier: 2, description: 'Often found in slow-moving waters.'},
                'carp': {chance: 30, power: 31, minsize: 30, maxsize: 90, tier: 3, description: 'A large, strong fish.'},
                'catfish': {chance: 20, power: 38, minsize: 30, maxsize: 100, tier: 4, description: 'A bottom-dweller with characteristic whiskers.'},
                'perch': {chance: 50, power: 28, minsize: 10, maxsize: 60, tier: 1, description: 'A predatory fish with spiny fins.'},
                'longear sunfish': {chance: 20, power: 34, minsize: 6, maxsize: 15, tier: 4, description: 'A colorful and small sunfish.'},
            }
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