'use strict';

class WeatherManager {
    constructor() {
        // ... (wszystkie istniejące właściwości bez zmian)
        this.fogMainImage = null;
        this.fogOverlayImage = null;
        this.drizzleImage = null;
        this.rainImage = null;
        this.splashImage = null;
        this.areAssetsLoaded = false;
        this.fogMainLayer = [];
        this.fogOverlayLayer = [];
        this.worldWidth = 0;
        this.fogMainTotalWidth = 0;
        this.fogOverlayTotalWidth = 0;
        this.FOG_MAIN_SPEED = 15;
        this.FOG_OVERLAY_SPEED = 25;
        this.FOG_MAIN_SCALE = 22;
        this.FOG_OVERLAY_SCALE = 12;
        this.currentWeather = 'clearsky';
        this.targetWeather = 'clearsky';
        this.transitionTimer = 0;
        this.transitionDuration = 10.0;
        this.targetFogAlpha = 0.08;
        this.currentFogAlpha = 0.08;
        this.drizzleDrops = [];
        this.rainDrops = [];
        this.maxDrizzleDrops = 70;
        this.maxRainDrops = 700;
        this.currentMaxDrizzle = 0;
        this.currentMaxRain = 0;
        this.DROP_SCALE = 2.8;
        this.lightningActive = false;
        this.lightningTimer = 0;
        this.lightningCooldown = 5;
        this.LIGHTNING_CHANCE_PER_SEC = 0.1;
        this.splashes = [];
        this.MAX_SPLASHES = 250;
        this.SPLASH_FRAME_WIDTH = 7;
        this.SPLASH_FRAME_HEIGHT = 7;
        this.SPLASH_FRAME_COUNT = 4;
        this.SPLASH_ANIM_DURATION = 0.36;
        this.SPLASH_SCALE = 3.5;
        this.GROUND_HIT_CHANCE = 0.4;
        
        // === NOWA WŁAŚCIWOŚĆ DO PRZECHOWYWANIA REFERENCJI ===
        this.soundManager = null;
        // =====================================================
    }


    setAssets(assets) {
    this.fogMainImage = assets.fog_main;
    this.fogOverlayImage = assets.fog;
    this.drizzleImage = assets.drizzle;
    this.rainImage = assets.rain;
    this.splashImage = assets.splash;
    
    if (this.fogMainImage?.complete && this.fogOverlayImage?.complete && this.drizzleImage?.complete && this.rainImage?.complete && this.splashImage?.complete) {
        this.areAssetsLoaded = true;
        console.log('All weather assets are set.');
        this.initializeRainDrops();
        this.initializeSplashes();
    } else {
        console.error('Provided weather assets are not fully loaded.');
    }
}

    setWeather(newWeather, transitionDuration = 10.0) {
        if (this.targetWeather === newWeather) return;
        this.currentWeather = this.targetWeather;
        this.targetWeather = newWeather;
        this.transitionDuration = transitionDuration;
        this.transitionTimer = this.transitionDuration;
        console.log(`Changing weather from ${this.currentWeather} to ${this.targetWeather} over ${transitionDuration}s`);
    }

    setTargetFogAlpha(alpha) {
        this.targetFogAlpha = alpha;
    }

     initializeFog(worldWidth, screenHeight) {
        if (!this.areAssetsLoaded) return;
        this.worldWidth = worldWidth;
        this.fogMainLayer = [];
        this.fogOverlayLayer = [];
        const fogMainScaledWidth = 64 * this.FOG_MAIN_SCALE;
        const fogMainScaledHeight = 64 * this.FOG_MAIN_SCALE;
        const fogMainCount = Math.ceil(this.worldWidth / fogMainScaledWidth) + 2;
        this.fogMainTotalWidth = fogMainCount * fogMainScaledWidth;
        for (let i = 0; i < fogMainCount; i++) {
            this.fogMainLayer.push({ x: i * fogMainScaledWidth, y: screenHeight - fogMainScaledHeight + 350, width: fogMainScaledWidth, height: fogMainScaledHeight });
        }
        const fogOverlayScaledWidth = 128 * this.FOG_OVERLAY_SCALE;
        const fogOverlayScaledHeight = 128 * this.FOG_OVERLAY_SCALE;
        const overlap = 48 * this.FOG_OVERLAY_SCALE;
        const step = fogOverlayScaledWidth - overlap;
        const fogOverlayCount = Math.ceil(this.worldWidth / step) + 2;
        this.fogOverlayTotalWidth = fogOverlayCount * step;
        for (let i = 0; i < fogOverlayCount; i++) {
            this.fogOverlayLayer.push({ x: i * step, y: screenHeight - fogOverlayScaledHeight + 350, alpha: 0.4 + Math.random() * 0.3, width: fogOverlayScaledWidth, height: fogOverlayScaledHeight });
        }
    }

