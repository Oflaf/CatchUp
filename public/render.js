// Plik renderer.js - dedykowany do obsługi całego rysowania w grze.

// Stałe używane tylko przez renderer
const TILE_SIZE = 32;
const PIXEL_FONT = 'Segoe UI, monospace';
const DEFAULT_FONT_SIZE_USERNAME = 16;
const WATER_COLOR = '#4683b457';
const WORLD_WIDTH = 4000; // Potrzebne do rysowania ziemi/wody
const DEDICATED_GAME_HEIGHT = 1080;
const WATER_TOP_Y_WORLD = DEDICATED_GAME_HEIGHT - 10;
const WATER_HEIGHT_WORLD = 512;
const FISHING_LINE_SEGMENT_WIDTH = 4;
const BOBBER_VERTICAL_OSCILLATION = 4;
const BOBBER_ROTATION_OSCILLATION = 10 * (Math.PI / 180);
const ITEM_NONE = 'none';
const ITEM_ROD = 'rod';

// === GŁÓWNA FUNKCJA RENDERUJĄCA ===
function renderScene(ctx, gameState) {
    const { playersInRoom, localPlayer, currentRoom, camera, ui, biomeAssets, characterImages, characterCustomImages, customizationUIImages, exampleCustomItemPaths } = gameState;

    drawBackground(ctx, currentRoom);

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    if (currentRoom && currentRoom.gameData) {
        drawGround(ctx, currentRoom.gameData, biomeAssets, camera);
        drawWater(ctx);
    }

    for (let id in playersInRoom) {
        drawPlayer(ctx, playersInRoom[id], gameState);
    }
    
    ctx.restore();

    if (ui.isCustomizationMenuOpen) {
        // drawCustomizationMenu(ctx, gameState); // Wyłączone dla uproszczenia
    }

    if (localPlayer.isCasting) {
        drawFishingBar(ctx, localPlayer, camera, customizationUIImages);
    }
    
    for (const id in playersInRoom) {
        const player = playersInRoom[id];
        drawFishingLine(ctx, player, camera, gameState.bobberAnimationTime, characterCustomImages);
    }
}


// --- FUNKCJE POMOCNICZE RENDERERA ---

function drawBackground(ctx, currentRoom) {
    const biome = currentRoom?.gameData?.biome || 'plains';
    const backgroundColor = biome === 'jurassic' ? '#87CEEB' : '#333';
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, DEDICATED_GAME_WIDTH, DEDICATED_GAME_HEIGHT);
}

