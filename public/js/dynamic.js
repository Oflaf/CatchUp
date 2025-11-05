'use strict';

class DynamicObjectManager {
    constructor(soundManager) {
        this.objects = {};
        this.images = [];
        this.soundManager = soundManager;

        // Stałe animacji
        this.SPAWN_DURATION = 0.1;
        this.SHAKE_DURATION = 0.7;
        this.SETTLE_DURATION = 0.3; // NOWA STAŁA: Czas trwania animacji ustawiania się
        this.SHAKE_INTENSITY = 4;
        this.FINAL_SCALE = 4.2;
    }

    setImages(images) {
        this.images = [null, ...Object.values(images)];
    }

    syncObjects(serverObjects, players) {
        const serverIds = new Set(serverObjects.map(o => o.id));

        for (const id in this.objects) {
            if (!serverIds.has(id)) {
                delete this.objects[id];
            }
        }

        for (const serverObj of serverObjects) {
            if (!this.objects[serverObj.id]) {
                this._createObject(serverObj, players);
            } else {
                this.objects[serverObj.id].x = serverObj.x;
                this.objects[serverObj.id].y = serverObj.y;
            }
        }
    }

    _createObject(data, players) {
        const owner = players[data.ownerId];
        if (!owner) {
            console.warn("Nie można stworzyć obiektu dynamicznego, nie znaleziono właściciela:", data.ownerId);
            return;
        }

        this.objects[data.id] = {
            ...data,
            state: 'SPAWNING',
            progress: 0,
            currentScale: 0.1,
            // === POPRAWIONA LINIA ===
            // Losowy obrót od -45 do 45 stopni (-PI/4 do PI/4 radianów)
            currentRotation: (Math.random() * (Math.PI / 2)) - (Math.PI / 4),
            // ========================
            settleStartRotation: 0, // Przygotowujemy właściwość na przyszłość
            currentX: owner.x + (playerSize / 2),
            currentY: owner.y + (playerSize / 2),
            shakeOffsetX: 0,
            shakeOffsetY: 0,
        };
        
        this.soundManager.play('itemChange');
    }

    update(deltaTime) {
        for (const id in this.objects) {
            const obj = this.objects[id];

            switch (obj.state) {
                case 'SPAWNING':
                    obj.progress += deltaTime / this.SPAWN_DURATION;
                    const easeOutProgress = 1 - Math.pow(1 - Math.min(obj.progress, 1), 3);
                    obj.currentScale = 0.1 + (this.FINAL_SCALE - 0.1) * easeOutProgress;
                    
                    const owner = playersInRoom[obj.ownerId];
                    const startX = owner ? owner.x + (playerSize / 2) : obj.x;
                    const startY = owner ? owner.y + (playerSize / 2) : obj.y;
                    
                    obj.currentX = startX + (obj.x - startX) * easeOutProgress;
                    obj.currentY = startY + (obj.y - startY) * easeOutProgress;

                    if (obj.progress >= 1) {
                        obj.progress = 0;
                        obj.state = 'SHAKING';
                    }
                    break;

                case 'SHAKING':
                    obj.progress += deltaTime / this.SHAKE_DURATION;
                    if (obj.progress >= 1) {
                        // ZMIANA: Przechodzimy do nowego stanu 'SETTLING' zamiast 'IDLE'
                        obj.state = 'SETTLING';
                        obj.progress = 0;
                        obj.settleStartRotation = obj.currentRotation; // Zapisujemy aktualną rotację
                        obj.shakeOffsetX = 0;
                        obj.shakeOffsetY = 0;
                    } else {
                        const intensity = this.SHAKE_INTENSITY * (1 - obj.progress);
                        obj.shakeOffsetX = (Math.random() - 0.5) * intensity;
                        obj.shakeOffsetY = (Math.random() - 0.5) * intensity;
                        // Aktualizujemy rotację także podczas trzęsienia
                        obj.currentRotation += (Math.random() - 0.5) * 0.1; 
                    }
                    break;

                // NOWY STAN ANIMACJI
                case 'SETTLING':
                    obj.progress += deltaTime / this.SETTLE_DURATION;
                    const settleProgress = Math.min(obj.progress, 1);
                    const easeSettle = 1 - Math.pow(1 - settleProgress, 3); // Efekt spowolnienia na końcu

                    // Płynnie interpolujemy rotację od zapisanej wartości do zera
                    obj.currentRotation = obj.settleStartRotation * (1 - easeSettle);

                    if (settleProgress >= 1) {
                        obj.state = 'IDLE';
                        obj.currentRotation = 0; // Gwarantujemy, że na końcu jest idealnie prosto
                    }
                    break;

                case 'IDLE':
                    break;
            }
        }
    }

    draw(ctx) {
        for (const id in this.objects) {
            const obj = this.objects[id];
            const img = this.images[obj.type];

            if (!img || !img.complete) continue;

            const width = img.naturalWidth * obj.currentScale;
            const height = img.naturalHeight * obj.currentScale;
            
            // POPRAWIONA LOGIKA POZYCJONOWANIA I PIVOTU
            let drawX, drawY;

            if (obj.state === 'SPAWNING') {
                // Podczas wyrzucania, środek obiektu podąża do punktu docelowego
                drawX = obj.currentX;
                drawY = obj.currentY;
                ctx.save();
                ctx.translate(drawX + obj.shakeOffsetX, drawY + obj.shakeOffsetY);
                ctx.rotate(obj.currentRotation);
                ctx.drawImage(img, -width / 2, -height / 2, width, height); // Pivot w centrum
                ctx.restore();
            } else {
                // Po wylądowaniu (SHAKING, SETTLING, IDLE), pivot jest na środku podstawy obiektu
                drawX = obj.x;
                drawY = obj.y; // 'y' to pozycja na ziemi
                ctx.save();
                ctx.translate(drawX + obj.shakeOffsetX, drawY + obj.shakeOffsetY);
                ctx.rotate(obj.currentRotation);
                ctx.drawImage(img, -width / 2, -height, width, height); // Rysuj w górę od podstawy
                ctx.restore();
            }
        }
    }
}