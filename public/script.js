const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === STAŁE ROZDZIELCZOŚCI GRY ===
const DEDICATED_GAME_WIDTH = 1920;  // Szerokość widocznego obszaru gry (viewport)
const DEDICATED_GAME_HEIGHT = 1080; // Wysokość widocznego obszaru gry (viewport)
// WORLD_WIDTH NIE JEST JUŻ STAŁĄ GLOBALNĄ, BĘDZIE DYNAMICZNIE POBIERANE Z SERWERA
let currentWorldWidth = DEDICATED_GAME_WIDTH * 2; // Domyślna szerokość świata na starcie (przed dołączeniem do pokoju)

// Ustaw wewnętrzną rozdzielczość canvasa, w której będziemy rysować
canvas.width = DEDICATED_GAME_WIDTH;
canvas.height = DEDICATED_GAME_HEIGHT;

ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.imageSmoothingEnabled = false;

// Instancja BiomeManager jest teraz inicjowana z początkową currentWorldWidth
const biomeManager = new BiomeManager(currentWorldWidth, DEDICATED_GAME_HEIGHT);

// Elementy UI
const lobbyDiv = document.getElementById('lobby');
const gameContainerDiv = document.getElementById('gameContainer');
const myUsernameSpan = document.getElementById('myUsername');
const myColorDisplay = document.getElementById('myColorDisplay');
const createRoomBtn = document.getElementById('createRoomBtn');
const newRoomNameInput = document.getElementById('newRoomName');
const roomListUl = document.getElementById('roomList');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

// Stałe gry
const playerSize = 128; // Cała postać jest 128x128px

// === Zmienione i nowe stałe dla ulepszeń ===
const animationCycleLength = 30;
const armRotationDegrees = 45;
const legRotationDegrees = 45;

const bodyHeadPulseAmount = Math.round(2 * (playerSize / 36));

const armRotationAngle = armRotationDegrees * (Math.PI / 180);
const legRotationAngle = legRotationDegrees * (Math.PI / 180);

const originalArmPivotInImageX = Math.round(14 * (playerSize / 36));
const originalArmPivotInImageY = Math.round(15 * (playerSize / 36));

const armPivotInImageX = Math.round(13 * (playerSize / 32));
const armPivotInImageY = Math.round(14 * (playerSize / 32));

const legPivotInImageX = Math.round(14 * (playerSize / 36));
const legPivotInImageY = Math.round(27 * (playerSize / 36));

const headPivotInImageX = Math.round(16 * (playerSize / 32));
const headPivotInImageY = Math.round(16 * (playerSize / 32));
const headRotationAngleAmount = (Math.PI / 180 * 2);
const headOscillationAmplitudeFactor = 0.5;
const headInitialOffsetY = 0;

const HAIR_VERTICAL_OFFSET = -Math.round(10 * (playerSize / 32));

const backArmOffsetX = Math.round(8 * (playerSize / 36));
const backLegOffsetX = Math.round(9 * (playerSize / 36));
const frontArmOffsetX = 0;
const frontLegOffsetX = 0;
// ============================================

// === NOWE STAŁE DLA OCZU ===
const eyeSpriteSize = Math.round(32 * (playerSize / 32));
const eyePivotInImage = eyeSpriteSize / 2;

const eyeMaxMovementRadius = Math.round(0.4 * (playerSize / 32));

const LEFT_EYE_BASE_X_REL_HEAD_TL = Math.round(0 * (playerSize / 32));
const RIGHT_EYE_BASE_X_REL_HEAD_TL = Math.round(4.5 * (playerSize / 32));
const EYE_BASE_Y_REL_HEAD_TL = Math.round(0.5 * (playerSize / 32));
// =============================

// === NOWE STAŁE DLA ANIMACJI SPOCZYNKOWEJ (IDLE) ===
const IDLE_ANIM_CYCLE_LENGTH = 60;
const IDLE_ARM_ROTATION_DEGREES = 8;
const IDLE_BODY_HEAD_PULSE_AMOUNT = Math.round(1.5 * (playerSize / 36));
const IDLE_HEAD_ROTATION_DEGREES = 1;
const IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR = 0.4;
const IDLE_ARM_ROTATION_ANGLE = IDLE_ARM_ROTATION_DEGREES * (Math.PI / 180);
const IDLE_HEAD_ROTATION_ANGLE_AMOUNT = IDLE_HEAD_ROTATION_DEGREES * (Math.PI / 180);
// ==================================================

// === NOWE STAŁE DLA ANIMACJI SKOKU ===
const JUMP_BODY_TILT_DEGREES = -20;
const JUMP_LEG_OPPOSITE_ROTATION_DEGREES = -120;
const JUMP_LEG_WAVE_DEGREES = 120;
const JUMP_ARM_WAVE_DEGREES = 180;
const INSECT_SCALE_FACTOR = 2.6;

const JUMP_BODY_TILT_ANGLE = JUMP_BODY_TILT_DEGREES * (Math.PI / 180);
const JUMP_LEG_OPPOSITE_ROTATION_ANGLE = JUMP_LEG_OPPOSITE_ROTATION_DEGREES * (Math.PI / 180);
const JUMP_LEG_WAVE_ANGLE = JUMP_LEG_WAVE_DEGREES * (Math.PI / 180);
const JUMP_ARM_WAVE_ANGLE = JUMP_ARM_WAVE_DEGREES * (Math.PI / 180);
// =====================================

// === NOWE STAŁE DLA ZOOMU KAMERY ===
let currentZoomLevel = 1.0;
const MIN_ZOOM = 0.735;
const MAX_ZOOM = 1.5;
const ZOOM_SENSITIVITY = 0.1;

const ITEM_NONE = 'none';
const ITEM_ROD = 'rod';
const ITEM_LANTERN = 'lantern';
// ===================================

// === NOWE STAŁE DLA WĘDKOWANIA ===
const FISHING_BAR_WIDTH = 192;
const FISHING_BAR_HEIGHT = 30;
const FISHING_SLIDER_SPEED = 0.05;
const FISHING_LINE_SEGMENT_WIDTH = 4;
const FLOAT_SIZE = Math.round(24 * (playerSize / 128));
const ROD_TIP_OFFSET_X = Math.round(136 * (playerSize / 128));
const ROD_TIP_OFFSET_Y = Math.round(-38 * (playerSize / 128));
const CASTING_POWER_MULTIPLIER = 20;
// ===================================

// === NOWE STAŁE DLA ANIMACJI SPŁAWIKA ===
const BOBBER_VERTICAL_OSCILLATION = 4;
const BOBBER_ROTATION_OSCILLATION = 10 * (Math.PI / 180);
const BOBBER_ANIMATION_SPEED = 0.05;
// =====================================


// === Ładowanie obrazków postaci i UI ===
const characterImagePaths = {
    leg: 'img/character/leg.png',
    body: 'img/character/body.png',
    arm: 'img/character/arm.png',
    head: 'img/character/head.png',
    eye: 'img/character/eye.png'
};

const customizationUIPaths = {
    frame: 'img/ui/frame.png'
};

const sliderUIPaths = {
    bar: 'img/ui/bar.png',
    sliderHandle: 'img/ui/slider.png',
    fishingBar: 'img/ui/fishingbar.png'
};

const characterImages = {};
const customizationUIImages = {};

const characterCustomImages = {
    hat: {}, hair: {}, accessories: {}, beard: {}, clothes: {}, pants: {}, shoes: {},
    items: {}
};

const exampleCustomItemPaths = {
    hat: { 'hat1': 'img/character/custom/hat/type1.png', 'hat2': 'img/character/custom/hat/type2.png', 'hat3': 'img/character/custom/hat/type3.png' },
    hair: {
        'hair1': 'img/character/custom/hair/type1.png', 'hair2': 'img/character/custom/hair/type2.png', 'hair3': 'img/character/custom/hair/type3.png',
        'hair4': 'img/character/custom/hair/type4.png', 'hair5': 'img/character/custom/hair/type5.png', 'hair6': 'img/character/custom/hair/type6.png',
        'hair7': 'img/character/custom/hair/type7.png', 'hair8': 'img/character/custom/hair/type8.png', 'hair9': 'img/character/custom/hair/type9.png',
        'hair10': 'img/character/custom/hair/type10.png', 'hair11': 'img/character/custom/hair/type11.png', 'hair12': 'img/character/custom/hair/type12.png',
        'hair13': 'img/character/custom/hair/type13.png', 'hair14': 'img/character/custom/hair/type14.png', 'hair15': 'img/character/custom/hair/type15.png',
        'hair16': 'img/character/custom/hair/type16.png','hair20': 'img/character/custom/hair/type20.png'
    },
    accessories: { 'glasses': 'img/character/custom/accessories/type1.png', 'scarf': 'img/character/custom/accessories/type2.png' },
    beard: { 'beard1': 'img/character/custom/beard/type1.png' },
    clothes: { 'shirt1': 'img/character/custom/clothes/type1.png', 'shirt2': 'img/character/custom/clothes/type2.png' },
    pants: { 'pants1': 'img/character/custom/pants/type1.png' },
    shoes: { 'shoes1': 'img/character/custom/shoes/type1.png' },
    items: {
        'rod': {
            path: 'img/item/rod.png',
            width: playerSize * 2,
            height: playerSize,
            pivotX_in_img: Math.round(20 * (playerSize / 128)),
            pivotY_in_round: (20 * (playerSize / 128))
        },
        'lantern': {
            path: 'img/item/lantern.png',
            width: playerSize,
            height: playerSize,
            pivotX_in_img: playerSize / 2,
            pivotY_in_img: playerSize / 2
        },
        'float': {
            path: 'img/item/float.png',
            width: 32,
            height: 62,
            pivotX_in_img: FLOAT_SIZE / 2,
            pivotY_in_img: FLOAT_SIZE / 2
        }
    }
};