function drawGround(ctx, gameData, biomeAssets, camera) {
    const tilesImage = biomeAssets.tiles;

    if (!tilesImage || !tilesImage.complete) {
        ctx.fillStyle = 'saddlebrown';
        ctx.fillRect(0, DEDICATED_GAME_HEIGHT - gameData.groundLevel, WORLD_WIDTH, 400);
        return;
    }

    const groundTopY = DEDICATED_GAME_HEIGHT - gameData.groundLevel;
    
    const visibleWidth = DEDICATED_GAME_WIDTH / camera.zoom;
    const startTileX = Math.floor(camera.x / TILE_SIZE);
    const endTileX = Math.ceil((camera.x + visibleWidth) / TILE_SIZE);

    for (let i = startTileX; i <= endTileX; i++) {
        ctx.drawImage(tilesImage, 0, 0, TILE_SIZE, TILE_SIZE, i * TILE_SIZE, groundTopY, TILE_SIZE, TILE_SIZE);
    }
    
    for (let i = startTileX; i <= endTileX; i++) {
        ctx.drawImage(tilesImage, 0, TILE_SIZE, TILE_SIZE, TILE_SIZE, i * TILE_SIZE, groundTopY + TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    
    for (let i = startTileX; i <= endTileX; i++) {
        ctx.drawImage(tilesImage, 0, TILE_SIZE * 2, TILE_SIZE, TILE_SIZE, i * TILE_SIZE, groundTopY + (TILE_SIZE * 2), TILE_SIZE, TILE_SIZE);
    }
    
    const startFillY = groundTopY + (TILE_SIZE * 3);
    const worldBottomY = DEDICATED_GAME_HEIGHT * 2;
    
    for (let y = startFillY; y < worldBottomY; y += TILE_SIZE) {
        for (let x = startTileX; x <= endTileX; x++) {
            ctx.drawImage(tilesImage, 0, TILE_SIZE * 3, TILE_SIZE, TILE_SIZE, x * TILE_SIZE, y, TILE_SIZE, TILE_SIZE);
        }
    }
}

function drawWater(ctx) {
    ctx.fillStyle = WATER_COLOR;
    if (WATER_HEIGHT_WORLD > 0 && WATER_TOP_Y_WORLD < DEDICATED_GAME_HEIGHT) {
        ctx.fillRect(0, WATER_TOP_Y_WORLD, WORLD_WIDTH, WATER_HEIGHT_WORLD);
    }
}

function drawPlayer(ctx, p, gameState) {
    const { localPlayer, characterImages, characterCustomImages, exampleCustomItemPaths } = gameState;
    const {
        playerSize, animationCycleLength, armRotationAngle, legRotationAngle, bodyHeadPulseAmount, headRotationAngleAmount,
        headOscillationAmplitudeFactor, IDLE_ANIM_CYCLE_LENGTH, IDLE_ARM_ROTATION_ANGLE, IDLE_BODY_HEAD_PULSE_AMOUNT,
        IDLE_HEAD_ROTATION_ANGLE_AMOUNT, JUMP_BODY_TILT_ANGLE, JUMP_LEG_OPPOSITE_ROTATION_ANGLE, JUMP_LEG_WAVE_ANGLE,
        JUMP_ARM_WAVE_ANGLE, headInitialOffsetY, backLegOffsetX, legPivotInImageX, legPivotInImageY, backArmOffsetX,
        originalArmPivotInImageX, originalArmPivotInImageY, frontLegOffsetX, headPivotInImageX, headPivotInImageY,
        eyeMaxMovementRadius, LEFT_EYE_BASE_X_REL_HEAD_TL, EYE_BASE_Y_REL_HEAD_TL, eyePivotInImage, eyeSpriteSize,
        RIGHT_EYE_BASE_X_REL_HEAD_TL, frontArmOffsetX, ROD_TIP_OFFSET_X, ROD_TIP_OFFSET_Y
    } = gameState.constants;

    if (!characterImages.body) return;

    ctx.save();

    let bodyVerticalOscillationY = 0, armRotationAmount = 0, backArmRotationAmount = 0,
        legRotationAmount = 0, backLegRotationAmount = 0, headRotationAmount = 0,
        headVerticalOscillationY = 0, currentBodyTiltAngle = 0;

    const animationProgress = (p.animationFrame || 0) % animationCycleLength / animationCycleLength;
    const idleAnimationProgress = (p.idleAnimationFrame || 0) % IDLE_ANIM_CYCLE_LENGTH / IDLE_ANIM_CYCLE_LENGTH;

    let oscillationWave = 0;

    if (p.isWalking && !p.isJumping) {
        oscillationWave = Math.sin(animationProgress * Math.PI * 2);
        bodyVerticalOscillationY = Math.abs(oscillationWave) * -bodyHeadPulseAmount * p.direction;
        armRotationAmount = oscillationWave * armRotationAngle;
        backArmRotationAmount = -armRotationAmount;
        legRotationAmount = oscillationWave * legRotationAngle;
        backLegRotationAmount = -legRotationAmount;
        headRotationAmount = oscillationWave * headRotationAngleAmount;
        headVerticalOscillationY = Math.sin(animationProgress * Math.PI * 4) * (bodyHeadPulseAmount * headOscillationAmplitudeFactor);
    } else if (p.isIdle && !p.isJumping) {
        oscillationWave = Math.sin(idleAnimationProgress * Math.PI * 2);
        bodyVerticalOscillationY = Math.abs(oscillationWave) * -IDLE_BODY_HEAD_PULSE_AMOUNT;
        armRotationAmount = oscillationWave * IDLE_ARM_ROTATION_ANGLE;
        backArmRotationAmount = -armRotationAmount;
        headRotationAmount = oscillationWave * IDLE_HEAD_ROTATION_ANGLE_AMOUNT;
        headVerticalOscillationY = Math.sin(idleAnimationProgress * Math.PI * 4) * (IDLE_BODY_HEAD_PULSE_AMOUNT * headOscillationAmplitudeFactor);
    } else if (p.isJumping) {
        // Skrócona logika animacji skoku...
        currentBodyTiltAngle = JUMP_BODY_TILT_ANGLE;
    }

    ctx.translate(p.x + playerSize / 2, p.y + playerSize / 2);
    ctx.scale(p.direction, 1);
    if (p.isJumping) ctx.rotate(currentBodyTiltAngle * p.direction);
    ctx.translate(-(p.x + playerSize / 2), -(p.y + playerSize / 2));

    const drawCharacterPart = (image, offsetX, offsetY, pivotX, pivotY, angle, width = playerSize, height = playerSize) => {
        if (!image || !image.complete) return;
        ctx.save();
        ctx.translate(p.x + offsetX + pivotX, p.y + offsetY + pivotY);
        ctx.rotate(angle);
        ctx.drawImage(image, -pivotX, -pivotY, width, height);
        ctx.restore();
    };

    drawCharacterPart(characterImages.leg, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, backLegRotationAmount);
    drawCharacterPart(characterImages.arm, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, backArmRotationAmount);
    drawCharacterPart(characterImages.leg, frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, legRotationAmount);
    
    ctx.drawImage(characterImages.body, p.x, p.y + bodyVerticalOscillationY, playerSize, playerSize);

    const headRenderAbsOffsetY = headInitialOffsetY + bodyVerticalOscillationY + headVerticalOscillationY;
    drawCharacterPart(characterImages.head, 0, headRenderAbsOffsetY, headPivotInImageX, headPivotInImageY, headRotationAmount);

    let eyeShiftX_preRotation = 0, eyeShiftY_preRotation = 0;
    const mouseTarget = p.id === localPlayer.id ? localPlayer : p;
    if (mouseTarget.currentMouseX !== undefined) {
        const headWorldCenterX = p.x + headPivotInImageX;
        const headWorldCenterY = p.y + headInitialOffsetY + headPivotInImageY;
        const gazeVectorX = (mouseTarget.currentMouseX - headWorldCenterX) * p.direction;
        const gazeVectorY = mouseTarget.currentMouseY - headWorldCenterY;
        const gazeDistance = Math.sqrt(gazeVectorX ** 2 + gazeVectorY ** 2);
        if (gazeDistance > 0) {
            eyeShiftX_preRotation = (gazeVectorX / gazeDistance) * Math.min(gazeDistance, eyeMaxMovementRadius);
            eyeShiftY_preRotation = (gazeVectorY / gazeDistance) * Math.min(gazeDistance, eyeMaxMovementRadius);
        }
    }
    
    drawCharacterPart(characterImages.eye, LEFT_EYE_BASE_X_REL_HEAD_TL + eyeShiftX_preRotation, headRenderAbsOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeShiftY_preRotation, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);
    drawCharacterPart(characterImages.eye, RIGHT_EYE_BASE_X_REL_HEAD_TL + eyeShiftX_preRotation, headRenderAbsOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeShiftY_preRotation, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);
    
    const equippedItemName = p.customizations.rightHandItem;
    if (equippedItemName && equippedItemName !== ITEM_NONE) {
        const itemConfig = exampleCustomItemPaths.items[equippedItemName];
        if (itemConfig && characterCustomImages.items[equippedItemName]?.complete) {
            drawCharacterPart(characterCustomImages.items[equippedItemName], frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, armRotationAmount, itemConfig.width, itemConfig.height);
        }
    }
    drawCharacterPart(characterImages.arm, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, armRotationAmount);

    ctx.restore();

    if (p.customizations && p.customizations.rightHandItem === ITEM_ROD) {
        const armPivotWorldX = p.x + playerSize / 2, armPivotWorldY = p.y + playerSize / 2;
        const armLocalOffsetX = (frontArmOffsetX + originalArmPivotInImageX) - (playerSize / 2), armLocalOffsetY = (0 + originalArmPivotInImageY) - (playerSize / 2);
        const rotatedArmPivotX = armLocalOffsetX * Math.cos(armRotationAmount) - armLocalOffsetY * Math.sin(armRotationAmount);
        const rotatedArmPivotY = armLocalOffsetX * Math.sin(armRotationAmount) + armLocalOffsetY * Math.cos(armRotationAmount);
        const currentArmPivotWorldX = armPivotWorldX + rotatedArmPivotX * p.direction, currentArmPivotWorldY = armPivotWorldY + rotatedArmPivotY;
        const rotatedRodTipOffsetX = ROD_TIP_OFFSET_X * Math.cos(armRotationAmount) - ROD_TIP_OFFSET_Y * Math.sin(armRotationAmount);
        const rotatedRodTipOffsetY = ROD_TIP_OFFSET_X * Math.sin(armRotationAmount) + ROD_TIP_OFFSET_Y * Math.cos(armRotationAmount);
        p.rodTipWorldX = currentArmPivotWorldX + rotatedRodTipOffsetX * p.direction;
        p.rodTipWorldY = currentArmPivotWorldY + rotatedRodTipOffsetY;
        if (p.id === localPlayer.id) {
            localPlayer.rodTipWorldX = p.rodTipWorldX;
            localPlayer.rodTipWorldY = p.rodTipWorldY;
        }
    } else {
        p.rodTipWorldX = null; p.rodTipWorldY = null;
        if (p.id === localPlayer.id) {
            localPlayer.rodTipWorldX = null; localPlayer.rodTipWorldY = null;
        }
    }
    
    ctx.fillStyle = 'white';
    ctx.font = `${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.username || p.id.substring(0, 5), p.x + playerSize / 2, p.y - 10);
}

function drawFishingBar(ctx, p, camera, customizationUIImages) {
    const { FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT, playerSize } = p.constants;
    const barScreenX = (p.x - camera.x) * camera.zoom + (playerSize * camera.zoom / 2) - (FISHING_BAR_WIDTH / 2);
    const barScreenY = (p.y - camera.y) * camera.zoom - FISHING_BAR_HEIGHT - 60;
    
    if (customizationUIImages.fishingBar && customizationUIImages.sliderHandle) {
        ctx.drawImage(customizationUIImages.fishingBar, barScreenX, barScreenY, FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT);
        const handleSize = FISHING_BAR_HEIGHT + 6;
        const handleX = barScreenX + p.fishingBarSliderPosition * (FISHING_BAR_WIDTH - handleSize);
        const handleY = barScreenY - (handleSize - FISHING_BAR_HEIGHT) / 2;
        ctx.drawImage(customizationUIImages.sliderHandle, handleX, handleY, handleSize, handleSize);
    }
}

function drawFishingLine(ctx, p, camera, bobberAnimationTime, characterCustomImages) {
    if (!p.hasLineCast || p.rodTipWorldX === null || p.floatWorldX === null) return;

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    ctx.strokeStyle = '#ffffff69'; 
    ctx.lineWidth = FISHING_LINE_SEGMENT_WIDTH;
    ctx.lineCap = 'round'; 
    ctx.beginPath();
    ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
    ctx.lineTo(p.floatWorldX, p.floatWorldY);
    ctx.stroke();

    let verticalOffset = 0, rotationOffset = 0;
    if (p.lineAnchorWorldY !== null) { 
        const playerUniqueOffset = (p.id.charCodeAt(2) + p.id.charCodeAt(3)) * 0.1;
        verticalOffset = Math.sin(bobberAnimationTime + playerUniqueOffset) * BOBBER_VERTICAL_OSCILLATION;
        rotationOffset = Math.cos(bobberAnimationTime * 0.7 + playerUniqueOffset) * BOBBER_ROTATION_OSCILLATION;
    }

    const floatImage = characterCustomImages.items.float;
    if (floatImage && floatImage.complete) {
        ctx.save();
        ctx.translate(p.floatWorldX, p.floatWorldY + verticalOffset);
        ctx.rotate(rotationOffset);
        ctx.drawImage(floatImage, -floatImage.width / 2, -floatImage.height / 2, floatImage.width, floatImage.height);
        ctx.restore();
    }
    
    ctx.restore();
}