    initializeRainDrops(screenWidth = 1920, screenHeight = 1080) {
        if (!this.areAssetsLoaded) return;
        this.drizzleDrops = [];
        this.rainDrops = [];
        for (let i = 0; i < this.maxDrizzleDrops; i++) {
            this.drizzleDrops.push(this.createDrizzleDrop(0, screenWidth, screenHeight, true));
        }
        for (let i = 0; i < this.maxRainDrops; i++) {
            this.rainDrops.push(this.createRainDrop(0, screenWidth, screenHeight, true));
        }
    }
    
    createDrizzleDrop(viewLeft, viewWidth, screenHeight, isInitial = false) {
    const angleRad = (30 + Math.random() * 10) * (Math.PI / 180);
    const baseSpeed = 500 + Math.random() * 200;
    return {
        img: this.drizzleImage,
        x: viewLeft + Math.random() * viewWidth,
        y: isInitial ? Math.random() * screenHeight : -Math.random() * 300,
        speedX: -Math.sin(angleRad) * baseSpeed,
        speedY: Math.cos(angleRad) * baseSpeed,
        targetSurface: Math.random() < this.GROUND_HIT_CHANCE ? 'ground' : 'water'
    };
}
    
    createRainDrop(viewLeft, viewWidth, screenHeight, isInitial = false) {
    const angleRad = (30 + Math.random() * 10) * (Math.PI / 180);
    const baseSpeed = 1200 + Math.random() * 400;
    return {
        img: this.rainImage,
        x: viewLeft + Math.random() * viewWidth,
        y: isInitial ? Math.random() * screenHeight : -Math.random() * 300,
        speedX: -Math.sin(angleRad) * baseSpeed,
        speedY: Math.cos(angleRad) * baseSpeed,
        targetSurface: Math.random() < this.GROUND_HIT_CHANCE ? 'ground' : 'water'
    };
}