let totalImagesToLoad = 0;
function loadImages(callback) {
    const allPaths = { ...characterImagePaths, ...customizationUIPaths, ...sliderUIPaths };

    totalImagesToLoad = 0;

    totalImagesToLoad += Object.keys(allPaths).length;

    for (const itemName in exampleCustomItemPaths.items) {
        totalImagesToLoad++;
    }

    for (const category in exampleCustomItemPaths) {
        if (category === 'items') continue;
        for (const itemName in exampleCustomItemPaths[category]) {
            totalImagesToLoad++;
        }
    }

    if (totalImagesToLoad === 0) {
        biomeManager.loadBiomeImages(callback);
        return;
    }

    let loadedCountForThisFunction = 0;

    const onImageLoadOrError = (imgSrc) => {
        loadedCountForThisFunction++;
        if (loadedCountForThisFunction === totalImagesToLoad) {
            biomeManager.loadBiomeImages(() => {
                callback();
            });
        }
    };

    for (const key in allPaths) {
        const img = new Image();
        img.src = allPaths[key];
        img.onload = () => {
            if (characterImagePaths[key]) {
                characterImages[key] = img;
            } else if (customizationUIPaths[key] || sliderUIPaths[key]) {
                customizationUIImages[key] = img;
            }
            onImageLoadOrError(img.src);
        };
        img.onerror = () => {
            console.error(`Błąd ładowania obrazu: ${img.src}`);
            onImageLoadOrError(img.src);
        };
    }

    for (const category in exampleCustomItemPaths) {
        if (category === 'items') continue;
        const categoryPaths = exampleCustomItemPaths[category];
        for (const itemName in categoryPaths) {
            const path = categoryPaths[itemName];
            const img = new Image();
            img.src = path;
            img.onload = () => {
                if (!characterCustomImages[category]) {
                    characterCustomImages[category] = {};
                }
                characterCustomImages[category][itemName] = img;
                onImageLoadOrError(img.src);
            };
            img.onerror = () => {
                console.error(`Błąd ładowania obrazu personalizacji (${category}/${itemName}): ${img.src}`);
                if (!characterCustomImages[category]) {
                    characterCustomImages[category] = {};
                }
                characterCustomImages[category][itemName] = null;
                onImageLoadOrError(img.src);
            };
        }
    }

    const itemPathsToLoad = exampleCustomItemPaths.items;
    for (const itemName in itemPathsToLoad) {
        const itemData = itemPathsToLoad[itemName];
        const img = new Image();
        img.src = itemData.path;
        img.onload = () => {
            characterCustomImages.items[itemName] = img;
            onImageLoadOrError(img.src);
        };
        img.onerror = () => {
            console.error(`Błąd ładowania obrazu przedmiotu: ${img.src}`);
            onImageLoadOrError(img.src);
        };
    }
}
// ======================================


// Zmienne stanu gry
let localPlayer = {
    id: null,
    username: '',
    color: 'red',
    x: 50,
    y: DEDICATED_GAME_HEIGHT - 50 - playerSize,
    isJumping: false,
    velocityY: 0,
    isWalking: false,
    isIdle: false,
    animationFrame: 0,
    idleAnimationFrame: 0,
    direction: 1,
    velocityX: 0,
    currentMouseX: undefined,
    currentMouseY: undefined,
    customizations: {
        hat: 'none', hair: 'none', accessories: 'none', beard: 'none', clothes: 'none', pants: 'none', shoes: 'none',
        rightHandItem: ITEM_NONE,
        hairSaturation: 100, hairHue: 0, hairBrightness: 100,
        beardSaturation: 100, beardHue: 0, beardBrightness: 100
    },
    isCasting: false,
    castingPower: 0,
    fishingBarSliderPosition: 0,
    fishingBarTime: 0,
    castingDirectionAngle: 0,
    hasLineCast: false,
    floatWorldX: null,
    floatWorldY: null,
    rodTipWorldX: null,
    rodTipWorldY: null,
    lineAnchorWorldY: null,
};

let playersInRoom = {};
let insectsInRoom = []; // NOWA ZMIENNA DLA INSEKTÓW
let currentRoom = null;
let keys = {};
let bobberAnimationTime = 0;

// === Zmienne pozycji kamery ===
let cameraX = 0;
let cameraY = 0;
// ====================================

// NEW: Stan menu personalizacji
let isCustomizationMenuOpen = false;
const customizationCategories = [
    'hat',
    'hair',
    'accessories',
    'beard',
    'clothes',
    'pants',
    'shoes'
];
let selectedCategoryIndex = 0;

let localPlayerCustomizations = {
    hat: 'none', hair: 'none', accessories: 'none', beard: 'none', clothes: 'none', pants: 'none', shoes: 'none',
    rightHandItem: ITEM_NONE,
    hairSaturation: 100, hairHue: 0, hairBrightness: 100,
    beardSaturation: 100, beardHue: 0, beardBrightness: 100
};


const customizationOptions = {
    hat: ['none', 'hat1', 'hat2', 'hat3'],
    hair: ['none', 'hair1', 'hair2', 'hair3', 'hair4', 'hair5', 'hair6', 'hair7', 'hair8', 'hair9', 'hair10', 'hair11', 'hair12', 'hair13', 'hair14', 'hair15', 'hair16', 'hair17', 'hair18', 'hair19', 'hair20'],
    accessories: ['none', 'glasses', 'scarf'],
    beard: ['none', 'beard1'],
    clothes: ['none', 'shirt1', 'shirt2'],
    pants: ['none', 'pants1'],
    shoes: ['none', 'shoes1']
};

let currentCustomizationOptionIndices = {
    hat: 0,
    hair: 0,
    accessories: 0,
    beard: 0,
    clothes: 0,
    pants: 0,
    shoes: 0
};

const MENU_WIDTH = 150;
const MENU_TEXT_COLOR = 'white';
const MENU_HIGHLIGHT_COLOR = 'yellow';
const MENU_ITEM_HEIGHT = 40;

const MENU_X_OFFSET_FROM_PLAYER = 20;
const MENU_Y_OFFSET_FROM_PLAYER_TOP_CENTER_SELECTED = -40;

const ROLLER_VISIBLE_COUNT = 3;
const ROLLER_ITEM_VERTICAL_SPACING = MENU_ITEM_HEIGHT * 1.2;
const ROLLER_DIMMED_SCALE = 0.7;
const ROLLER_DIMMED_ALPHA = 0.3;

const FRAME_SIZE = 186;
const FRAME_OFFSET_X_FROM_MENU_TEXT = 30;
const FRAME_OSCILLATION_SPEED = 0.05;
const FRAME_ROTATION_DEGREES = 5;

let frameOscillationTime = 0;

const PIXEL_FONT = 'Segoe UI, monospace';
const DEFAULT_FONT_SIZE_USERNAME = 16;
const DEFAULT_FONT_SIZE_MENU = 24;

const SLIDER_WIDTH = 256;
const SLIDER_HEIGHT = 16;
const SLIDER_HANDLE_SIZE = 36;

const SLIDER_HANDLE_HITBOX_EXTEND = 50;

const SLIDER_OFFSET_FROM_MENU_X = MENU_WIDTH + FRAME_OFFSET_X_FROM_MENU_TEXT + FRAME_SIZE + 20;
const SLIDER_ITEM_VERTICAL_SPACING = 64;

const HAIR_SATURATION_MIN = 0;
const HAIR_SATURATION_MAX = 200;
const HAIR_BRIGHTNESS_MIN = 40;
const HAIR_BRIGHTNESS_MAX = 200;
const HAIR_HUE_MIN = 0;
const HAIR_HUE_MAX = 360;

const BEARD_SATURATION_MIN = 0;
const BEARD_SATURATION_MAX = 200;
const BEARD_BRIGHTNESS_MIN = 40;
const BEARD_BRIGHTNESS_MAX = 200;
const BEARD_HUE_MIN = 0;
const BEARD_HUE_MAX = 360;

let currentSliderBounds = [];
let draggingSlider = null;

// NEW: Zmienna do śledzenia czasu dla deltaTime
let lastTime = 0;

// --- Funkcje rysowania ---

