'use strict';

class NoticeBoardManager {
    constructor() {
        this.isOpen = false;
        this.notices = [];
        this.currentNoticeIndex = 0;
        this.paperImage = null;

        this.zOrder = 'paperOnTop';
        
        this.isHovered = false;
        this.currentScale = 1.0;
        this.targetScale = 1.0;

        // Animacja przesuwania (lewo/prawo)
        this.isAnimating = false;
        this.animationProgress = 0;
        this.animationDirection = 0; 
        this.outgoingNoticeIndex = 0;
        this.ANIMATION_DURATION_SECONDS = 0.4;

        // Stan animacji zmiany warstw (góra/dół)
        this.paperOffset = { x: 0, y: 0 };
        this.imageOffset = { x: 0, y: 0 };
        this.targetPaperOffset = { x: 0, y: 0 };
        this.targetImageOffset = { x: 0, y: 0 };
        this.Z_ANIMATION_SMOOTHING = 0.15; // Współczynnik płynności animacji

        this.SWAY_ANGLE_DEGREES = 4;
        this.SWAY_SPEED = 1.5;
        
        this.MIN_SCALE = 0.8;
        this.MAX_SCALE = 1.8;
        this.ZOOM_SENSITIVITY = 0.1;
        this.SCALE_SMOOTHING = 0.1;
    }

    async loadNotices() {
        let i = 1;
        let moreFilesExist = true;
        while (moreFilesExist) {
            try {
                const response = await fetch(`notices/ad${i}.txt`);
                if (response.ok) {
                    const text = await response.text();
                    const notice = { text: text.trim().replace(/\r\n/g, '\n'), image: null };
                    try {
                        notice.image = await this.loadImagePromise(`notices/ad${i}.png`);
                    } catch (imgError) { /* Obrazek nie istnieje, co jest OK */ }
                    this.notices.push(notice);
                    i++;
                } else {
                    moreFilesExist = false;
                }
            } catch (error) {
                moreFilesExist = false;
            }
        }
        console.log(`Załadowano ${this.notices.length} ogłoszeń.`);
    }

    loadImagePromise(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    toggleUI() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
    if (this.notices.length === 0) { showNotification("Empty.", "warning"); return; }

    // ================== POCZĄTEK ZMIANY ==================
    // Oznacz tablicę w świecie gry jako "przeczytaną" przez gracza.
    if (worldNoticeBoard) {
        worldNoticeBoard.hasBeenReadByPlayer = true;
    }
    // =================== KONIEC ZMIANY ===================

    this.isOpen = true;
    this.targetScale = 1.0;
    this.currentScale = 0.8; 
    this.resetLayerState();
    soundManager.play('paper');
}

    close() {
        this.isOpen = false;
        soundManager.play('paper');
    }
    
    updateTargetOffsets() {
        const ON_TOP_OFFSET = { x: 0, y: 0 };
        const BEHIND_OFFSET = { x: 25 * this.currentScale, y: 25 * this.currentScale };

        if (this.zOrder === 'paperOnTop') {
            this.targetPaperOffset = ON_TOP_OFFSET;
            this.targetImageOffset = BEHIND_OFFSET;
        } else { // imageOnTop
            this.targetImageOffset = ON_TOP_OFFSET;
            this.targetPaperOffset = BEHIND_OFFSET;
        }
    }
    
    resetLayerState() {
        this.zOrder = 'paperOnTop';
        this.updateTargetOffsets();
        this.paperOffset = { ...this.targetPaperOffset };
        this.imageOffset = { ...this.targetImageOffset };
    }

    toggleZOrder() {
        if (!this.isOpen || this.isAnimating) return;
        
        if (this.notices[this.currentNoticeIndex]?.image) {
            this.zOrder = (this.zOrder === 'paperOnTop') ? 'imageOnTop' : 'paperOnTop';
            this.updateTargetOffsets();
            soundManager.play('paper');
        }
    }

    nextNotice() {
        if (!this.isOpen || this.notices.length <= 1 || this.isAnimating) return;
        this.resetLayerState();
        this.isAnimating = true;
        this.animationProgress = 0;
        this.animationDirection = 1;
        this.outgoingNoticeIndex = this.currentNoticeIndex;
        this.currentNoticeIndex = (this.currentNoticeIndex + 1) % this.notices.length;
        soundManager.play('paper');
    }

    previousNotice() {
        if (!this.isOpen || this.notices.length <= 1 || this.isAnimating) return;
        this.resetLayerState();
        this.isAnimating = true;
        this.animationProgress = 0;
        this.animationDirection = -1;
        this.outgoingNoticeIndex = this.currentNoticeIndex;
        this.currentNoticeIndex = (this.currentNoticeIndex - 1 + this.notices.length) % this.notices.length;
        soundManager.play('paper');
    }

    update(deltaTime) {
        if (!this.isOpen) return;
        this.currentScale += (this.targetScale - this.currentScale) * this.SCALE_SMOOTHING;

        if (this.isAnimating) {
            this.animationProgress += deltaTime / this.ANIMATION_DURATION_SECONDS;
            if (this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.isAnimating = false;
            }
        }
        
        this.updateTargetOffsets();
        const smoothing = this.Z_ANIMATION_SMOOTHING;
        this.paperOffset.x += (this.targetPaperOffset.x - this.paperOffset.x) * smoothing;
        this.paperOffset.y += (this.targetPaperOffset.y - this.paperOffset.y) * smoothing;
        this.imageOffset.x += (this.targetImageOffset.x - this.imageOffset.x) * smoothing;
        this.imageOffset.y += (this.targetImageOffset.y - this.imageOffset.y) * smoothing;
    }
    