    update(deltaTime, cameraX, screenWidth, screenHeight, currentZoom, waterLevelY, groundLevelY) {
        if (!this.areAssetsLoaded) return;

        if (this.targetWeather === 'rainstorm' || (this.currentWeather === 'rainstorm' && this.transitionTimer > 0)) {
            this.lightningCooldown -= deltaTime;
            if (this.lightningCooldown <= 0 && !this.lightningActive) {
                if (Math.random() < this.LIGHTNING_CHANCE_PER_SEC * deltaTime) {
                    this.triggerLightning();
                }
            }
        }
        if (this.lightningActive) {
            this.lightningTimer -= deltaTime;
            if (this.lightningTimer <= 0) {
                this.lightningActive = false;
            }
        }
        
        if (this.transitionTimer > 0) {
            this.transitionTimer -= deltaTime;
            const progress = 1 - (this.transitionTimer / this.transitionDuration);
            let targetMaxDrizzle = 0, targetMaxRain = 0;
            if (this.targetWeather === 'drizzle') targetMaxDrizzle = this.maxDrizzleDrops;
            if (this.targetWeather === 'rain') targetMaxRain = this.maxRainDrops;
            if (this.targetWeather === 'rainstorm') {
                targetMaxDrizzle = this.maxDrizzleDrops;
                targetMaxRain = this.maxRainDrops;
            }
            let startMaxDrizzle = 0, startMaxRain = 0;
            if (this.currentWeather === 'drizzle') startMaxDrizzle = this.maxDrizzleDrops;
            if (this.currentWeather === 'rain') startMaxRain = this.maxRainDrops;
            if (this.currentWeather === 'rainstorm') {
                startMaxDrizzle = this.maxDrizzleDrops;
                startMaxRain = this.maxRainDrops;
            }
            this.currentMaxDrizzle = Math.floor(lerp(startMaxDrizzle, targetMaxDrizzle, progress));
            this.currentMaxRain = Math.floor(lerp(startMaxRain, targetMaxRain, progress));
            this.currentFogAlpha = lerp(this.currentFogAlpha, this.targetFogAlpha, 0.03);
            if (this.transitionTimer <= 0) this.currentWeather = this.targetWeather;
        } else {
            this.currentFogAlpha = lerp(this.currentFogAlpha, this.targetFogAlpha, 0.03);
        }

        this.fogMainLayer.forEach(fog => {
            fog.x -= this.FOG_MAIN_SPEED * deltaTime;
            if (fog.x < -fog.width) fog.x += this.fogMainTotalWidth;
        });
        this.fogOverlayLayer.forEach(fog => {
            fog.x -= this.FOG_OVERLAY_SPEED * deltaTime;
            if (fog.x < -fog.width) fog.x += this.fogOverlayTotalWidth;
        });

        this.updateSplashes(deltaTime);
        
        const viewLeft = cameraX;
        const viewWidth = screenWidth / currentZoom;
        
        const safeGroundY = groundLevelY !== undefined ? groundLevelY : DEDICATED_GAME_HEIGHT;
        const rainDisappearY = waterLevelY !== undefined ? waterLevelY : screenHeight / currentZoom;
        
        this.updateDrops(this.drizzleDrops, this.currentMaxDrizzle, deltaTime, viewLeft, viewWidth, rainDisappearY, safeGroundY);
        this.updateDrops(this.rainDrops, this.currentMaxRain, deltaTime, viewLeft, viewWidth, rainDisappearY, safeGroundY);
    }

    updateDrops(drops, count, deltaTime, viewLeft, viewWidth, waterLevelY, groundLevelY) {
    const RESPAWN_BUFFER_X = 500;

    for (let i = 0; i < count; i++) {
        const drop = drops[i];
        if (!drop) continue;

        drop.y += drop.speedY * deltaTime;
        drop.x += drop.speedX * deltaTime;

        const disappearY = drop.targetSurface === 'ground' ? groundLevelY : waterLevelY;

        if (drop.y > disappearY) {
            this.triggerSplash(drop.x, disappearY);

            const viewTop = cameraY;
            drop.y = viewTop - Math.random() * 300; 
            drop.x = viewLeft + Math.random() * (viewWidth + RESPAWN_BUFFER_X);

            drop.targetSurface = Math.random() < this.GROUND_HIT_CHANCE ? 'ground' : 'water';
        }
    }
}

    drawFog(ctx) {
        if (!this.areAssetsLoaded || this.worldWidth === 0 || this.currentFogAlpha <= 0.01) return;
        ctx.save();
        this.fogMainLayer.forEach(fog => {
            if (this.fogMainImage?.complete) {
                ctx.globalAlpha = this.currentFogAlpha;
                ctx.drawImage(this.fogMainImage, fog.x, fog.y, fog.width, fog.height);
            }
        });
        this.fogOverlayLayer.forEach(fog => {
            if (this.fogOverlayImage?.complete) {
                ctx.globalAlpha = fog.alpha * this.currentFogAlpha;
                ctx.drawImage(this.fogOverlayImage, fog.x, fog.y, fog.width, fog.height);
            }
        });
        ctx.restore();
        this.drawSplashes(ctx);
        }
    