function updateCamera() {
    const playerWorldCenterX = localPlayer.x + playerSize / 2;
    const playerWorldCenterY = localPlayer.y + playerSize / 2;

    const visibleWorldWidth = DEDICATED_GAME_WIDTH / currentZoomLevel;
    biomeManager.drawParallaxBackground(ctx, cameraX, visibleWorldWidth);
    // ===============================================

    if (currentRoom && currentRoom.gameData && currentRoom.gameData.biome) {
        const biomeName = currentRoom.gameData.biome;
        const groundLevel = currentRoom.gameData.groundLevel;

        // KROK 1: Dalsze warstwy ziemi
        biomeManager.drawBackgroundBiomeGround(ctx, biomeName, groundLevel);

        // KROK 2: Drzewa w tle
        biomeManager.drawBackgroundTrees(ctx);

        // KROK 3: Rośliny naziemne w tle
        biomeManager.drawBackgroundPlants(ctx);

        // KROK 4: Wierzchnia warstwa ziemi
        biomeManager.drawForegroundBiomeGround(ctx, biomeName, groundLevel);

        // KROK 5: Budynki
        biomeManager.drawBuildings(ctx, groundLevel, cameraX, DEDICATED_GAME_WIDTH / currentZoomLevel);
    }
    const visibleWorldHeight = DEDICATED_GAME_HEIGHT / currentZoomLevel;

    let targetCameraX = playerWorldCenterX - visibleWorldWidth / 2;
    if (targetCameraX < 0) {
        targetCameraX = 0;
    }
    // ZMIANA: Użycie currentWorldWidth zamiast stałej WORLD_WIDTH
    if (targetCameraX > currentWorldWidth - visibleWorldWidth) {
        targetCameraX = currentWorldWidth - visibleWorldWidth;
    }
    // ZMIANA: Użycie currentWorldWidth zamiast stałej WORLD_WIDTH
    if (currentWorldWidth < visibleWorldWidth) {
        targetCameraX = (currentWorldWidth / 2) - (visibleWorldWidth / 2);
    }

    let targetCameraY = playerWorldCenterY - visibleWorldHeight / 2;
    if (targetCameraY < 0) {
        targetCameraY = 0;
    }
    if (targetCameraY > DEDICATED_GAME_HEIGHT - visibleWorldHeight) {
        targetCameraY = DEDICATED_GAME_HEIGHT - visibleWorldHeight;
    }
    if (DEDICATED_GAME_HEIGHT < visibleWorldHeight) {
        targetCameraY = (DEDICATED_GAME_HEIGHT / 2) - (visibleWorldHeight / 2);
    }

    cameraX = targetCameraX;
    cameraY = targetCameraY * 1.2;
}

// NOWA FUNKCJA: Rysuje część postaci z możliwością zastosowania filtrów CSS
function drawFilteredCharacterPart(context, image, drawX, drawY, width, height, saturation = 100, hue = 0, brightness = 100) {
    if (!image || !image.complete) return;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.imageSmoothingEnabled = false;

    offscreenCtx.drawImage(image, 0, 0, width, height);

    const filters = [];
    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
    if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);

    if (filters.length > 0) {
        context.save();
        context.filter = filters.join(' ');
        context.drawImage(offscreenCanvas, drawX, drawY, width, height);
        context.restore();
    } else {
        context.drawImage(offscreenCanvas, drawX, drawY, width, height);
    }
}


