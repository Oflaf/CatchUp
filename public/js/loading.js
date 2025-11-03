'use strict';

class LoadingManager {
    constructor() {
        // Główne elementy
        this.loadingOverlay = null;
        this.loadingPercentage = null;
        this.FADE_DURATION = 500;

        // Elementy do animacji postaci
        this.canvas = null;
        this.ctx = null;
        this.animationFrameId = null;
        this.characterImages = {};
        this.areImagesLoaded = false;

        // Stałe animacji skopiowane ze script.js dla niezależności
        this.playerSize = 128;
        this.animationCycleLength = 60;
        this.armRotationDegrees = 45;
        this.legRotationDegrees = 45;
        this.bodyHeadPulseAmount = Math.round(2 * (this.playerSize / 36));
        this.headRotationAngleAmount = (Math.PI / 180 * 2);
        this.headOscillationAmplitudeFactor = 0.5;
        this.originalArmPivotInImageX = Math.round(14 * (this.playerSize / 36));
        this.originalArmPivotInImageY = Math.round(15 * (this.playerSize / 36));
        this.legPivotInImageX = Math.round(14 * (this.playerSize / 36));
        this.legPivotInImageY = Math.round(27 * (this.playerSize / 36));
        this.headPivotInImageX = Math.round(16 * (this.playerSize / 32));
        this.headPivotInImageY = Math.round(16 * (this.playerSize / 32));
        this.headInitialOffsetY = 0;
        this.backArmOffsetX = Math.round(8 * (this.playerSize / 36));
        this.backLegOffsetX = Math.round(9 * (this.playerSize / 36));
        this.eyeSpriteSize = Math.round(32 * (this.playerSize / 32));
        this.eyePivotInImage = this.eyeSpriteSize / 2;
        this.LEFT_EYE_BASE_X_REL_HEAD_TL = Math.round(0 * (this.playerSize / 32));
        this.RIGHT_EYE_BASE_X_REL_HEAD_TL = Math.round(4.5 * (this.playerSize / 32));
        this.EYE_BASE_Y_REL_HEAD_TL = Math.round(0.5 * (this.playerSize / 32));

        // === NOWE STAŁE DLA WĘDKI I SPŁAWIKA ===
        this.ITEM_ROD_WIDTH = this.playerSize * 2;
        this.ITEM_ROD_HEIGHT = this.playerSize;
        this.FLOAT_SIZE = 32;
        this.ROD_TIP_OFFSET_X = this.playerSize * 1.05;
        this.ROD_TIP_OFFSET_Y = -this.playerSize * 0.26;
        this.ROPE_LENGTH = 16;
        this.BOBBER_SWING_SPEED = 4.0;
        this.BOBBER_SWING_AMPLITUDE = 0.4; // w radianach

        // Obiekt postaci na ekranie ładowania
        this.playerObject = {
            animationFrame: 0,
            direction: 1,
            isWalking: true,
            rodTip: { x: 0, y: 0 } // Przechowamy tu pozycję czubka wędki
        };

        this._createDOM();
        this._loadCharacterAssets();
    }
    
    _createDOM() {
        if (document.getElementById('loadingOverlay')) return;

        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.id = 'loadingOverlay';
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'loadingCanvas';
        this.canvas.width = this.playerSize * 2.5; // Zwiększamy canvas, by zmieścić wędkę i spławik
        this.canvas.height = this.playerSize * 2.5;
        this.ctx = this.canvas.getContext('2d');
        
        this.ctx.imageSmoothingEnabled = false;

        this.loadingPercentage = document.createElement('div');
        this.loadingPercentage.id = 'loadingPercentage';
        this.loadingPercentage.textContent = '0%';
        
        this.loadingOverlay.appendChild(this.canvas);
        this.loadingOverlay.appendChild(this.loadingPercentage);
        document.body.appendChild(this.loadingOverlay);
    }
    
