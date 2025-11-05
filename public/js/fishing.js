function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

class ParticleManager {
    constructor() {
        this.particles = [];
        this.GRAVITY = 150; // Gravity in pixels per second^2
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
        this.soundManager = null; // <-- DODANA LINIA  
        this.activeMinigameSound = 'none'; // <-- DODANA LINIA 

        
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
        this.canPlayStrike2 = true; // <-- DODANA LINIA
    }

    _triggerFailAnimation() {
        if (!this.currentFish || this.isFailAnimationPlaying) return;

        // ======================= POCZĄTEK ZMIANY =======================
        if (this.soundManager) {
            this.soundManager.play('reelIn');
        }
        // ======================== KONIEC ZMIANY =========================

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
        hasSplashed: false,
        splashTime: 0, 
        alpha: 1       
    };

    this.isFishHooked = false;
    this.currentFish = null;
}

    abortMinigame() {
    if (!this.isFishHooked || !this.currentFish) {
        return;
    }
    if (this.soundManager) {
        this.soundManager.stopLoop('fishing');
        this.soundManager.stopLoop('catchin');  // <-- DODANA LINIA
        this.soundManager.stopLoop('catchout'); // <-- DODANA LINIA
    }
    this._triggerFailAnimation();
}
    handlePrematurePull(biomeName) {
        if (this.isWaitingForBite) {
            clearTimeout(this.biteTimeoutId);
            this.biteTimeoutId = null;
            this.isWaitingForBite = false;

            const escapedFishData = this.getRandomCatch(biomeName, this.currentBait);

            if (escapedFishData) {
                this.currentFish = escapedFishData;
                this.showFishFrame = true;
                this._triggerFailAnimation();
            } else {
                this.failFishing();
            }
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
            console.error(`Missing data for bait named: ${equippedBait.name}`);
            this.cancelFishing();
            return;
        }
        this.currentHook = this.hookData[equippedHook.name];
        if (!this.currentHook) {
            console.error(`Missing data for hook named: ${equippedHook.name}`);
            this.cancelFishing();
            return;
        }
        
        const waitTimeReduction = this.currentBait.waitTimeReduction || 0;
        
        // Long base wait time
        const baseMinWait = 15000;  // 15 seconds
        const baseMaxWait = 25000; // 25 seconds
        const baseWaitTime = baseMinWait + Math.random() * (baseMaxWait - baseMinWait);
        
        // The reduction is subtracted from the randomized base time.
        // Math.max ensures the time never drops below a minimum of 2.5 seconds.
        const totalWaitTime = Math.max(2500, baseWaitTime - waitTimeReduction);

        console.log(`Bait: ${this.currentBait.name}, Time Reduction: ${waitTimeReduction / 1000}s, Final Wait Time: ${totalWaitTime / 1000}s`);

        this.biteTimeoutId = setTimeout(() => { this.startBite(); }, totalWaitTime);
    }

    startBite() {
        this.isWaitingForBite = false;
        this.isBiting = true;
        
        // ======================= POCZĄTEK ZMIANY =======================
        if (this.soundManager) {
            this.soundManager.playStrikeSound();
        }
        // ======================== KONIEC ZMIANY ========================

        this.strikeAnimationTime = 0;
        if (this.currentBait && this.onBaitConsumedCallback) {
            this.onBaitConsumedCallback();
        }
        this.strikeTimeoutId = setTimeout(() => this.failFishing(), 4000);
    }

    playerRightClicked(biomeName) {
        if (!this.isBiting) return;

    // Wyczyść kolejkę samouczka, gdy rozpoczyna się minigra
    if (typeof timedTutorialsQueue !== 'undefined') {
        timedTutorialsQueue = [];
    }

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
        
        // ======================= POCZĄTEK ZMIANY =======================
        if (this.soundManager) {
            this.soundManager.startLoop('fishing');
        }
        // ======================== KONIEC ZMIANY ========================

        if (this.fishFrameImage) {
            const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
            this.catchProgressBarWidth = frameWidth * 0.35;
        } else {
            this.catchProgressBarWidth = 0;
        }

        this.isCatchComplete = false;
        this.isFailAnimationPlaying = false; 
        this.escapedFish = null;
    }

    cleanUpAfterCatch() {
        if (this.soundManager) {
            this.soundManager.stopLoop('fishing');
            this.soundManager.stopLoop('catchin');  // <-- DODANA LINIA
            this.soundManager.stopLoop('catchout'); // <-- DODANA LINIA
        }
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
    if (this.soundManager) {
        this.soundManager.stopStrikeSound();
        this.soundManager.stopLoop('fishing');
        this.soundManager.stopLoop('catchin');  // <-- DODANA LINIA
        this.soundManager.stopLoop('catchout'); // <-- DODANA LINIA
    }
        this.isBiting = false;
        this.showFishFrame = false;
        this.catchProgressBarWidth = 0;
        this.isCatchComplete = false;
        this.currentBait = null; 
        this.currentHook = null;
        if (this.onFishingResetCallback) this.onFishingResetCallback();
    }

    cancelFishing() {
    // Wyczyść kolejkę samouczka, gdy łowienie jest anulowane
    if (typeof timedTutorialsQueue !== 'undefined') {
        timedTutorialsQueue = [];
    }
    clearTimeout(this.biteTimeoutId);
    clearTimeout(this.strikeTimeoutId);

    if (this.soundManager) {
        this.soundManager.stopStrikeSound();
        this.soundManager.stopLoop('fishing');
        this.soundManager.stopLoop('catchin');  // <-- DODANA LINIA
        this.soundManager.stopLoop('catchout'); // <-- DODANA LINIA
    }

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
        this.activeMinigameSound = 'none';
        this.canPlayStrike2 = true; // <-- DODANA LINIA (reset flagi)
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
                // Sprawdź, czy musimy zmienić dźwięk na "catchin"
                if (this.soundManager && this.activeMinigameSound !== 'catchin') {
                    this.soundManager.stopLoop('catchout');
                    this.soundManager.startLoop('catchin');
                    this.activeMinigameSound = 'catchin';
                }
            } else {
                this.catchProgressBarWidth -= this.CATCH_PROGRESS_DECREASE_RATE * deltaTime;
                // Sprawdź, czy musimy zmienić dźwięk na "catchout"
                if (this.soundManager && this.activeMinigameSound !== 'catchout') {
                    this.soundManager.stopLoop('catchin');
                    this.soundManager.startLoop('catchout');
                    this.activeMinigameSound = 'catchout';
                }
            }
                
                this.catchProgressBarWidth = Math.max(0, Math.min(this.catchProgressBarWidth, frameWidth));
                
                this.isCatchComplete = this.catchProgressBarWidth >= frameWidth;

                if (this.isCatchComplete) {
                    // I jeśli możemy odtworzyć dźwięk (nie zrobiliśmy tego w tym "podejściu")
                    if (this.canPlayStrike2) {
                        if (this.soundManager) {
                            this.soundManager.play('strike_2');
                        }
                        // Zablokuj możliwość ponownego odtworzenia, dopóki pasek nie spadnie
                        this.canPlayStrike2 = false;
                    }
                } 
                // Jeśli PASEK NIE JEST PEŁNY
                else {
                    // Zresetuj flagę, pozwalając na ponowne odtworzenie dźwięku,
                    // gdy pasek znów się zapełni
                    this.canPlayStrike2 = true;
                }



                if (this.catchProgressBarWidth <= 0 && this.isFishHooked) {
                    this._triggerFailAnimation();
                }
            }
        }

        if (this.isFailAnimationPlaying) {
    this.failAnimationTimer += deltaTime;

    if (this.escapedFish) {
        if (this.failAnimationTimer > 0.4) {
            const GRAVITY = 800;
            this.escapedFish.velocityY += GRAVITY * deltaTime;
            this.escapedFish.y += this.escapedFish.velocityY * deltaTime;
            this.escapedFish.rotation += this.escapedFish.rotationSpeed * deltaTime;
        }

        if (bobberScreenPos && this.escapedFish.y > 0 && !this.escapedFish.hasSplashed) {
            this.escapedFish.hasSplashed = true; 
            
            this.escapedFish.splashTime = this.failAnimationTimer;

            const frameWidth = this.fishFrameImage.width * this.fishFrameScale;
            const frameBaseX = bobberScreenPos.x + 40;
            const frameCenterX = frameBaseX + frameWidth / 2;
            const splashX = frameCenterX + this.escapedFish.x;
            
            const splashWorldX = (splashX / currentZoomLevel) + cameraX;
            const splashWorldY = (bobberScreenPos.y / currentZoomLevel) + cameraY;

            this.createWaterSplash(splashWorldX, splashWorldY, 130, 1.5);
        }

        if (this.escapedFish.hasSplashed) {
            const FADE_DURATION = 0.3;
            const timeSinceSplash = this.failAnimationTimer - this.escapedFish.splashTime;
            this.escapedFish.alpha = Math.max(0, 1 - (timeSinceSplash / FADE_DURATION));
        } else {
            this.escapedFish.alpha = 1;
        }
    }

    if (this.failAnimationTimer > 2.0) {
        this.isFailAnimationPlaying = false;
        this.escapedFish = null;
        this.catchSoundPlayed = false;
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

        if (this.isFishHooked && !this.isFailAnimationPlaying) {
            const ROCKING_SPEED = 4;
            const MAX_ROCKING_ANGLE_DEG = 7;
            const rockingAngle = Math.sin(Date.now() / 1000 * ROCKING_SPEED) * (MAX_ROCKING_ANGLE_DEG * Math.PI / 180);
            ctx.rotate(rockingAngle);
        }
        
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
                    const BASE_MINIGAME_SCALE = 3;
                    const finalScale = BASE_MINIGAME_SCALE * (this.currentFish.scale || 1); 
                    const fishHeight = fishImg.height * finalScale;
                    const fishWidth = fishImg.width * finalScale;

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
                ctx.globalAlpha = this.escapedFish.alpha;
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
            'weedless': { name: 'weedless', tier: 0, description: 'Reduces the chance of losing the fish.', fishPowerModifier: 1.1, playerBarWidthModifier: 0.7, playerBarSpeedModifier: 1 },
            'beaked': { name: 'beaked', tier: 1, description: 'Makes the fish less combative.', fishPowerModifier: 0.38, playerBarWidthModifier: 0.65, playerBarSpeedModifier: 1.25 },
            'double': { name: 'double', tier: 2, description: 'Hooks deeper and prevents escape more effectively.', fishPowerModifier: 0.85, playerBarWidthModifier: 1.05, playerBarSpeedModifier: 0.75 },
            'treble': { name: 'treble', tier: 3, description: 'Ensures the strongest hook set and escape prevention.', fishPowerModifier: 0.72, playerBarWidthModifier: 1.24, playerBarSpeedModifier: 0.55 },
            'golden octopus': { name: 'golden octopus', tier: 1, description: `A multi-pronged golden hook that never lets go. A true angler's treasure`, fishPowerModifier: 1.52, playerBarWidthModifier: 1.02, playerBarSpeedModifier: 2.15 },
        };
    }