function drawPlayer(p) {
    if (!characterImages.body || !characterImages.body.complete) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, playerSize, playerSize);
        return;
    }

    ctx.save();

    let bodyVerticalOscillationY = 0;
    let armRotationAmount = 0;
    let backArmRotationAmount = 0;
    let legRotationAmount = 0;
    let backLegRotationAmount = 0;
    let headRotationAmount = 0;
    let headVerticalOscillationY = 0;

    let currentBodyTiltAngle = 0;

    const animationProgress = (Number(p.animationFrame || 0) % animationCycleLength) / animationCycleLength;
    const idleAnimationProgress = (Number(p.idleAnimationFrame || 0) % IDLE_ANIM_CYCLE_LENGTH) / IDLE_ANIM_CYCLE_LENGTH;

    const playerIsWalking = p.isWalking === true;
    const playerIsIdle = p.isIdle === true;
    const playerIsJumping = p.isJumping === true;

    let oscillationWave = 0;

    const characterRootX = p.x;
    const characterRootY = p.y;

    let eyeShiftX_preRotation = 0;
    let eyeShiftY_preRotation = 0;

    const neutralHeadY_relToPlayerTop = headInitialOffsetY;
    const neutralHeadCenterY_relToPlayerTop = neutralHeadY_relToPlayerTop + headPivotInImageY;

    if (p.id === localPlayer.id && localPlayer.currentMouseX !== undefined) {
        const mouseWorldX = localPlayer.currentMouseX;
        const mouseWorldY = localPlayer.currentMouseY;

        const headWorldCenterX = characterRootX + headPivotInImageX;
        const headWorldCenterY = characterRootY + neutralHeadCenterY_relToPlayerTop;

        const gazeVectorX_relativeToHead_inPlayerSpace = (mouseWorldX - headWorldCenterX) * p.direction;
        const gazeVectorY_relativeToHead_inPlayerSpace = (mouseWorldY - headWorldCenterY);

        const gazeDistance = Math.sqrt(gazeVectorX_relativeToHead_inPlayerSpace * gazeVectorX_relativeToHead_inPlayerSpace + gazeVectorY_relativeToHead_inPlayerSpace * gazeVectorY_relativeToHead_inPlayerSpace);

        if (gazeDistance > 0) {
            const gazeNormX = gazeVectorX_relativeToHead_inPlayerSpace / gazeDistance;
            const gazeNormY = gazeVectorY_relativeToHead_inPlayerSpace / gazeDistance;

            eyeShiftX_preRotation = gazeNormX * Math.min(gazeDistance, eyeMaxMovementRadius);
            eyeShiftY_preRotation = gazeNormY * Math.min(gazeDistance, eyeMaxMovementRadius);
        }
    }

    if (playerIsWalking && !playerIsJumping) {
        oscillationWave = Math.sin(animationProgress * Math.PI * 2);

        bodyVerticalOscillationY = Math.abs(oscillationWave) * -bodyHeadPulseAmount;
        armRotationAmount = oscillationWave * armRotationAngle;
        backArmRotationAmount = -armRotationAmount;
        legRotationAmount = oscillationWave * legRotationAngle;
        backLegRotationAmount = -legRotationAmount;
        headRotationAmount = oscillationWave * headRotationAngleAmount;
        headVerticalOscillationY = Math.sin(animationProgress * Math.PI * 4) * (bodyHeadPulseAmount * headOscillationAmplitudeFactor);
    } else if (playerIsIdle && !playerIsJumping) {
        oscillationWave = Math.sin(idleAnimationProgress * Math.PI * 2);

        bodyVerticalOscillationY = Math.abs(oscillationWave) * -IDLE_BODY_HEAD_PULSE_AMOUNT;
        armRotationAmount = oscillationWave * IDLE_ARM_ROTATION_ANGLE;
        backArmRotationAmount = -armRotationAmount;
        legRotationAmount = 0;
        backLegRotationAmount = 0;
        headRotationAmount = oscillationWave * IDLE_HEAD_ROTATION_ANGLE_AMOUNT;
        headVerticalOscillationY = Math.sin(idleAnimationProgress * Math.PI * 4) * (IDLE_BODY_HEAD_PULSE_AMOUNT * IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR);
    } else if (playerIsJumping) {
        const absJumpStrength = Math.abs(18); // Assuming 18 is a typical jump strength
        const maxFallSpeedEstimate = absJumpStrength * 3; // Rough estimate for maximum fall speed

        if (p.velocityY > 0) { // Moving upwards
            const progressFromStartToApex = Math.min(1, Math.max(0, p.velocityY / absJumpStrength));
            currentBodyTiltAngle = (1 - progressFromStartToApex) * JUMP_BODY_TILT_ANGLE;
        } else { // Moving downwards
            const progressFromApexToGround = Math.min(1, Math.max(0, Math.abs(p.velocityY) / maxFallSpeedEstimate));
            currentBodyTiltAngle = JUMP_BODY_TILT_ANGLE * (1 - progressFromApexToGround);
        }

        const currentAbsVelocityY = Math.abs(p.velocityY);
        const maxRelevantVelocityY = Math.max(absJumpStrength, maxFallSpeedEstimate);
        const animWaveStrength = Math.min(1, currentAbsVelocityY / maxRelevantVelocityY);

        legRotationAmount = -animWaveStrength * JUMP_LEG_OPPOSITE_ROTATION_ANGLE;
        backLegRotationAmount = animWaveStrength * JUMP_LEG_WAVE_ANGLE;
        armRotationAmount = animWaveStrength * JUMP_ARM_WAVE_ANGLE;
        backArmRotationAmount = -animWaveStrength * JUMP_ARM_WAVE_ANGLE * 0.7;

        headRotationAmount = currentBodyTiltAngle * 0.5;
        headVerticalOscillationY = 0;
        bodyVerticalOscillationY = 0;
    }

    ctx.translate(characterRootX + playerSize / 2, characterRootY + playerSize / 2);
    ctx.scale(p.direction, 1);
    if (playerIsJumping) {
        ctx.rotate(currentBodyTiltAngle * p.direction);
    }
    ctx.translate(-(characterRootX + playerSize / 2), -(characterRootY + playerSize / 2));

    function drawCharacterPart(image, offsetX, offsetY, pivotX_in_image, pivotY_in_image, angle = 0, width = playerSize, height = playerSize) {
        if (!image || !image.complete) return;
        ctx.save();
        const drawActualX = characterRootX + offsetX;
        const drawActualY = characterRootY + offsetY;
        ctx.translate(drawActualX + pivotX_in_image, drawActualY + pivotY_in_image);
        ctx.rotate(angle);
        ctx.drawImage(image, -pivotX_in_image, -pivotY_in_image, width, height);
        ctx.restore();
    }

    drawCharacterPart(characterImages.leg, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, backLegRotationAmount);
    drawCharacterPart(characterImages.arm, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, backArmRotationAmount);
    drawCharacterPart(characterImages.leg, frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, legRotationAmount);

    ctx.drawImage(characterImages.body, characterRootX + 0, characterRootY + bodyVerticalOscillationY, playerSize, playerSize);

    const headRenderAbsOffsetY = headInitialOffsetY + bodyVerticalOscillationY + headVerticalOscillationY;
    drawCharacterPart(characterImages.head,
                      0,
                      headRenderAbsOffsetY,
                      headPivotInImageX, headPivotInImageY, headRotationAmount);

    drawCharacterPart(
        characterImages.eye,
        LEFT_EYE_BASE_X_REL_HEAD_TL + eyeShiftX_preRotation,
        headRenderAbsOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeShiftY_preRotation,
        eyePivotInImage,
        eyePivotInImage,
        0,
        eyeSpriteSize, eyeSpriteSize
    );

    drawCharacterPart(
        characterImages.eye,
        RIGHT_EYE_BASE_X_REL_HEAD_TL + eyeShiftX_preRotation,
        headRenderAbsOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeShiftY_preRotation,
        eyePivotInImage,
        eyePivotInImage,
        0,
        eyeSpriteSize, eyeSpriteSize
    );

    const playerCustomizations = p.customizations || {};

    // === Rysowanie Włosów ===
    const selectedHairName = playerCustomizations.hair;
    if (selectedHairName && selectedHairName !== 'none') {
        const hairImage = characterCustomImages.hair[selectedHairName];
        if (hairImage && hairImage.complete) {
            ctx.save();
            const drawActualX = characterRootX + 0;
            const drawActualY = characterRootY + headRenderAbsOffsetY + HAIR_VERTICAL_OFFSET;

            ctx.translate(drawActualX + headPivotInImageX, drawActualY + headPivotInImageY - HAIR_VERTICAL_OFFSET);
            ctx.rotate(headRotationAmount);

            drawFilteredCharacterPart(
                ctx,
                hairImage,
                -headPivotInImageX,
                -(headPivotInImageY - HAIR_VERTICAL_OFFSET),
                playerSize, playerSize,
                playerCustomizations.hairSaturation,
                playerCustomizations.hairHue,
                playerCustomizations.hairBrightness
            );
            ctx.restore();
        }
    }

    // === Rysowanie Brody ===
    const selectedBeardName = playerCustomizations.beard;
    if (selectedBeardName && selectedBeardName !== 'none') {
        const beardImage = characterCustomImages.beard[selectedBeardName];
        if (beardImage && beardImage.complete) {
            const BEARD_VERTICAL_OFFSET = Math.round(15 * (playerSize / 32));
            ctx.save();
            const drawActualX = characterRootX + 0;
            const drawActualY = characterRootY + headRenderAbsOffsetY + BEARD_VERTICAL_OFFSET;

            ctx.translate(drawActualX + headPivotInImageX, drawActualY + headPivotInImageY - BEARD_VERTICAL_OFFSET);
            ctx.rotate(headRotationAmount);

            drawFilteredCharacterPart(
                ctx,
                beardImage,
                -headPivotInImageX,
                -(headPivotInImageY - BEARD_VERTICAL_OFFSET), // Zmieniono z HAT_TOP_OFFSET_Y
                playerSize, playerSize,
                playerCustomizations.beardSaturation,
                playerCustomizations.beardHue,
                playerCustomizations.beardBrightness
            );
            ctx.restore();
        }
    }

    // === Rysowanie Kapelusza ===
    const selectedHatName = playerCustomizations.hat;
    if (selectedHatName && selectedHatName !== 'none') {
        const hatImage = characterCustomImages.hat[selectedHatName];
        if (hatImage && hatImage.complete) {
            const HAT_TOP_OFFSET_Y = -Math.round(20 * (playerSize / 32));
            drawCharacterPart(
                hatImage,
                0,
                headRenderAbsOffsetY + HAT_TOP_OFFSET_Y,
                headPivotInImageX,
                headPivotInImageY - HAT_TOP_OFFSET_Y,
                headRotationAmount,
                playerSize, playerSize
            );
        }
    }
    // --- NOWOŚĆ: Rysowanie przedmiotu w dłoni ---
    const equippedItemName = p.customizations.rightHandItem;

    if (equippedItemName && equippedItemName !== ITEM_NONE) {
        const itemConfig = exampleCustomItemPaths.items[equippedItemName];
        const itemImage = characterCustomImages.items[equippedItemName];

        if (itemConfig && itemImage && itemImage.complete) {
            drawCharacterPart(
                itemImage,
                frontArmOffsetX,
                0,
                originalArmPivotInImageX,
                originalArmPivotInImageY,
                armRotationAmount,
                itemConfig.width,
                itemConfig.height
            );
        }
    }
    drawCharacterPart(characterImages.arm, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, armRotationAmount);

    ctx.restore();

    // --- Obliczanie pozycji końca wędki dla KAŻDEGO gracza w KAŻDEJ klatce ---
    if (p.customizations && p.customizations.rightHandItem === ITEM_ROD) {
        const armPivotWorldX = p.x + (playerSize / 2);
        const armPivotWorldY = p.y + (playerSize / 2);

        const armLocalOffsetX = (frontArmOffsetX + originalArmPivotInImageX) - (playerSize / 2);
        const armLocalOffsetY = (0 + originalArmPivotInImageY) - (playerSize / 2);

        const rotationAngleForGeometry = armRotationAmount;

        const rotatedArmPivotX = armLocalOffsetX * Math.cos(rotationAngleForGeometry) - armLocalOffsetY * Math.sin(rotationAngleForGeometry);
        const rotatedArmPivotY = armLocalOffsetX * Math.sin(rotationAngleForGeometry) + armLocalOffsetY * Math.cos(rotationAngleForGeometry);

        const currentArmPivotWorldX = armPivotWorldX + rotatedArmPivotX * p.direction;
        const currentArmPivotWorldY = armPivotWorldY + rotatedArmPivotY;

        const rodTipLocalX = ROD_TIP_OFFSET_X;
        const rodTipLocalY = ROD_TIP_OFFSET_Y;

        const rotatedRodTipOffsetX = rodTipLocalX * Math.cos(rotationAngleForGeometry) - rodTipLocalY * Math.sin(rotationAngleForGeometry);
        const rotatedRodTipOffsetY = rodTipLocalX * Math.sin(rotationAngleForGeometry) + rodTipLocalY * Math.cos(rotationAngleForGeometry);

        p.rodTipWorldX = currentArmPivotWorldX + rotatedRodTipOffsetX * p.direction;
        p.rodTipWorldY = currentArmPivotWorldY + rotatedRodTipOffsetY;

        if (p.id === localPlayer.id) {
            localPlayer.rodTipWorldX = p.rodTipWorldX;
            localPlayer.rodTipWorldY = p.rodTipWorldY;
        }

    } else {
        p.rodTipWorldX = null;
        p.rodTipWorldY = null;
        if (p.id === localPlayer.id) {
            localPlayer.rodTipWorldX = null;
            localPlayer.rodTipWorldY = null;
        }
    }

    ctx.fillStyle = 'white';
    ctx.font = `${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.username || p.id.substring(0, 5), p.x + playerSize / 2, p.y - 10 + bodyVerticalOscillationY);
}


function drawCustomizationMenu() {
    const playerScreenX = (localPlayer.x - cameraX) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;

    const menuRenderX = playerScreenX + playerSize * currentZoomLevel + MENU_X_OFFSET_FROM_PLAYER;
    const menuCenterY = playerScreenY + MENU_Y_OFFSET_FROM_PLAYER_TOP_CENTER_SELECTED;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const numCategories = customizationCategories.length;

    for (let i = -Math.floor(ROLLER_VISIBLE_COUNT / 2); i <= Math.floor(ROLLER_VISIBLE_COUNT / 2); i++) {
        let categoryIndexToDraw = selectedCategoryIndex + i;

        if (categoryIndexToDraw < 0) {
            categoryIndexToDraw += numCategories;
        } else if (categoryIndexToDraw >= numCategories) {
            categoryIndexToDraw -= numCategories;
        }

        const category = customizationCategories[categoryIndexToDraw];
        const displayCategory = category.charAt(0).toUpperCase() + category.slice(1);

        ctx.save();

        let targetY = menuCenterY + i * ROLLER_ITEM_VERTICAL_SPACING;

        let currentScale = 1.0;
        let currentAlpha = 1.0;

        if (i !== 0) {
            currentScale = ROLLER_DIMMED_SCALE;
            currentAlpha = ROLLER_DIMMED_ALPHA;
        }

        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = (i === 0) ? MENU_HIGHLIGHT_COLOR : MENU_TEXT_COLOR;
        ctx.font = `${Math.round(DEFAULT_FONT_SIZE_MENU * currentScale)}px ${PIXEL_FONT}`;

        ctx.fillText(displayCategory, menuRenderX, targetY);

        ctx.restore();
    }
    ctx.globalAlpha = 1.0;

    const frameX = menuRenderX + MENU_WIDTH + FRAME_OFFSET_X_FROM_MENU_TEXT;
    const frameY = menuCenterY - (FRAME_SIZE / 2);

    frameOscillationTime += FRAME_OSCILLATION_SPEED;
    const rotationAngle = Math.sin(frameOscillationTime) * (FRAME_ROTATION_DEGREES * (Math.PI / 180));

    ctx.save();
    ctx.translate(frameX + FRAME_SIZE / 2, frameY + FRAME_SIZE / 2);
    ctx.rotate(rotationAngle);

    if (customizationUIImages.frame && customizationUIImages.frame.complete) {
        ctx.drawImage(customizationUIImages.frame, -FRAME_SIZE / 2, -FRAME_SIZE / 2, FRAME_SIZE, FRAME_SIZE);
    } else {
        ctx.fillStyle = 'red';
        ctx.fillRect(-FRAME_SIZE / 2, -FRAME_SIZE / 2, FRAME_SIZE / 2, FRAME_SIZE / 2);
    }

    const selectedCategory = customizationCategories[selectedCategoryIndex];
    const selectedOptionName = customizationOptions[selectedCategory]?.[currentCustomizationOptionIndices[selectedCategory]];

    if (selectedOptionName && selectedOptionName !== 'none') {
        const customItemImage = characterCustomImages[selectedCategory]?.[selectedOptionName];
        if (customItemImage && customItemImage.complete) {
            const itemDrawSize = FRAME_SIZE * 0.8;

            if (selectedCategory === 'hair') {
                drawFilteredCharacterPart(
                    ctx,
                    customItemImage,
                    -itemDrawSize / 2, -itemDrawSize / 2,
                    itemDrawSize, itemDrawSize,
                    localPlayerCustomizations.hairSaturation,
                    localPlayerCustomizations.hairHue,
                    localPlayerCustomizations.hairBrightness
                );
            } else if (selectedCategory === 'beard') {
                 drawFilteredCharacterPart(
                    ctx,
                    customItemImage,
                    -itemDrawSize / 2, -itemDrawSize / 2,
                    itemDrawSize, itemDrawSize,
                    localPlayerCustomizations.beardSaturation,
                    localPlayerCustomizations.beardHue,
                    localPlayerCustomizations.beardBrightness
                );
            } else {
                ctx.drawImage(customItemImage, -itemDrawSize / 2, -itemDrawSize / 2, itemDrawSize, itemDrawSize);
            }
        } else if (customItemImage === null) {
            ctx.fillStyle = 'gray';
            ctx.fillRect(-FRAME_SIZE / 4, -FRAME_SIZE / 4, FRAME_SIZE / 2, FRAME_SIZE / 2);
        }
    }

    ctx.restore();

    currentSliderBounds = [];

    if (selectedCategory === 'hair' || selectedCategory === 'beard') {
        const baseSliderX = menuRenderX + SLIDER_OFFSET_FROM_MENU_X;
        let sliderY = menuCenterY - SLIDER_ITEM_VERTICAL_SPACING;

        const categoryPrefix = selectedCategory;

        const drawSlider = (label, propertyName, min, max, currentY) => {
            const currentValue = localPlayerCustomizations[propertyName];
            const displayValue = Math.round(currentValue);

            ctx.fillStyle = MENU_TEXT_COLOR;
            ctx.font = `${Math.round(DEFAULT_FONT_SIZE_MENU * 0.7)}px ${PIXEL_FONT}`;
            ctx.textAlign = 'left';
            ctx.fillText(`${label}: ${displayValue}`, baseSliderX, currentY);

            const barDrawY = currentY + 10;
            if (customizationUIImages.bar && customizationUIImages.bar.complete) {
                ctx.drawImage(customizationUIImages.bar, baseSliderX, barDrawY, SLIDER_WIDTH, SLIDER_HEIGHT);

                const normalizedValue = (currentValue - min) / (max - min);
                let handleX = baseSliderX + normalizedValue * (SLIDER_WIDTH - SLIDER_HANDLE_SIZE);
                handleX = Math.max(baseSliderX, Math.min(baseSliderX + SLIDER_WIDTH - SLIDER_HANDLE_SIZE, handleX));
                const handleY = barDrawY - (SLIDER_HANDLE_SIZE - SLIDER_HEIGHT) / 2;

                if (customizationUIImages.sliderHandle && customizationUIImages.sliderHandle.complete) {
                    ctx.drawImage(customizationUIImages.sliderHandle, handleX, handleY, SLIDER_HANDLE_SIZE, SLIDER_HANDLE_SIZE);
                } else {
                    ctx.fillStyle = 'blue';
                    ctx.fillRect(handleX, handleY, SLIDER_HANDLE_SIZE, SLIDER_HANDLE_SIZE);
                }

                return {
                    propertyName: propertyName,
                    min: min,
                    max: max,
                    barX: baseSliderX,
                    barY: barDrawY,
                    barWidth: SLIDER_WIDTH,
                    barHeight: SLIDER_HEIGHT,
                    handleX: handleX,
                    handleY: handleY,
                    handleSize: SLIDER_HANDLE_SIZE,
                    hitboxExtend: SLIDER_HANDLE_HITBOX_EXTEND
                };
            }
            return null;
        };

        let sliderReturn = drawSlider('Saturation', `${categoryPrefix}Saturation`,
                   (categoryPrefix === 'hair' ? HAIR_SATURATION_MIN : BEARD_SATURATION_MIN),
                   (categoryPrefix === 'hair' ? HAIR_SATURATION_MAX : BEARD_SATURATION_MAX),
                   sliderY);
        if (sliderReturn) currentSliderBounds.push(sliderReturn);
        sliderY += SLIDER_ITEM_VERTICAL_SPACING;

        sliderReturn = drawSlider('Hue', `${categoryPrefix}Hue`,
                   (categoryPrefix === 'hair' ? HAIR_HUE_MIN : BEARD_HUE_MIN),
                   (categoryPrefix === 'hair' ? HAIR_HUE_MAX : BEARD_HUE_MAX),
                   sliderY);
        if (sliderReturn) currentSliderBounds.push(sliderReturn);
        sliderY += SLIDER_ITEM_VERTICAL_SPACING;

        sliderReturn = drawSlider('Brightness', `${categoryPrefix}Brightness`,
                   (categoryPrefix === 'hair' ? HAIR_BRIGHTNESS_MIN : BEARD_BRIGHTNESS_MIN),
                   (categoryPrefix === 'hair' ? HAIR_BRIGHTNESS_MAX : BEARD_BRIGHTNESS_MAX),
                   sliderY);
        if (sliderReturn) currentSliderBounds.push(sliderReturn);
    }
}


function drawFishingBar(p) {
    if (!customizationUIImages.fishingBar || !customizationUIImages.fishingBar.complete ||
        !customizationUIImages.sliderHandle || !customizationUIImages.sliderHandle.complete) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(DEDICATED_GAME_WIDTH / 2 - FISHING_BAR_WIDTH / 2, DEDICATED_GAME_HEIGHT / 4, FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT);
        ctx.fillStyle = 'red';
        ctx.fillRect(DEDICATED_GAME_WIDTH / 2 - FISHING_BAR_WIDTH / 2 + p.fishingBarSliderPosition * (FISHING_BAR_WIDTH - FISHING_BAR_HEIGHT), DEDICATED_GAME_HEIGHT / 4, FISHING_BAR_HEIGHT, FISHING_BAR_HEIGHT);
        return;
    }

    const barScreenX = (p.x - cameraX) * currentZoomLevel + (playerSize * currentZoomLevel / 2) - (FISHING_BAR_WIDTH / 2);
    const barScreenY = (p.y - cameraY) * currentZoomLevel - FISHING_BAR_HEIGHT - 60;

    ctx.save();

    ctx.drawImage(customizationUIImages.fishingBar, barScreenX, barScreenY, FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT);

    const sliderHandleSize = FISHING_BAR_HEIGHT +6;
    const sliderX = barScreenX + p.fishingBarSliderPosition * (FISHING_BAR_WIDTH - sliderHandleSize);
    const sliderY = barScreenY - (sliderHandleSize - FISHING_BAR_HEIGHT) / 2;

    ctx.drawImage(customizationUIImages.sliderHandle, sliderX, sliderY, sliderHandleSize, sliderHandleSize);
    ctx.restore();
}


function drawFishingLine(p) {
    if (!p.hasLineCast || p.rodTipWorldX === null || p.floatWorldX === null) {
        return;
    }

    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);

    ctx.strokeStyle = '#ffffff69';
    ctx.lineWidth = FISHING_LINE_SEGMENT_WIDTH;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
    ctx.lineTo(p.floatWorldX, p.floatWorldY);
    ctx.stroke();

    let verticalOffset = 0;
    let rotationOffset = 0;

    if (p.lineAnchorWorldY !== null) {
        let idSum = 0;
        if (p.id) {
            for (let i = 0; i < p.id.length; i++) {
                idSum += p.id.charCodeAt(i);
            }
        }
        const playerUniqueOffset = (idSum % 100) * 0.1;
        verticalOffset = Math.sin(bobberAnimationTime + playerUniqueOffset) * BOBBER_VERTICAL_OSCILLATION;
        rotationOffset = Math.cos(bobberAnimationTime * 0.7 + playerUniqueOffset) * BOBBER_ROTATION_OSCILLATION;
    }

    const floatImage = characterCustomImages.items.float;
    const floatConfig = exampleCustomItemPaths.items.float;
    if (floatImage && floatImage.complete && floatConfig) {
        const drawWidth = floatConfig.width;
        const drawHeight = floatConfig.height;

        ctx.save();

        ctx.translate(p.floatWorldX, p.floatWorldY + verticalOffset);
        ctx.rotate(rotationOffset);

        ctx.drawImage(
            floatImage,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        ctx.restore();

    } else {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(p.floatWorldX, p.floatWorldY + verticalOffset, FLOAT_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// === ZMODYFIKOWANA FUNKCJA DO RYSOWANIA INSEKTÓW Z OBSŁUGĄ HUE ===
function drawInsects() {
    const insectImage = biomeManager.getCurrentInsectImage();
    if (!insectImage || !insectImage.complete) return;

    const INSECT_TILE_SIZE = 32;
    const INSECT_ANIMATION_SPEED_TICKS = 8;
    const renderedSize = INSECT_TILE_SIZE * INSECT_SCALE_FACTOR;

    for (const insect of insectsInRoom) {
        const currentFrame = Math.floor(insect.animationFrame / INSECT_ANIMATION_SPEED_TICKS);
        const sourceX = currentFrame * INSECT_TILE_SIZE;
        const sourceY = (insect.typeIndex || 0) * INSECT_TILE_SIZE;
        const angleInRadians = insect.angle * (Math.PI / 180);

        ctx.save();
        ctx.translate(insect.x + renderedSize / 2, insect.y + renderedSize / 2);
        ctx.rotate(angleInRadians);

        // ZMIANA: Sprawdź, czy insekt ma zdefiniowaną właściwość 'hue' i zastosuj filtr.
        // Ta zmiana zakłada, że serwer przy tworzeniu insekta nadaje mu
        // właściwość 'hue' z wartością liczbową (np. od 0 do 360).
        if (typeof insect.hue === 'number') {
            ctx.filter = `hue-rotate(${insect.hue}deg)`;
        }

        ctx.drawImage(
            insectImage,
            sourceX,
            sourceY,
            INSECT_TILE_SIZE,
            INSECT_TILE_SIZE,
            -renderedSize / 2,
            -renderedSize / 2,
            renderedSize,
            renderedSize
        );

        // ctx.restore() usunie zastosowany filtr, więc kolejne obiekty
        // będą rysowane bez niego (chyba że same mają właściwość 'hue').
        ctx.restore();
    }
}


// --- Główna pętla gry klienta (tylko do renderowania) ---
function gameLoop(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 1000; // Czas w sekundach
    lastTime = currentTime;


    if (currentRoom === null) {
        requestAnimationFrame(gameLoop);
        return;
    }

    bobberAnimationTime += BOBBER_ANIMATION_SPEED;
    biomeManager.updateAnimations(deltaTime);

    const isPlayerInputLocked = isCustomizationMenuOpen || draggingSlider || localPlayer.isCasting;
    if (!isPlayerInputLocked) {
        socket.emit('playerInput', {
            keys: keys,
            currentMouseX: localPlayer.currentMouseX,
            currentMouseY: localPlayer.currentMouseY,
        });
    } else {
        socket.emit('playerInput', {
            keys: {},
            currentMouseX: localPlayer.currentMouseX,
            currentMouseY: localPlayer.currentMouseY,
        });
    }

    if (localPlayer.isCasting) {
        localPlayer.fishingBarTime += FISHING_SLIDER_SPEED;
        localPlayer.fishingBarSliderPosition = (Math.sin(localPlayer.fishingBarTime) + 1) / 2;
        localPlayer.castingPower = localPlayer.fishingBarSliderPosition;
    }

    updateCamera();

    ctx.clearRect(0, 0, DEDICATED_GAME_WIDTH, DEDICATED_GAME_HEIGHT);

    // Rysowanie jednolitego koloru nieba
    biomeManager.drawBackground(ctx);

    // Zaczynamy transformację całego świata gry
    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);

    // === NAJWAŻNIEJSZA ZMIANA ===
    // Rysujemy tło paralaksy WEWNĄTRZ transformacji, aby dziedziczyło ZOOM.
    // Specjalna logika wewnątrz tej funkcji zadba o poprawne przesunięcie paralaksy.
    const visibleWorldWidth = DEDICATED_GAME_WIDTH / currentZoomLevel;
    biomeManager.drawParallaxBackground(ctx, cameraX, cameraY, visibleWorldWidth);
    
    // =============================

    // --- Reszta świata jest rysowana normalnie ---
    if (currentRoom && currentRoom.gameData && currentRoom.gameData.biome) {
        const biomeName = currentRoom.gameData.biome;
        const groundLevel = currentRoom.gameData.groundLevel;

        biomeManager.drawBackgroundBiomeGround(ctx, biomeName, groundLevel);
        biomeManager.drawBackgroundTrees(ctx);
        biomeManager.drawBackgroundPlants(ctx);
        drawInsects(); // <-- WYWOŁANIE RYSOWANIA INSEKTÓW
        biomeManager.drawForegroundBiomeGround(ctx, biomeName, groundLevel);
        biomeManager.drawBuildings(ctx, groundLevel, cameraX, visibleWorldWidth);
    }
        

    let playersToRender = Object.values(playersInRoom);
    playersToRender.sort((a, b) => (a.y + playerSize) - (b.y + playerSize));
    playersToRender.forEach(p => drawPlayer(p));



    if (currentRoom && currentRoom.gameData && currentRoom.gameData.biome) {
        const biomeName = currentRoom.gameData.biome;

        biomeManager.drawForegroundPlants(ctx);
        biomeManager.drawForegroundTrees(ctx);
        biomeManager.drawWater(ctx, biomeName, cameraX);
    }

    ctx.restore();

    // Rysowanie UI (w przestrzeni ekranu)
    if (isCustomizationMenuOpen) {
        ctx.save();
        drawCustomizationMenu();
        ctx.restore();
    }
    if (localPlayer.isCasting) {
        ctx.save();
        drawFishingBar(localPlayer);
        ctx.restore();
    }
    for (const id in playersInRoom) {
        const player = playersInRoom[id];
        drawFishingLine(player);
    }

    requestAnimationFrame(gameLoop);
}

// --- Obsługa zdarzeń Socket.IO ---

socket.on('grassSwaying', ({ grassId, direction }) => {
    if (currentRoom && biomeManager) {
        biomeManager.startSwayAnimation(grassId, direction);
    }
});

// === NOWY LISTENER DLA INSEKTÓW ===
socket.on('insectsUpdate', (insectsData) => {
    insectsInRoom = insectsData;
});

socket.on('playerInfo', (info) => {
    localPlayer.id = info.id;
    localPlayer.username = info.username;
    localPlayer.color = info.color;
    if (info.customizations) {
        Object.assign(localPlayer.customizations, info.customizations);
        Object.assign(localPlayerCustomizations, info.customizations);
        for (const category in customizationOptions) {
            const selectedOption = localPlayer.customizations[category];
            const options = customizationOptions[category];
            if (options) {
                const index = options.indexOf(selectedOption);
                if (index !== -1) {
                    currentCustomizationOptionIndices[category] = index;
                }
            }
        }
    }
    myUsernameSpan.textContent = info.username;
    myColorDisplay.style.backgroundColor = info.color;
});

socket.on('roomListUpdate', (roomsFromServer) => {
    roomListUl.innerHTML = '';
    if (Object.keys(roomsFromServer).length === 0) {
        roomListUl.innerHTML = '<li>Brak dostępnych pokoi. Stwórz jeden!</li>';
    } else {
        for (let roomId in roomsFromServer) {
            const room = roomsFromServer[roomId];
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${room.name} (Graczy: ${room.playerCount}) - Biome: ${room.biome}, Size: ${room.worldWidth}px, Village: ${room.villageType}</span>
                <button data-room-id="${roomId}">Dołącz</button>
            `;
            li.querySelector('button').addEventListener('click', () => {
                socket.emit('joinRoom', roomId, (response) => {
                    if (!response.success) {
                        alert(response.message);
                    }
                });
            });
            roomListUl.appendChild(li);
        }
    }
});