    _loadCharacterAssets() {
        const paths = {
            leg: 'img/character/load/leg_load.png',
            body: 'img/character/load/body_load.png',
            arm: 'img/character/load/arm_load.png',
            head: 'img/character/load/head_load.png',
            eye: 'img/character/load/eye_load.png',
            // === NOWE OBRAZKI ===
            rod: 'img/character/load/rod_load.png',
            float: 'img/character/load/float_load.png'
        };
        const keys = Object.keys(paths);
        let loadedCount = 0;

        keys.forEach(key => {
            const img = new Image();
            img.src = paths[key];
            img.onload = () => {
                this.characterImages[key] = img;
                loadedCount++;
                if (loadedCount === keys.length) {
                    this.areImagesLoaded = true;
                }
            };
            img.onerror = () => {
                console.error(`Failed to load loading character asset: ${paths[key]}`);
                loadedCount++;
                if (loadedCount === keys.length) {
                    this.areImagesLoaded = true;
                }
            };
        });
    }
    
    _drawLoadingPlayer() {
        if (!this.areImagesLoaded) return;
        
        const p = this.playerObject;
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const progress = (p.animationFrame % this.animationCycleLength) / this.animationCycleLength;
        const sine = Math.sin(2 * progress * Math.PI);

        const bodyPulseY = -this.bodyHeadPulseAmount * Math.abs(sine);
        const armRotation = sine * (this.armRotationDegrees * (Math.PI / 180));
        const legRotation = sine * (this.legRotationDegrees * (Math.PI / 180));
        const headRotation = sine * this.headRotationAngleAmount;
        const headPulseY = Math.sin(4 * progress * Math.PI) * this.bodyHeadPulseAmount * this.headOscillationAmplitudeFactor;

        const playerX = (canvas.width / 2) - (this.playerSize / 2);
        const playerY = (canvas.height / 2) - (this.playerSize / 2);

        ctx.save();
        ctx.translate(playerX + this.playerSize / 2, playerY + this.playerSize / 2);
        ctx.scale(p.direction, 1);
        ctx.translate(-(playerX + this.playerSize / 2), -(playerY + this.playerSize / 2));

        const drawPart = (img, x, y, pivotX, pivotY, rotation, w = this.playerSize, h = this.playerSize) => {
            if (!img || !img.complete) return;
            ctx.save();
            ctx.translate(playerX + x + pivotX, playerY + y + pivotY);
            ctx.rotate(rotation);
            ctx.drawImage(img, -pivotX, -pivotY, w, h);
            ctx.restore();
        };

        drawPart(this.characterImages.leg, this.backLegOffsetX, 0, this.legPivotInImageX, this.legPivotInImageY, -legRotation);
        drawPart(this.characterImages.arm, this.backArmOffsetX, 0, this.originalArmPivotInImageX, this.originalArmPivotInImageY, -armRotation);
        drawPart(this.characterImages.leg, 0, 0, this.legPivotInImageX, this.legPivotInImageY, legRotation);
        
        if (this.characterImages.body) {
            ctx.drawImage(this.characterImages.body, playerX, playerY + bodyPulseY, this.playerSize, this.playerSize);
        }

        const headOffsetY = this.headInitialOffsetY + bodyPulseY + headPulseY;
        drawPart(this.characterImages.head, 0, headOffsetY, this.headPivotInImageX, this.headPivotInImageY, headRotation);

        if (this.characterImages.eye) {
            drawPart(this.characterImages.eye, this.LEFT_EYE_BASE_X_REL_HEAD_TL, headOffsetY + this.EYE_BASE_Y_REL_HEAD_TL, this.eyePivotInImage, this.eyePivotInImage, headRotation, this.eyeSpriteSize, this.eyeSpriteSize);
            drawPart(this.characterImages.eye, this.RIGHT_EYE_BASE_X_REL_HEAD_TL, headOffsetY + this.EYE_BASE_Y_REL_HEAD_TL, this.eyePivotInImage, this.eyePivotInImage, headRotation, this.eyeSpriteSize, this.eyeSpriteSize);
        }
        
        // === DODANY BLOK RYSUJĄCY WĘDKĘ ===
        if (this.characterImages.rod) {
             drawPart(this.characterImages.rod, 0, 0, this.originalArmPivotInImageX, this.originalArmPivotInImageY, armRotation, this.ITEM_ROD_WIDTH, this.ITEM_ROD_HEIGHT);
        }

        drawPart(this.characterImages.arm, 0, 0, this.originalArmPivotInImageX, this.originalArmPivotInImageY, armRotation);
        
        ctx.restore();

        // === OBLICZANIE POZYCJI CZUBKA WĘDKI ===
        const armPivotCanvasX = playerX + this.originalArmPivotInImageX;
        const armPivotCanvasY = playerY + this.originalArmPivotInImageY;
        
        p.rodTip.x = armPivotCanvasX + (this.ROD_TIP_OFFSET_X * Math.cos(armRotation) - this.ROD_TIP_OFFSET_Y * Math.sin(armRotation));
        p.rodTip.y = armPivotCanvasY + (this.ROD_TIP_OFFSET_X * Math.sin(armRotation) + this.ROD_TIP_OFFSET_Y * Math.cos(armRotation));
    }
    