    drawRain(ctx) {
        if (!this.areAssetsLoaded || (this.currentMaxDrizzle === 0 && this.currentMaxRain === 0)) return;

        const rotationAngle = 45 * (Math.PI / 180);

        ctx.save();
        ctx.globalAlpha = 0.8;
        
        const drizzleWidth = this.drizzleImage.naturalWidth * this.DROP_SCALE;
        const drizzleHeight = this.drizzleImage.naturalHeight * this.DROP_SCALE;
        for (let i = 0; i < this.currentMaxDrizzle; i++) {
            const drop = this.drizzleDrops[i];
            if (!drop) continue;
            
            ctx.save();
            ctx.translate(drop.x + drizzleWidth / 2, drop.y + drizzleHeight / 2);
            ctx.rotate(rotationAngle);
            ctx.drawImage(drop.img, -drizzleWidth / 2, -drizzleHeight / 2, drizzleWidth, drizzleHeight);
            ctx.restore();
        }

        const rainWidth = this.rainImage.naturalWidth * this.DROP_SCALE;
        const rainHeight = this.rainImage.naturalHeight * this.DROP_SCALE;
        for (let i = 0; i < this.currentMaxRain; i++) {
            const drop = this.rainDrops[i];
            if (!drop) continue;
            ctx.drawImage(drop.img, drop.x, drop.y, rainWidth, rainHeight);
        }
        
        ctx.restore();
    }

    initializeSplashes() {
    this.splashes = [];
    for (let i = 0; i < this.MAX_SPLASHES; i++) {
        this.splashes.push({
            isActive: false,
            x: 0,
            y: 0,
            frame: 0,
            timer: 0,
            flipped: false
        });
    }
}

triggerSplash(x, y) {
    const splash = this.splashes.find(s => !s.isActive);
    if (splash) {
        splash.isActive = true;
        splash.x = x;
        splash.y = y;
        splash.frame = 0;
        splash.timer = 0;
        splash.flipped = Math.random() < 0.5;
    }
}

updateSplashes(deltaTime) {
    const timePerFrame = this.SPLASH_ANIM_DURATION / this.SPLASH_FRAME_COUNT;

    for (const splash of this.splashes) {
        if (splash.isActive) {
            splash.timer += deltaTime;
            if (splash.timer >= timePerFrame) {
                splash.timer -= timePerFrame;
                splash.frame++;
                if (splash.frame >= this.SPLASH_FRAME_COUNT) {
                    splash.isActive = false;
                }
            }
        }
    }
}

// ================== ZAKTUALIZOWANA METODA ==================
triggerLightning() {
    this.lightningActive = true;
    this.lightningTimer = 0.54;
    this.lightningCooldown = 2 + Math.random() * 4;

    // Sprawdź, czy soundManager jest dostępny
    if (this.soundManager) {
        // Oblicz losowe opóźnienie od 0.5s do 3s (500ms do 3000ms)
        const delay = 500 + Math.random() * 2500; 

        // Użyj setTimeout, aby zaplanować odtworzenie dźwięku
        setTimeout(() => {
            this.soundManager.playRandomThunder();
        }, delay);
    }
}
// =========================================================

drawLightning(ctx) {
    if (!this.lightningActive) return;

    const t = this.lightningTimer;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (t > 0.49) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (t > 0.20 && t <= 0.22) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (t > 0.15 && t <= 0.17) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (t > 0.12 && t <= 0.15) {
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (t > 0.10 && t <= 0.12) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (t > 0.03 && t <= 0.05) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    ctx.restore();
}

drawSplashes(ctx) {
    if (!this.splashImage || !this.splashImage.complete) return;
    
    const drawWidth = this.SPLASH_FRAME_WIDTH * this.SPLASH_SCALE;
    const drawHeight = this.SPLASH_FRAME_HEIGHT * this.SPLASH_SCALE;

    for (const splash of this.splashes) {
        if (splash.isActive) {
            const sourceX = splash.frame * this.SPLASH_FRAME_WIDTH;

            ctx.save();
            ctx.translate(splash.x, splash.y);

            if (splash.flipped) {
                ctx.scale(-1, 1);
            }

            ctx.drawImage(
                this.splashImage,
                sourceX, 0,
                this.SPLASH_FRAME_WIDTH, this.SPLASH_FRAME_HEIGHT,
                -drawWidth / 2, -drawHeight,
                drawWidth, drawHeight
            );
            ctx.restore();
        }
    }
}
}