socket.on('roomRemoved', (removedRoomId) => {
    if (currentRoom && currentRoom.id === removedRoomId) {
        alert('Pokój, w którym byłeś, został usunięty!');
        leaveCurrentRoomUI();
    }
});

socket.on('roomJoined', (roomData) => {
    currentRoom = roomData;
    playersInRoom = roomData.playersInRoom;

    if (roomData.gameData) {
        currentWorldWidth = roomData.gameData.worldWidth;
        biomeManager.worldWidth = currentWorldWidth;
        biomeManager.setBiome(roomData.gameData.biome);
        biomeManager.setVillageData(roomData.gameData.villageType, roomData.gameData.villageXPosition, roomData.gameData.placedBuildings);

        if (roomData.gameData.groundPlants) {
            biomeManager.initializeGroundPlants(roomData.gameData.groundPlants);
        } else {
            biomeManager.initializeGroundPlants([]);
        }

        if (roomData.gameData.trees) {
            biomeManager.initializeTrees(roomData.gameData.trees);
        } else {
            biomeManager.initializeTrees([]);
        }

        // Inicjalizacja insektów przy dołączaniu do pokoju
        insectsInRoom = roomData.gameData.insects || [];

    } else {
        biomeManager.initializeGroundPlants([]);
        biomeManager.initializeTrees([]); // Upewnij się, że drzewa są czyszczone
        biomeManager.setVillageData('none', null, []);
        insectsInRoom = [];
    }

    if (playersInRoom[localPlayer.id]) {
        const serverPlayerState = playersInRoom[localPlayer.id];
        Object.assign(localPlayer, serverPlayerState);

        if (serverPlayerState.customizations) {
            Object.assign(localPlayer.customizations, serverPlayerState.customizations);
        }
        Object.assign(localPlayerCustomizations, localPlayer.customizations);

        for (const category in customizationOptions) {
            const selectedOption = localPlayer.customizations[category];
            const options = customizationOptions[category];
            if (options) {
                const index = options.indexOf(selectedOption);
                if (index !== -1) {
                    currentCustomizationOptionIndices[category] = index;
                }
            }
        }
    } else {
        const groundY_for_player_y = DEDICATED_GAME_HEIGHT - (currentRoom?.gameData?.groundLevel || 0) - playerSize;
        localPlayer.x = 50;
        localPlayer.y = groundY_for_player_y;
        localPlayer.isJumping = false;
        localPlayer.velocityY = 0;
        localPlayer.isWalking = false;
        localPlayer.isIdle = true;
        localPlayer.animationFrame = 0;
        localPlayer.idleAnimationFrame = 0;
    }

    const playerInitialCenterX = localPlayer.x + playerSize / 2;
    const playerInitialCenterY = localPlayer.y + playerSize / 2;
    const visibleWorldWidthAtInit = DEDICATED_GAME_WIDTH / currentZoomLevel;
    const visibleWorldHeightAtInit = DEDICATED_GAME_HEIGHT / currentZoomLevel;



    cameraX = playerInitialCenterX - visibleWorldWidthAtInit / 2;
    cameraY = playerInitialCenterY - visibleWorldHeightAtInit / 2;

    if (cameraX < 0) cameraX = 0;
    if (cameraX > currentWorldWidth - visibleWorldWidthAtInit) cameraX = currentWorldWidth - visibleWorldWidthAtInit;
    if (cameraY < 0) cameraY = 0;
    if (cameraY > DEDICATED_GAME_HEIGHT - visibleWorldHeightAtInit) cameraY = DEDICATED_GAME_HEIGHT - visibleWorldHeightAtInit;


    lobbyDiv.style.display = 'none';
    gameContainerDiv.style.display = 'block';
    console.log('Dołączyłeś do pokoju:', currentRoom.name);
});