    // === NOWA FUNKCJA DO RYSOWANIA SPŁAWIKA ===
    _drawLoadingBobber() {
        if (!this.areImagesLoaded || !this.characterImages.float) return;

        const rodTip = this.playerObject.rodTip;
        const time = Date.now() / 1000;
        
        // Prosta animacja wahadłowa
        const swingAngle = this.BOBBER_SWING_AMPLITUDE * Math.sin(time * this.BOBBER_SWING_SPEED);
        
        const bobberX = rodTip.x + Math.sin(swingAngle) * this.ROPE_LENGTH;
        const bobberY = rodTip.y + Math.cos(swingAngle) * this.ROPE_LENGTH;

        const ctx = this.ctx;
        
        // Rysuj żyłkę
        ctx.strokeStyle = '#ffffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(rodTip.x, rodTip.y);
        ctx.lineTo(bobberX, bobberY);
        ctx.stroke();

        // Rysuj spławik
        ctx.drawImage(
            this.characterImages.float,
            bobberX - this.FLOAT_SIZE / 2,
            bobberY - 22, // Rysujemy od góry spławika
            this.FLOAT_SIZE,
            this.FLOAT_SIZE * 2
        );
    }
    
    _animationLoop() {
        this.playerObject.animationFrame++;
        this._drawLoadingPlayer();
        this._drawLoadingBobber(); // Rysuj spławik po postaci
        this.animationFrameId = requestAnimationFrame(() => this._animationLoop());
    }

    show(onFadedIn) {
        this.updateProgress(0);
        this.loadingOverlay.classList.add('visible');

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this._animationLoop();

        if (typeof onFadedIn === 'function') {
            setTimeout(onFadedIn, this.FADE_DURATION);
        }
    }

    hide(onFadedOut) {
        this.loadingOverlay.classList.remove('visible');
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (typeof onFadedOut === 'function') {
            setTimeout(onFadedOut, this.FADE_DURATION);
        }
    }
    
    updateProgress(percentage) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        if (this.loadingPercentage) {
            this.loadingPercentage.textContent = `${Math.round(clampedPercentage)}%`;
        }
    }
    
    manageLoadingProcess(assetLoadFunction, onLoadingComplete) {
        this.show(() => {
            const progressCallback = (percentage) => this.updateProgress(percentage);
            const completionCallback = () => {
                this.updateProgress(100);
                setTimeout(() => {
                    this.hide(() => {
                        if (typeof onLoadingComplete === 'function') {
                            onLoadingComplete();
                        }
                    });
                }, 150);
            };
            assetLoadFunction(progressCallback, completionCallback);
        });
    }
}

const loadingManager = new LoadingManager();