_initializeBaitData() {
    this.baitData = {
        // ================== NATURAL BAITS ==================
        'dung worm': {
            name: 'dung worm', tier: 1, description: 'A small red worm favored by many fish.', chance: 10, waitTimeReduction: 2000,
            fishChanceBonus: { 'roach': 22, 'great roach': 8, 'crucian': 24, 'great crucian': 6, 'carp': 0, 'great carp': 0, 'catfish': 0, 'great catfish': 0, 'olympic catfish': 0, 'perch': 14, 'great perch': 0, 'longear sunfish': 0, 'great longear sunfish': 0, 'rudd': 12, 'great rudd': 9, 'spined loach': 18, 'european chub': 0, 'bream': 0, 'great bream': 0, 'tench': 0, 'great tench': 0, 'common bleak': 26, 'piranha': 0, 'great piranha': 0, 'gudgeon': 40, 'barbel': 15, 'ide': 10, 'burbot': 20, 'grayling': 15 }
        },
        'worm': {
            name: 'worm', tier: 0, description: 'A common worm. Loved by smaller fish.', chance: 65, waitTimeReduction: 1000,
            fishChanceBonus: { 'roach': 33, 'great roach': 0, 'crucian': 26, 'great crucian': 0, 'carp': 0, 'great carp': 0, 'catfish': 0, 'great catfish': 0, 'olympic catfish': 0, 'perch': 18, 'great perch': 0, 'longear sunfish': 0, 'great longear sunfish': 0, 'rudd': 42, 'great rudd': 0, 'spined loach': 18, 'european chub': 0, 'bream': 0, 'great bream': 0, 'tench': 0, 'great tench': 0, 'common bleak': 15, 'piranha': 0, 'great piranha': 0, 'gudgeon': 50, 'european eel': 20, 'burbot': 25, 'silver dollar fish': 10 }
        },
        'bloodworm': {
            name: 'bloodworm', tier: 1, description: 'A delicacy for larger, predatory fish.', chance: 25, waitTimeReduction: 7000,
            fishChanceBonus: { 'roach': 30, 'great roach': 22, 'crucian': 27, 'great crucian': 0, 'carp': 0, 'great carp': 0, 'catfish': 7, 'great catfish': 0, 'olympic catfish': 0, 'perch': 19, 'great perch': 27, 'longear sunfish': 0, 'great longear sunfish': 0, 'rudd': 65, 'great rudd': 18, 'spined loach': 0, 'european chub': 0, 'bream': 0, 'great bream': 0, 'tench': 0, 'great tench': 0, 'common bleak': 0, 'piranha': 10, 'great piranha': 5, 'barbel': 30, 'grayling': 25, 'burbot': 30, 'tambaqui': 15, 'bicuda': 10 }
        },
        'maggots': {
            name: 'maggots', tier: 0, description: 'Maggots attract many small and medium fish.', chance: 55, waitTimeReduction: 1500,
            fishChanceBonus: { 'roach': 66, 'great roach': 0, 'crucian': 44, 'great crucian': 0, 'carp': 0, 'great carp': 0, 'catfish': 0, 'great catfish': 0, 'olympic catfish': 0, 'perch': 49, 'great perch': 0, 'longear sunfish': 38, 'great longear sunfish': 0, 'rudd': 33, 'great rudd': 0, 'spined loach': 22, 'european chub': 0, 'bream': 0, 'great bream': 0, 'tench': 0, 'great tench': 0, 'common bleak': 35, 'piranha': 5, 'great piranha': 0, 'gudgeon': 60, 'ide': 30, 'grayling': 20 }
        },
        'beetle larvae': {
            name: 'beetle larvae', tier: 1, description: 'Fat beetle larvae. A tasty natural bait for many freshwater species.', chance: 15, waitTimeReduction: 5000,
            fishChanceBonus: { 'roach': 0, 'great roach': 23, 'crucian': 0, 'great crucian': 44, 'carp': 0, 'great carp': 0, 'catfish': 18, 'great catfish': 0, 'olympic catfish': 0, 'perch': 0, 'great perch': 70, 'longear sunfish': 0, 'great longear sunfish': 40, 'rudd': 0, 'great rudd': 13, 'spined loach': 0, 'european chub': 20, 'bream': 19, 'great bream': 0, 'tench': 38, 'great tench': 0, 'common bleak': 0, 'piranha': 0, 'great piranha': 0, 'barbel': 40, 'ide': 35, 'european eel': 30 }
        },

        // ================== LURES (WOBBLERS, JIGS, ETC.) ==================
        'handmade jig': {
            name: 'handmade jig', waitTimeReduction: 8000, tier: 1, description: 'A handmade lure crafted from wood. Effective for experienced anglers.',
            fishChanceBonus: { 'roach': 0, 'great roach': 44, 'crucian': 0, 'great crucian': 0, 'carp': 0, 'great carp': 0, 'catfish': 20, 'great catfish': 0, 'olympic catfish': 0, 'perch': 0, 'great perch': 14, 'longear sunfish': 50, 'great longear sunfish': 80, 'rudd': 0, 'great rudd': 64, 'spined loach': 0, 'european chub': 10, 'bream': 76, 'great bream': 20, 'tench': 62, 'great tench': 44, 'common bleak': 0, 'piranha': 15, 'great piranha': 5, 'asp': 20, 'zander': 15, 'grayling': 20 }
        },
        'red chubby wobbler': {
            name: 'red chubby wobbler', waitTimeReduction: 14000, tier: 2, description: 'A bright red wobbler with a chubby body, irresistible to aggressive predators.',
            fishChanceBonus: { 'roach': 0, 'great roach': 0, 'crucian': 0, 'great crucian': 0, 'carp': 60, 'great carp': 76, 'catfish': 0, 'great catfish': 44, 'olympic catfish': 0, 'perch': 0, 'great perch': 12, 'longear sunfish': 0, 'great longear sunfish': 0, 'rudd': 0, 'great rudd': 60, 'spined loach': 0, 'european chub': 0, 'bream': 0, 'great bream': 36, 'tench': 40, 'great tench': 0, 'common bleak': 0, 'piranha': 18, 'great piranha': 12, 'northern pike': 30, 'asp': 40, 'wolf fish': 25, 'golden dorado': 20 }
        },
        'wooden two-jointed wobbler': {
            name: 'wooden two-jointed wobbler', waitTimeReduction: 12000, tier: 1, description: 'A two-jointed wooden wobbler that swims with a realistic, snake-like motion.',
            fishChanceBonus: { 'roach': 0, 'great roach': 12, 'crucian': 0, 'great crucian': 0, 'carp': 0, 'great carp': 0, 'catfish': 18, 'great catfish': 0, 'olympic catfish': 0, 'perch': 0, 'great perch': 96, 'longear sunfish': 0, 'great longear sunfish': 0, 'rudd': 0, 'great rudd': 0, 'spined loach': 0, 'european chub': 0, 'bream': 65, 'great bream': 0, 'tench': 0, 'great tench': 60, 'common bleak': 40, 'piranha': 80, 'great piranha': 40, 'northern pike': 45, 'zander': 35, 'european eel': 50, 'bicuda': 30 }
        },
        'green kavasaki wobbler': {
            name: 'green kavasaki wobbler', waitTimeReduction: 16000, tier: 2, description: 'A green Kamasaki-brand wobbler, reliable for catching various predatory fish.',
            fishChanceBonus: { 'roach': 0, 'great roach': 0, 'crucian': 0, 'great crucian': 0, 'carp': 60, 'great carp': 48, 'catfish': 30, 'great catfish': 0, 'olympic catfish': 0, 'perch': 0, 'great perch': 15, 'longear sunfish': 0, 'great longear sunfish': 0, 'rudd': 0, 'great rudd': 0, 'spined loach': 0, 'european chub': 40, 'bream': 60, 'great bream': 44, 'tench': 30, 'great tench': 40, 'common bleak': 0, 'piranha': 16, 'great piranha': 10, 'zander': 40, 'northern pike': 25, 'shovelnose tiger catfish': 20 }
        },
        'buzzbait': {
            name: 'buzzbait', waitTimeReduction: 11000, tier: 2, description: 'A rotating surface lure made for topwater strikes.',
            fishChanceBonus: { 'roach': 0, 'great roach': 10, 'crucian': 0, 'great crucian': 0, 'carp': 0, 'great carp': 0, 'catfish': 25, 'great catfish': 10, 'olympic catfish': 0, 'perch': 35, 'great perch': 20, 'longear sunfish': 40, 'great longear sunfish': 65, 'rudd': 20, 'great rudd': 35, 'spined loach': 0, 'european chub': 40, 'bream': 10, 'great bream': 5, 'tench': 0, 'great tench': 0, 'common bleak': 20, 'piranha': 40, 'great piranha': 20, 'asp': 60, 'silver arowana': 30, 'black arowana': 25 }
        },
        'high contrast wobbler': {
            name: 'high contrast wobbler', waitTimeReduction: 22000, tier: 3, description: 'A flashy wobbler with aggressive movement.',
            fishChanceBonus: { 'roach': 0, 'great roach': 5, 'crucian': 0, 'great crucian': 0, 'carp': 20, 'great carp': 15, 'catfish': 25, 'great catfish': 15, 'olympic catfish': 0, 'perch': 45, 'great perch': 30, 'longear sunfish': 0, 'great longear sunfish': 0, 'rudd': 15, 'great rudd': 25, 'spined loach': 0, 'european chub': 55, 'bream': 15, 'great bream': 5, 'tench': 0, 'great tench': 0, 'common bleak': 5, 'piranha': 30, 'great piranha': 20, 'great zander': 50, 'great northern pike': 40, 'great golden dorado': 35, 'payara': 25, 'arapaima': 10 }
        },
        'walker': {
            name: 'walker', waitTimeReduction: 9000, tier: 2, description: 'A surface lure made for side-to-side action.',
            fishChanceBonus: { 'roach': 0, 'great roach': 5, 'crucian': 0, 'great crucian': 0, 'carp': 0, 'great carp': 0, 'catfish': 15, 'great catfish': 5, 'olympic catfish': 0, 'perch': 55, 'great perch': 30, 'longear sunfish': 35, 'great longear sunfish': 50, 'rudd': 25, 'great rudd': 35, 'spined loach': 0, 'european chub': 50, 'bream': 10, 'great bream': 0, 'tench': 0, 'great tench': 0, 'common bleak': 15, 'piranha': 25, 'great piranha': 15, 'asp': 70, 'silver arowana': 40, 'black arowana': 35 }
        },
        'soft lure painted with oil': {
            name: 'soft lure painted with oil', waitTimeReduction: 6000, tier: 1, description: 'A handmade lure carved from soft wood.',
            fishChanceBonus: { 'roach': 10, 'great roach': 15, 'crucian': 5, 'great crucian': 10, 'carp': 30, 'great carp': 20, 'catfish': 20, 'great catfish': 10, 'olympic catfish': 0, 'perch': 25, 'great perch': 20, 'longear sunfish': 15, 'great longear sunfish': 25, 'rudd': 20, 'great rudd': 20, 'spined loach': 10, 'european chub': 25, 'bream': 20, 'great bream': 10, 'tench': 20, 'great tench': 15, 'common bleak': 15, 'piranha': 20, 'great piranha': 10, 'burbot': 15, 'bicuda': 20 }
        },
        'spoon': {
            name: 'spoon', waitTimeReduction: 12000, tier: 2, description: 'A shiny metal lure with wobbling action.',
            fishChanceBonus: { 'roach': 0, 'great roach': 10, 'crucian': 0, 'great crucian': 0, 'carp': 10, 'great carp': 5, 'catfish': 15, 'great catfish': 2, 'olympic catfish': 0, 'perch': 50, 'great perch': 35, 'longear sunfish': 20, 'great longear sunfish': 30, 'rudd': 20, 'great rudd': 25, 'spined loach': 0, 'european chub': 40, 'bream': 20, 'great bream': 10, 'tench': 0, 'great tench': 0, 'common bleak': 10, 'piranha': 30, 'great piranha': 15, 'northern pike': 60, 'great northern pike': 30, 'golden dorado': 40, 'wolf fish': 30 }
        },
        
        // ================== FISH-BAITS (Expanded) ==================
        'roach': {
            name: 'roach', tier: 0, description: 'A small, live fish. An excellent bait for predators.', chance: 0, waitTimeReduction: 4000,
            fishChanceBonus: { 'great perch': 40, 'great rudd': 25, 'great tench': 15, 'bream': 20, 'catfish': 20, 'carp': 10, 'great european chub': 2, 'peacock bass': 15, 'piranha': 10, 'green oscar': 10, 'northern pike': 50, 'zander': 45, 'asp': 30, 'european eel': 25 }
        },
        'crucian': {
            name: 'crucian', tier: 0, description: 'A durable and nutritious meal for large, hungry fish.', chance: 0, waitTimeReduction: 5000,
            fishChanceBonus: { 'great perch': 30, 'great rudd': 10, 'great tench': 40, 'bream': 30, 'catfish': 35, 'carp': 45, 'great european chub': 5, 'great peacock bass': 10, 'redtail catfish': 15, 'great payara': 5, 'great northern pike': 30, 'great zander': 25, 'wels catfish': 10 }
        },
        'perch': {
            name: 'perch', tier: 0, description: 'Being a small predator itself, it attracts bigger fish.', chance: 0, waitTimeReduction: 6000,
            fishChanceBonus: { 'great perch': 50, 'great rudd': 30, 'great tench': 20, 'bream': 15, 'catfish': 30, 'carp': 5, 'great european chub': 3, 'great peacock bass': 20, 'payara': 15, 'tiger oscar': 10, 'great northern pike': 40, 'great zander': 50, 'wels catfish': 15 }
        },
        'longear sunfish': {
            name: 'longear sunfish', tier: 1, description: 'Its bright colors provoke predators to attack.', chance: 0, waitTimeReduction: 7000,
            fishChanceBonus: { 'great perch': 45, 'great rudd': 40, 'bream': 10, 'catfish': 15, 'peacock bass': 40, 'tiger oscar': 25, 'northern pike': 20, 'zander': 15, 'asp': 25 }
        },
        'rudd': {
            name: 'rudd', tier: 1, description: 'A shiny and active fish, great for medium-sized predators.', chance: 0, waitTimeReduction: 5000,
            fishChanceBonus: { 'great perch': 35, 'great rudd': 50, 'bream': 25, 'catfish': 25, 'great european chub': 1, 'peacock bass': 25, 'payara': 15, 'northern pike': 40, 'zander': 35, 'asp': 30 }
        },
        'spined loach': {
            name: 'spined loach', tier: 1, description: 'A small bottom-dweller, a delicacy for catfish and perch.', chance: 0, waitTimeReduction: 4000,
            fishChanceBonus: { 'great perch': 20, 'catfish': 40, 'redtail catfish': 30, 'burbot': 50, 'european eel': 40 }
        },
        'common bleak': {
            name: 'common bleak', tier: 0, description: 'A silvery shoaling fish, ideal for medium-sized predators.', chance: 0, waitTimeReduction: 4500,
            fishChanceBonus: { 'great perch': 30, 'great rudd': 45, 'bream': 35, 'catfish': 20, 'piranha': 20, 'peacock bass': 15, 'zander': 30, 'asp': 40 }
        },
        'great perch': {
            name: 'great perch', tier: 1, description: 'A large perch, it poses a challenge and temptation for the biggest specimens.', chance: 0, waitTimeReduction: 10000,
            fishChanceBonus: { 'great carp': 20, 'great catfish': 40, 'great bream': 10, 'great peacock bass': 35, 'great payara': 20, 'redtail catfish': 25, 'great northern pike': 60, 'great zander': 70, 'wels catfish': 40, 'arapaima': 25 }
        },
        'great crucian': {
            name: 'great crucian', tier: 1, description: 'A solid meal that no giant can resist.', chance: 0, waitTimeReduction: 9000,
            fishChanceBonus: { 'great carp': 45, 'great catfish': 50, 'great bream': 30, 'great redtail catfish': 40, 'wels catfish': 50, 'arapaima': 20 }
        },
        'great roach': {
            name: 'great roach', tier: 1, description: 'A sizable roach, perfect for a large carp or catfish.', chance: 0, waitTimeReduction: 8000,
            fishChanceBonus: { 'great carp': 35, 'great catfish': 30, 'great bream': 20, 'great redtail catfish': 30, 'wels catfish': 25, 'great northern pike': 20 }
        },
        'great rudd': {
            name: 'great rudd', tier: 2, description: 'Its size and golden shine attract the largest predators.', chance: 0, waitTimeReduction: 11000,
            fishChanceBonus: { 'great carp': 15, 'great catfish': 25, 'great bream': 40, 'great peacock bass': 25, 'great payara': 20, 'great northern pike': 30, 'great zander': 25 }
        },
        'bream': {
            name: 'bream', tier: 1, description: 'Its deep body makes it an attractive target for the biggest predators.', chance: 0, waitTimeReduction: 7000,
            fishChanceBonus: { 'great catfish': 20, 'olympic catfish': 0, 'great european chub': 18, 'great piranha': 30, 'redtail catfish': 15, 'wels catfish': 20, 'great northern pike': 15 }
        },
        'tench': {
            name: 'tench', tier: 1, description: 'A tough, muscular fish that tempts powerful bottom-feeders.', chance: 0, waitTimeReduction: 7500,
            fishChanceBonus: { 'great carp': 33, 'great catfish': 19, 'great tench': 30, 'great piranha': 20, 'great redtail catfish': 15, 'wels catfish': 15 }
        },
         'piranha': {
            name: 'piranha', tier: 0, description: 'The scent of its own kind drives other predators into a frenzy.', chance: 0, waitTimeReduction: 9000,
            fishChanceBonus: { 'great piranha': 80, 'great payara': 15, 'great peacock bass': 10, 'wolf fish': 40, 'golden dorado': 30, 'arapaima': 10 }
        },
        'gudgeon': {
            name: 'gudgeon', tier: 0, description: 'A small bottom fish, perfect for eels and burbots.', chance: 0, waitTimeReduction: 3000,
            fishChanceBonus: { 'perch': 30, 'european eel': 60, 'burbot': 70, 'catfish': 20 }
        },
        'peacock bass': {
            name: 'peacock bass', tier: 1, description: 'Its aggressive nature makes it an irresistible challenge for larger predators.', chance: 0, waitTimeReduction: 8500,
            fishChanceBonus: { 'great peacock bass': 70, 'great payara': 25, 'great redtail catfish': 20, 'great catfish': 15, 'arapaima': 15, 'golden dorado': 20 }
        },
        'pacu': {
            name: 'pacu', tier: 0, description: 'A nutritious, fatty fish that attracts giant bottom-feeders.', chance: 0, waitTimeReduction: 6000,
            fishChanceBonus: { 'redtail catfish': 40, 'great redtail catfish': 25, 'great peacock bass': 15, 'great catfish': 20, 'great carp': 10, 'wels catfish': 20, 'tambaqui': 50 }
        },
        'silver dollar fish': {
            name: 'silver dollar fish', tier: 0, description: 'Its flashiness attracts visual hunters from all biomes.', chance: 0, waitTimeReduction: 4500,
            fishChanceBonus: { 'piranha': 30, 'peacock bass': 20, 'green oscar': 15, 'tiger oscar': 10, 'perch': 25, 'rudd': 20, 'european chub': 15, 'asp': 20, 'silver arowana': 30, 'bicuda': 25 }
        },
        'green oscar': {
            name: 'green oscar', tier: 1, description: 'The presence of a rival Oscar triggers territorial aggression.', chance: 0, waitTimeReduction: 7000,
            fishChanceBonus: { 'tiger oscar': 50, 'great peacock bass': 30, 'payara': 10, 'great redtail catfish': 15, 'wolf fish': 20 }
        },
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
                // ISTNIEJĄCE RYBY
                'roach': {chance: 80, power: 8, minsize: 9, maxsize: 19, scale: 0.9, tier: 0, description: 'A common freshwater fish.'},
                'great roach': {chance: 15, power: 36, minsize: 21, maxsize: 48, scale: 1.15, tier: 1, description: 'A common freshwater fish.'},
                'crucian': {chance: 40, power: 10, minsize: 13, maxsize: 26, scale: 0.85, tier: 0, description: 'Often found in slow-moving waters.'},
                'great crucian': {chance: 15, power: 48, minsize: 28, maxsize: 52, scale: 1.05, tier: 1, description: 'Often found in slow-moving waters.'},
                'carp': {chance: 15, power: 23, minsize: 28, maxsize: 52, scale: 0.95, tier: 1, description: 'A large, strong fish.'},
                'great carp': {chance: 5, power: 62, minsize: 54, maxsize: 94, scale: 1.22, tier: 2, description: 'A large, strong fish.'},
                'catfish': {chance: 24, power: 38, minsize: 34, maxsize: 56, scale: 0.87, tier: 1, description: 'A bottom-dweller with characteristic whiskers.'},
                'great catfish': {chance: 2, power: 72, minsize: 58, maxsize: 94, scale: 1.02, tier: 2, description: 'A bottom-dweller with characteristic whiskers.'},
                'olympic catfish': {chance: 0.4, power: 94, minsize: 98, maxsize: 164, scale: 1.12, tier: 3, description: 'A truly massive, legendary catfish.'},
                'perch': {chance: 50, power: 14, minsize: 11, maxsize: 26, scale: 0.85, tier: 0, description: 'A predatory fish with spiny fins.'},
                'great perch': {chance: 50, power: 45, minsize: 29, maxsize: 61, scale: 0.98, tier: 1, description: 'A predatory fish with spiny fins.'},
                'longear sunfish': {chance: 20, power: 14, minsize: 3, maxsize: 7, scale: 0.7, tier: 1, description: 'A colorful and small sunfish.'},
                'great longear sunfish': {chance: 10, power: 34, minsize: 9, maxsize: 16, scale: 0.82, tier: 2, description: 'A colorful and small sunfish.'},
                'rudd': {chance: 55, power: 18, minsize: 8, maxsize: 21, scale: 0.8, tier: 1, description: 'A small freshwater fish with red fins and golden sides.'},
                'great rudd': {chance: 15, power: 38, minsize: 34, maxsize: 37, scale: 0.93, tier: 1, description: 'A small freshwater fish with red fins and golden sides.'},
                'spined loach': {chance: 70, power: 10, minsize: 4, maxsize: 12, scale: 0.7, tier: 0, description: 'A small bottom-dweller with barbels used to search for food.'},
                'european chub': {chance: 10, power: 26, minsize: 25, maxsize: 34, scale: 1, tier: 1, description: 'A strong and adaptable river fish that feeds on almost anything.'},
                'great european chub': {chance: 7, power: 52, minsize: 37, maxsize: 64, scale: 1, tier: 2, description: 'A strong and adaptable river fish that feeds on almost anything.'},
                'bream': {chance: 8, power: 36, minsize: 17, maxsize: 38, scale: 0.9, tier: 1, description: 'A flat-bodied freshwater fish that often swims in large schools.'},
                'great bream': {chance: 2, power: 62, minsize: 43, maxsize: 81, scale: 1.12, tier: 2, description: 'A flat-bodied freshwater fish that often swims in large schools.'},
                'tench': {chance: 18, power: 28, minsize: 17, maxsize: 31, scale: 0.9, tier: 1, description: 'A sturdy bottom-dwelling fish with olive-green coloring.'},
                'great tench': {chance: 2, power: 51, minsize: 33, maxsize: 74, scale: 1.12, tier: 2, description: 'A sturdy bottom-dwelling fish with olive-green coloring.'},
                'common bleak': {chance: 70, power: 24, minsize: 8, maxsize: 27, scale: 0.82, tier: 0, description: 'A small, silver shoaling fish found in rivers and lakes.'},

                // === NOWE RYBY DLA GRASSLAND ===
                'northern pike': {chance: 8, power: 68, minsize: 50, maxsize: 100, scale: 1.1, tier: 2, description: 'An ambush predator known for its aggressive strikes.'},
                'great northern pike': {chance: 2, power: 85, minsize: 101, maxsize: 150, scale: 1.25, tier: 4, description: 'A true water wolf of immense size and power.'},
                'zander': {chance: 9, power: 65, minsize: 40, maxsize: 80, scale: 1.0, tier: 2, description: 'A light-sensitive predator, often called a pike-perch.'},
                'great zander': {chance: 2, power: 82, minsize: 81, maxsize: 120, scale: 1.15, tier: 3, description: 'A magnificent specimen of zander, a trophy for any angler.'},
                'wels catfish': {chance: 1, power: 98, minsize: 150, maxsize: 280, scale: 1.4, tier: 4, description: 'A colossal, bottom-dwelling behemoth from European rivers.'},
                'barbel': {chance: 12, power: 42, minsize: 30, maxsize: 60, scale: 0.9, tier: 1, description: 'A powerful river fish that fights with incredible strength.'},
                'ide': {chance: 25, power: 28, minsize: 25, maxsize: 45, scale: 0.95, tier: 1, description: 'Also known as the orfe, it has beautiful golden scales.'},
                'asp': {chance: 10, power: 55, minsize: 40, maxsize: 75, scale: 1.0, tier: 2, description: 'A fast and aggressive surface-feeding predator from the carp family.'},
                'european eel': {chance: 15, power: 35, minsize: 40, maxsize: 90, scale: 0.8, tier: 1, description: 'A snake-like fish that is notoriously hard to hold.'},
                'grayling': {chance: 8, power: 30, minsize: 25, maxsize: 50, scale: 0.85, tier: 2, description: 'A beautiful fish with a large, colourful dorsal fin.'},
                'burbot': {chance: 12, power: 33, minsize: 30, maxsize: 60, scale: 0.9, tier: 1, description: 'The only freshwater member of the cod family, with a single barbel on its chin.'},
                'gudgeon': {chance: 90, power: 5, minsize: 8, maxsize: 15, scale: 0.7, tier: 0, description: 'A small, common bottom-feeding fish.'},
            },
            'jurassic': {
                 // ISTNIEJĄCE RYBY
                'piranha': {chance: 30, power: 17, minsize: 16, maxsize: 36, scale: 0.9, tier: 0, description: 'A famous predatory fish from tropical rivers, often hunting in schools. '},
                'great piranha': {chance: 15, power: 46, minsize: 40, maxsize: 54, scale: 1.06, tier: 1, description: 'A famous predatory fish from tropical rivers, often hunting in schools.'},
                'peacock bass': {chance: 35, power: 26, minsize: 28, maxsize: 53, scale: 0.92, tier: 1, description: 'Brightly colored predator, popular in sport fishing.'},
                'great peacock bass': {chance: 13, power: 57, minsize: 57, maxsize: 106, scale: 1.12, tier: 2, description: 'Brightly colored predator, popular in sport fishing.'},
                'redtail catfish': {chance: 15, power: 62, minsize: 48, maxsize: 106, scale: 0.97, tier: 2, description: 'Large catfish with a striking red tail.'},
                'great redtail catfish': {chance: 5, power: 82, minsize: 111, maxsize: 162, scale: 1.32, tier: 3, description: 'A massive catfish with a striking red tail.'},
                'payara': {chance: 18, power: 62, minsize: 32, maxsize: 56, scale: 0.92, tier: 2, description: 'Known for its long fang-like teeth.'},
                'great payara': {chance: 6, power: 86, minsize: 61, maxsize: 106, scale: 1.12, tier: 3, description: 'Known for its long fang-like teeth.'},
                'pacu': {chance: 8, power: 12, minsize: 27, maxsize: 46, scale: 0.92, tier: 0, description: 'Looks like a piranha but eats mostly plants and fruits.'},
                'great pacu': {chance: 4, power: 46, minsize: 51, maxsize: 96, scale: 1.14, tier: 1, description: 'Looks like a piranha but eats mostly plants and fruits.'},
                'silver dollar fish': {chance: 50, power: 6, minsize: 4, maxsize: 17, scale: 0.87, tier: 0, description: 'Small, round, shiny schooling fish.'},
                'green oscar': {chance: 30, power: 36, minsize: 29, maxsize: 46, scale: 0.93, tier: 0, description: 'Intelligent and colorful cichlid, often kept in aquariums.'},
                'tiger oscar': {chance: 20, power: 47, minsize: 29, maxsize: 52, scale: 1.02, tier: 1, description: 'Intelligent and colorful cichlid, often kept in aquariums.'},

                // === NOWE RYBY DLA JURASSIC ===
                'arapaima': {chance: 2, power: 100, minsize: 200, maxsize: 350, scale: 1.5, tier: 5, description: 'A living fossil, one of the largest freshwater fish in the world.'},
                'silver arowana': {chance: 10, power: 58, minsize: 60, maxsize: 100, scale: 1.1, tier: 2, description: 'A prehistoric-looking surface predator that can leap out of the water.'},
                'black arowana': {chance: 5, power: 64, minsize: 70, maxsize: 110, scale: 1.15, tier: 3, description: 'A rarer and more coveted relative of the silver arowana.'},
                'golden dorado': {chance: 9, power: 70, minsize: 50, maxsize: 90, scale: 1.05, tier: 2, description: 'The "river tiger," a powerful and acrobatic golden predator.'},
                'great golden dorado': {chance: 3, power: 88, minsize: 91, maxsize: 130, scale: 1.2, tier: 3, description: 'A massive and exceptionally strong golden dorado.'},
                'wolf fish': {chance: 15, power: 50, minsize: 40, maxsize: 80, scale: 0.9, tier: 2, description: 'An aggressive, snake-headed predator with a fearsome bite.'},
                'tambaqui': {chance: 18, power: 40, minsize: 50, maxsize: 90, scale: 1.1, tier: 1, description: 'A large relative of the pacu, known for its powerful jaws used to crush seeds.'},
                'shovelnose tiger catfish': {chance: 12, power: 55, minsize: 60, maxsize: 110, scale: 1.0, tier: 2, description: 'A beautifully patterned catfish with a distinctively long, flat snout.'},
                'electric eel': {chance: 8, power: 60, minsize: 100, maxsize: 200, scale: 0.9, tier: 3, description: 'Not a true eel, this fish can generate powerful electric shocks.'},
                'freshwater stingray': {chance: 6, power: 45, minsize: 30, maxsize: 70, scale: 1.0, tier: 3, description: 'A cartilaginous bottom-dweller with a venomous tail spine.'},
                'bicuda': {chance: 20, power: 38, minsize: 30, maxsize: 60, scale: 0.85, tier: 1, description: 'A fast, slender predator with a pointed head, resembling a freshwater barracuda.'}
            }
        };
    }
    
    getFishData() { return this.fishData; }

    getRandomCatch(biomeName, currentBait) {
        const biomeFish = this.fishData[biomeName];
        if (!biomeFish) {
            console.warn(`[FishingManager] No fish data for biome: ${biomeName}`);
            return null;
        }
        if (!currentBait) {
            return null;
        }

        let availableFish = Object.entries(biomeFish).map(([name, data]) => {
            const bonus = currentBait.fishChanceBonus ? currentBait.fishChanceBonus[name] : undefined;
            
            // If the fish has a specific bonus defined for this bait
            if (bonus !== undefined) {
                return { ...data, name: name, chance: data.chance * bonus };
            }
            
            // IMPORTANT: If no specific bonus, return the fish with its original base chance
            // This allows baits like "worm" to catch fish in any biome that aren't on its bonus list.
            return { ...data, name: name };
        });

        // Filter out any fish that now have a zero or negative chance.
        availableFish = availableFish.filter(fish => fish.chance > 0);
        
        if (availableFish.length === 0) {
            return null;
        }

        const totalChanceWeight = availableFish.reduce((sum, fish) => sum + fish.chance, 0);
        if (totalChanceWeight <= 0) {
            return null;
        }

        let randomPick = Math.random() * totalChanceWeight;

        for (const fishDef of availableFish) {
            if (randomPick < fishDef.chance) {
                const caughtFish = { ...fishDef };
                const sizeCm = caughtFish.minsize + Math.random() * (caughtFish.maxsize - caughtFish.minsize);
                caughtFish.size = Math.round(sizeCm);
                return caughtFish;
            }
            randomPick -= fishDef.chance;
        }

        return null;
    }
}