socket.on('playerJoinedRoom', (data) => {
    playersInRoom[data.id] = data.playerData;
    playersInRoom[data.id].username = data.username;
    console.log(`Gracz ${data.username} dołączył do pokoju.`);
});

socket.on('playerLeftRoom', (playerId) => {
    if (playersInRoom[playerId]) {
        console.log(`Gracz ${playersInRoom[playerId].username} opuścił pokój.`);
        delete playersInRoom[playerId];
    }
});

socket.on('playerMovedInRoom', (allPlayersData) => {
    if (Array.isArray(allPlayersData)) {
        const updatedPlayersMap = {};
        for (const movedPlayerData of allPlayersData) {
            if (playersInRoom[movedPlayerData.id]) {
                movedPlayerData.rodTipWorldX = playersInRoom[movedPlayerData.id].rodTipWorldX;
                movedPlayerData.rodTipWorldY = playersInRoom[movedPlayerData.id].rodTipWorldY;
            }
            updatedPlayersMap[movedPlayerData.id] = movedPlayerData;
        }

        playersInRoom = updatedPlayersMap;

        if (localPlayer.id && playersInRoom[localPlayer.id]) {
            const serverState = playersInRoom[localPlayer.id];

            const tempLocalCasting = localPlayer.isCasting;
            const tempLocalFishingBarTime = localPlayer.fishingBarTime;
            const tempLocalFishingBarSliderPosition = localPlayer.fishingBarSliderPosition;
            const tempLocalCastingPower = localPlayer.castingPower;
            const tempLocalCastingDirectionAngle = localPlayer.castingDirectionAngle;


            Object.assign(localPlayer, serverState);

            localPlayer.isCasting = tempLocalCasting;
            localPlayer.fishingBarTime = tempLocalFishingBarTime;
            localPlayer.fishingBarSliderPosition = tempLocalFishingBarSliderPosition;
            localPlayer.castingPower = tempLocalCastingPower;
            localPlayer.castingDirectionAngle = tempLocalCastingDirectionAngle;

            if (serverState.customizations) {
                Object.assign(localPlayer.customizations, serverState.customizations);
                Object.assign(localPlayerCustomizations, localPlayer.customizations);
            }
        }
    }
});