    handleWheel(event) {
        if (!this.isOpen || !this.isHovered) return;
        event.preventDefault();
        
        const delta = event.deltaY > 0 ? -1 : 1;
        this.targetScale += delta * this.ZOOM_SENSITIVITY;
        
        this.targetScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.targetScale));
    }

    handleMouseMove(mouseX, mouseY) {
        if (!this.isOpen) {
            this.isHovered = false;
            return;
        }
        
        const paperWidth = 360 * this.currentScale;
        const paperHeight = 520 * this.currentScale;
        const x = (canvas.width - paperWidth) / 2;
        const y = (canvas.height - paperHeight) / 2;

        this.isHovered = (mouseX > x && mouseX < x + paperWidth && mouseY > y && mouseY < y + paperHeight);
    }
    
    easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

    draw(ctx) {
        if (!this.isOpen || !this.paperImage) return;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();

        if (this.isAnimating) {
            const easedProgress = this.easeOutCubic(this.animationProgress);
            const outgoingXOffset = -easedProgress * ctx.canvas.width * this.animationDirection;
            this._drawNotice(ctx, this.outgoingNoticeIndex, outgoingXOffset);
            const incomingXOffset = ctx.canvas.width * this.animationDirection * (1 - easedProgress);
            this._drawNotice(ctx, this.currentNoticeIndex, incomingXOffset);
        } else {
            this._drawNotice(ctx, this.currentNoticeIndex, 0);
        }
    }

    _drawNotice(ctx, noticeIndex, xOffset) {
        const noticeObject = this.notices[noticeIndex];
        if (!noticeObject) return;

        const time = Date.now() / 1000;
        const PAPER_BASE_WIDTH = 360;
        const PAPER_BASE_HEIGHT = 520;
        const paperWidth = PAPER_BASE_WIDTH * this.currentScale;
        const paperHeight = PAPER_BASE_HEIGHT * this.currentScale;
        
        const x = (ctx.canvas.width / 2) + xOffset;
        const y = ctx.canvas.height / 2;

        const drawLayer = (type, offset) => {
            ctx.save();
            ctx.translate(offset.x, offset.y);
            
            if (type === 'paper') {
                const swayAngle = Math.sin(time * this.SWAY_SPEED) * (this.SWAY_ANGLE_DEGREES * Math.PI / 180);
                ctx.rotate(swayAngle);
                ctx.drawImage(this.paperImage, -paperWidth / 2, -paperHeight / 2, paperWidth, paperHeight);
                this._drawWrappedText(ctx, noticeObject.text, -paperWidth / 2 + (40 * this.currentScale), -paperHeight / 2 + (45 * this.currentScale), paperWidth - (80 * this.currentScale), 18 * this.currentScale);
                ctx.fillStyle = '#414141cc';
                ctx.font = `bold ${14 * this.currentScale}px ${PIXEL_FONT}`;
                ctx.textAlign = 'center';
                if (this.notices.length > 1) {
                    ctx.fillText(`(${noticeIndex + 1} / ${this.notices.length})`, 0, paperHeight / 2 - (35 * this.currentScale));
                }
            } else if (type === 'image' && noticeObject.image) {
                const imageSwayAngle = Math.sin(time * this.SWAY_SPEED * 0.8 + 1) * ((this.SWAY_ANGLE_DEGREES * 1.5) * Math.PI / 180);
                const imgWidth = paperWidth * 0.65;
                const imgHeight = (imgWidth / noticeObject.image.width) * noticeObject.image.height;
                const imgCenterX = (paperWidth / 2) * 0.5;
                const imgCenterY = (-paperHeight / 2) * 0.6;

                ctx.translate(imgCenterX, imgCenterY);
                ctx.rotate(imageSwayAngle);
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 15 * this.currentScale;
                ctx.shadowOffsetX = 5 * this.currentScale;
                ctx.shadowOffsetY = 5 * this.currentScale;
                ctx.drawImage(noticeObject.image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
            }
            ctx.restore();
        };

        ctx.save();
        ctx.translate(x, y);

        const isCurrentlyDisplayed = (noticeIndex === this.currentNoticeIndex && !this.isAnimating);
        
        let paperDrawOffset = this.paperOffset;
        let imageDrawOffset = this.imageOffset;

        // Jeśli to nie jest aktualnie wyświetlane ogłoszenie (czyli te, które odjeżdżają/przyjeżdżają),
        // rysuj je w domyślnym stanie, bez animacji warstw.
        if (!isCurrentlyDisplayed) {
            paperDrawOffset = {x: 0, y: 0};
            imageDrawOffset = {x: 25 * this.currentScale, y: 25 * this.currentScale};
        }

        const effectiveZOrder = isCurrentlyDisplayed ? this.zOrder : 'paperOnTop';

        if (effectiveZOrder === 'paperOnTop') {
            if (noticeObject.image) drawLayer('image', imageDrawOffset);
            drawLayer('paper', paperDrawOffset);
        } else { // imageOnTop
            drawLayer('paper', paperDrawOffset);
            if (noticeObject.image) drawLayer('image', imageDrawOffset);
        }

        ctx.restore();
    }
    
    _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        ctx.font = `${14 * this.currentScale}px 'Courier New', monospace`;
        ctx.fillStyle = '#3d352e';
        ctx.textAlign = 'left';
        
        const paragraphs = text.split('\n');
        let currentY = y;

        paragraphs.forEach(paragraph => {
            const words = paragraph.split(' ');
            let line = '';
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                if (ctx.measureText(testLine).width > maxWidth && i > 0) {
                    ctx.fillText(line, x, currentY);
                    line = words[i] + ' ';
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x, currentY);
            currentY += lineHeight;
        });
    }
}