socket.on('playerCustomizationUpdated', (data) => {
    if (playersInRoom[data.id]) {
        Object.assign(playersInRoom[data.id].customizations, data.customizations);
    } else {
        console.warn(`[CLIENT] Otrzymano 'playerCustomizationUpdated' dla gracza ${data.id}, ale gracz nie znajduje się w playersInRoom.`);
    }
});


createRoomBtn.addEventListener('click', () => {
    const roomName = newRoomNameInput.value.trim();
    socket.emit('createRoom', roomName, (response) => {
        if (!response.success) {
            alert(response.message);
        }
    });
});

leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', (response) => {
        if (response.success) {
            leaveCurrentRoomUI();
        } else {
            alert(response.message);
        }
    });
});

function leaveCurrentRoomUI() {
    currentRoom = null;
    playersInRoom = {};
    insectsInRoom = []; // Wyczyszczenie insektów po opuszczeniu pokoju
    gameContainerDiv.style.display = 'none';
    lobbyDiv.style.display = 'block';

    if (biomeManager) {
        biomeManager.initializeGroundPlants([]);
        biomeManager.initializeTrees([]); // Wyczyszczenie drzew po opuszczeniu pokoju
        biomeManager.setBiome('jurassic'); // Ustaw domyślny biom
        biomeManager.setVillageData('none', null, []); // Reset danych wioski, bez budynków
        currentWorldWidth = DEDICATED_GAME_WIDTH * 2;
        biomeManager.worldWidth = currentWorldWidth;
    }

    localPlayer.x = 50;
    localPlayer.y = DEDICATED_GAME_HEIGHT - 50 - playerSize;
    localPlayer.isJumping = false;
    localPlayer.velocityY = 0;
    localPlayer.isWalking = false;
    localPlayer.isIdle = true;
    localPlayer.animationFrame = 0;
    localPlayer.idleAnimationFrame = 0;
    localPlayer.direction = 1;
    localPlayer.velocityX = 0;
    localPlayer.currentMouseX = undefined;
    localPlayer.currentMouseY = undefined;
    localPlayer.customizations = {
        hat: 'none', hair: 'none', accessories: 'none', beard: 'none', clothes: 'none', pants: 'none', shoes: 'none',
        rightHandItem: ITEM_NONE,
        hairSaturation: 100, hairHue: 0, hairBrightness: 100,
        beardSaturation: 100, beardHue: 0, beardBrightness: 100
    };
    Object.assign(localPlayerCustomizations, localPlayer.customizations);
    for(const cat in currentCustomizationOptionIndices) {
        currentCustomizationOptionIndices[cat] = 0;
    }
    // --- Resetuj stan wędkowania ---
    localPlayer.isCasting = false;
    localPlayer.castingPower = 0;
    localPlayer.fishingBarTime = 0;
    localPlayer.hasLineCast = false;
    localPlayer.floatWorldX = null;
    localPlayer.floatWorldY = null;
    localPlayer.rodTipWorldX = null;
    localPlayer.rodTipWorldY = null;
    localPlayer.lineAnchorWorldY = null;
    // --- KONIEC RESETU ---
    cameraX = 0;
    cameraY = 0;
    currentZoomLevel = 1.0;
    isCustomizationMenuOpen = false;
    selectedCategoryIndex = 0;
    currentSliderBounds = [];
    draggingSlider = null;
    console.log('Opuściłeś pokój.');
}


function getMousePosOnCanvas(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX_canvasCss = evt.clientX - rect.left;
    const mouseY_canvasCss = evt.clientY - rect.top;

    return {
        x: mouseX_canvasCss * scaleX,
        y: mouseY_canvasCss * scaleY
    };
}


document.addEventListener('keydown', (event) => {
    if (currentRoom !== null) {
        keys[event.code] = true;

        if (event.code === 'Digit1' || event.code === 'Numpad1') {
            localPlayer.customizations.rightHandItem = ITEM_NONE;
            localPlayerCustomizations.rightHandItem = ITEM_NONE;
            socket.emit('updateCustomization', localPlayer.customizations);
            event.preventDefault();
        } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
            localPlayer.customizations.rightHandItem = ITEM_ROD;
            localPlayerCustomizations.rightHandItem = ITEM_ROD;
            socket.emit('updateCustomization', localPlayer.customizations);
            event.preventDefault();
        } else if (event.code === 'Digit3' || event.code === 'Numpad3') {
            localPlayer.customizations.rightHandItem = ITEM_LANTERN;
            localPlayerCustomizations.rightHandItem = ITEM_LANTERN;
            socket.emit('updateCustomization', localPlayer.customizations);
            event.preventDefault();
        }

        if (event.code === 'KeyE') {
            isCustomizationMenuOpen = !isCustomizationMenuOpen;
            event.preventDefault();
            currentSliderBounds = [];
            draggingSlider = null;
        }

        if (isCustomizationMenuOpen) {
            const currentCategory = customizationCategories[selectedCategoryIndex];
            if (event.code === 'ArrowUp') {
                selectedCategoryIndex = (selectedCategoryIndex - 1 + customizationCategories.length) % customizationCategories.length;
                event.preventDefault();
            } else if (event.code === 'ArrowDown') {
                selectedCategoryIndex = (selectedCategoryIndex + 1) % customizationCategories.length;
                event.preventDefault();
            } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
                const currentIndex = currentCustomizationOptionIndices[currentCategory];
                const options = customizationOptions[currentCategory];
                if (options) {
                    let newIndex = currentIndex;
                    if (event.code === 'ArrowLeft') {
                        newIndex = (currentIndex - 1 + options.length) % options.length;
                    } else { // ArrowRight
                        newIndex = (currentIndex + 1) % options.length;
                    }

                    if (newIndex !== currentIndex) {
                        currentCustomizationOptionIndices[currentCategory] = newIndex;
                        localPlayerCustomizations[currentCategory] = options[newIndex];
                        localPlayer.customizations[currentCategory] = localPlayerCustomizations[currentCategory];
                        socket.emit('updateCustomization', localPlayer.customizations);
                    }
                }
                event.preventDefault();
            }
        }

        if (event.code === 'Space' && !localPlayer.isJumping && !isCustomizationMenuOpen && !localPlayer.isCasting && !localPlayer.hasLineCast) {
            socket.emit('playerJump');
        }
    }
});

document.addEventListener('keyup', (event) => {
    if (currentRoom !== null) {
        delete keys[event.code];
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (currentRoom !== null && localPlayer.id !== null) {
        const rect = canvas.getBoundingClientRect();

        const mouseX_canvasCss = event.clientX - rect.left;
        const mouseY_canvasCss = event.clientY - rect.top;

        const mouseX_internalCanvas_unzoomed = mouseX_canvasCss * (DEDICATED_GAME_WIDTH / rect.width);
        const mouseY_internalCanvas_unzoomed = mouseY_canvasCss * (DEDICATED_GAME_HEIGHT / rect.height);

        localPlayer.currentMouseX = mouseX_internalCanvas_unzoomed / currentZoomLevel + cameraX;
        localPlayer.currentMouseY = mouseY_internalCanvas_unzoomed / currentZoomLevel + cameraY;

        // ZMIANA: Ograniczenie pozycji myszy do dynamicznej szerokości świata
        localPlayer.currentMouseX = Math.max(0, Math.min(currentWorldWidth, localPlayer.currentMouseX));
        localPlayer.currentMouseY = Math.max(0, Math.min(DEDICATED_GAME_HEIGHT, localPlayer.currentMouseY));

        if (localPlayer.customizations.rightHandItem === ITEM_ROD && !localPlayer.isCasting && !localPlayer.hasLineCast && localPlayer.rodTipWorldX !== null) {
            const dx = localPlayer.currentMouseX - localPlayer.rodTipWorldX;
            const dy = localPlayer.currentMouseY - localPlayer.rodTipWorldY;
            localPlayer.castingDirectionAngle = Math.atan2(dy, dx);
        }
    }

    if (draggingSlider) {
        const mousePos = getMousePosOnCanvas(canvas, event);
        const clickPositionInBar = mousePos.x - draggingSlider.barX;
        const handleCenterOffset = draggingSlider.handleSize / 2;
        const effectiveClickPosition = clickPositionInBar - handleCenterOffset;

        const normalizedValue = effectiveClickPosition / (draggingSlider.barWidth - draggingSlider.handleSize);
        let newValue = draggingSlider.min + normalizedValue * (draggingSlider.max - draggingSlider.min);

        newValue = Math.max(draggingSlider.min, Math.min(draggingSlider.max, newValue));
        newValue = Math.round(newValue);

        if (localPlayerCustomizations[draggingSlider.propertyName] !== newValue) {
            localPlayerCustomizations[draggingSlider.propertyName] = newValue;
            localPlayer.customizations[draggingSlider.propertyName] = newValue;
            socket.emit('updateCustomization', localPlayer.customizations);
        }
        event.preventDefault();
    }
});

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0 && currentRoom !== null && localPlayer.customizations.rightHandItem === ITEM_ROD && !localPlayer.hasLineCast && !isCustomizationMenuOpen) {
        localPlayer.isCasting = true;
        localPlayer.fishingBarTime = 0;
        event.preventDefault();
        return;
    }

    if (!isCustomizationMenuOpen) return;

    const currentCategory = customizationCategories[selectedCategoryIndex];
    if (!(currentCategory === 'hair' || currentCategory === 'beard')) return;

    const mousePos = getMousePosOnCanvas(canvas, event);

    for (const bounds of currentSliderBounds) {
        const hitboxExpand = bounds.hitboxExtend || 0;
        if (mousePos.x >= bounds.handleX - hitboxExpand &&
            mousePos.x <= bounds.handleX + bounds.handleSize + hitboxExpand &&
            mousePos.y >= bounds.handleY - hitboxExpand &&
            mousePos.y <= bounds.handleY + bounds.handleSize + hitboxExpand) {

            draggingSlider = { ...bounds, startMouseX: mousePos.x, startValue: localPlayerCustomizations[bounds.propertyName] };
            event.preventDefault();
            return;
        }

        if (mousePos.x >= bounds.barX &&
            mousePos.x <= bounds.barX + bounds.barWidth &&
            mousePos.y >= bounds.barY &&
            mousePos.y <= bounds.barY + bounds.barHeight) {

            const clickPositionInBar = mousePos.x - bounds.barX;
            const handleCenterOffset = bounds.handleSize / 2;
            const effectiveClickPosition = clickPositionInBar - handleCenterOffset;

            const normalizedClickPosition = effectiveClickPosition / (bounds.barWidth - bounds.handleSize);
            let newValue = bounds.min + normalizedClickPosition * (bounds.max - bounds.min);
            newValue = Math.max(bounds.min, Math.min(bounds.max, newValue));
            newValue = Math.round(newValue);

            localPlayerCustomizations[bounds.propertyName] = newValue;
            localPlayer.customizations[bounds.propertyName] = newValue;
            socket.emit('updateCustomization', localPlayer.customizations);

            draggingSlider = { ...bounds, startMouseX: mousePos.x, startValue: newValue };
            event.preventDefault();
            return;
        }
    }
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0 && currentRoom !== null && localPlayer.customizations.rightHandItem === ITEM_ROD && !isCustomizationMenuOpen) {
        if (localPlayer.isCasting) {
            localPlayer.isCasting = false;

            socket.emit('castFishingLine', {
                power: localPlayer.castingPower,
                angle: localPlayer.castingDirectionAngle,
                startX: localPlayer.rodTipWorldX,
                startY: localPlayer.rodTipWorldY
            });
            event.preventDefault();
            return;
        } else if (localPlayer.hasLineCast) {
            socket.emit('reelInFishingLine');
            event.preventDefault();
            return;
        }
    }

    draggingSlider = null;
});

canvas.addEventListener('mouseleave', () => {
    draggingSlider = null;
});

canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    if (event.deltaY < 0) {
        currentZoomLevel += ZOOM_SENSITIVITY;
    } else {
        currentZoomLevel -= ZOOM_SENSITIVITY;
    }

    currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoomLevel));
}, { passive: false });

// Ładujemy obrazy, a gdy wszystkie są gotowe, uruchamiamy pętlę gry.
loadImages(() => {
    console.log("Wszystkie obrazy załadowane, uruchamiam pętlę gry.");
    requestAnimationFrame(gameLoop);
});