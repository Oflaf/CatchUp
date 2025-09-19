'use strict';

// ====================================================================
// === SEKCJA 1: ZMIENNE SIECIOWE P2P i STANU GRY ===
// ====================================================================

let signalingSocket;
let peer;
let isHost = false;
let gameHostInstance;
let hostConnection;

let availableRooms = {};
let hostRoomConfiguration = null;
// ========================================================================================

// ================= POCZĄTEK ZMIAN: Rozbudowany Helper (Samouczek) =================
// Ten obiekt i cała logika z nim związana istnieje TYLKO w przeglądarce lokalnego gracza.
// Serwer ani inni gracze nie mają do niego dostępu.
const tutorial = {
    state: 1, // Aktualny krok samouczka (1-5) lub 'finished'
    activeImage: { key: 'info1', alpha: 1, yOffset: 0, startTime: Date.now() },
    fadingOutImage: null, // Obiekt dla obrazka, który znika
};

const TUTORIAL_IMAGE_SCALE = 2.4;
const TUTORIAL_Y_OFFSET = -28;
const TUTORIAL_ROCKING_ANGLE_DEGREES = 10;
const TUTORIAL_ROCKING_SPEED = 4;
const TUTORIAL_FADE_DURATION_MS = 600; // Czas trwania animacji fade in/out w milisekundach
const TUTORIAL_FADE_UP_DISTANCE = 250; // Jak wysoko obrazek uniesie się podczas znikania

const tutorialImagePaths = {
    info1: 'img/ui/info1.png',
    info2: 'img/ui/info2.png',
    info3: 'img/ui/info3.png',
    info4: 'img/ui/info4.png',
    info5: 'img/ui/info5.png'
};
const tutorialImages = {};
// ================= KONIEC ZMIAN =================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const DEDICATED_GAME_WIDTH = 1920;


let currentWorldWidth = DEDICATED_GAME_WIDTH * 2;

canvas.width = DEDICATED_GAME_WIDTH;
canvas.height = DEDICATED_GAME_HEIGHT;
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.imageSmoothingEnabled = false;

const biomeManager = new BiomeManager(currentWorldWidth, DEDICATED_GAME_HEIGHT);

// ====================================================================
// === SEKCJA NPC: Nowa klasa do zarządzania NPC ===
// ====================================================================

class NPCManager {
    constructor(drawPlayerFunc) {
        this.npcs = [];
        this.npcAssets = {}; // Przechowuje załadowane assety dla każdego biomu
        this.areAssetsLoaded = false;
        this.currentBiome = null;
        this.drawPlayer = drawPlayerFunc;

        this.villageBounds = { minX: 0, maxX: 0 };
    }

    loadCurrentBiomeAssets(biomeName, callback) {
        if (this.currentBiome === biomeName && this.areAssetsLoaded) {
            if (callback) callback();
            return;
        }

        this.currentBiome = biomeName;
        this.areAssetsLoaded = false;
        const basePath = `img/world/biome/${biomeName}/npc/`;
        const assetKeys = ['leg', 'body', 'arm', 'head', 'eye'];
        const promises = [];

        this.npcAssets = {};

        for (const key of assetKeys) {
            const promise = new Promise((resolve, reject) => {
                const img = new Image();
                img.src = `${basePath}${key}.png`;
                img.onload = () => {
                    this.npcAssets[key] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load NPC asset: ${img.src}`);
                    // Mimo błędu, resolve, aby nie blokować gry. NPC po prostu się nie pojawi.
                    resolve();
                };
            });
            promises.push(promise);
        }

        Promise.all(promises).then(() => {
            console.log(`All NPC assets for biome '${biomeName}' loaded.`);
            this.areAssetsLoaded = true;
            if (callback) callback();
        });
    }

    spawnNPCs(gameData) {
        this.clear();
        if (!gameData || gameData.villageType === 'none' || !gameData.placedBuildings || gameData.placedBuildings.length === 0) {
            return;
        }

        const groundY = DEDICATED_GAME_HEIGHT - gameData.groundLevel - playerSize;
        const buildings = gameData.placedBuildings;

        // Określ granice wioski
        const xCoords = buildings.map(b => b.x);
        const widths = buildings.map(b => b.width);
        this.villageBounds.minX = Math.min(...xCoords) - 150; // Dodatkowy margines
        this.villageBounds.maxX = Math.max(...xCoords.map((x, i) => x + widths[i])) + 150;

        buildings.forEach(building => {
            const npcCount = 1 + Math.floor(Math.random() * 2); // Od 1 do 2 NPC na domek
            for (let i = 0; i < npcCount; i++) {
                // === POCZĄTEK ZMIANY: Losowanie włosów dla NPC ===
               const availableHairs = customizationOptions.hair;
                // Losujemy indeks od 0 do 3, aby NPC mogły mieć fryzury od 'none' do 'type3' ('Short')
                const randomIndex = Math.floor(Math.random() * 4); // Zmiana tutaj
                const randomHair = availableHairs[randomIndex];
                // === KONIEC ZMIANY ===
                const randomBrightness = Math.floor(Math.random() * (HAIR_BRIGHTNESS_MAX - HAIR_BRIGHTNESS_MIN + 1)) + HAIR_BRIGHTNESS_MIN;
                const npc = {
                    id: `npc_${this.npcs.length}`,
                    x: building.x + (building.width / 2) + (Math.random() * 200 - 100),
                    y: groundY,
                    direction: Math.random() < 0.5 ? 1 : -1,
                    isWalking: false,
                    isIdle: true,
                    isJumping: false,
                    animationFrame: 0,
                    idleAnimationFrame: 0,
                    velocityX: 0,
                    velocityY: 0,
                    
                    // Logika stanu NPC
                    state: 'idle', // 'walking' or 'idle'
                    stateTimer: Math.random() * 7 + 2, // Czas w sekundach do następnej zmiany stanu
                    // NPC mają teraz losowe włosy
                                       customizations: { 
                        hat: 'none', 
                        hair: randomHair, 
                        accessories: 'none', 
                        beard: 'none', 
                        clothes: 'none', 
                        pants: 'none', 
                        shoes: 'none', 
                        rightHandItem: ITEM_NONE,
                        // Dodane właściwości koloru włosów
                        hairHue: 150,
                        hairBrightness: randomBrightness,
                        hairSaturation: 100, // Ustawiamy domyślne nasycenie, aby kolor był widoczny
                        beardHue: 0,        // Domyślne wartości dla brody, na wszelki wypadek
                        beardBrightness: 100,
                        beardSaturation: 100
                    }
                };
                this.npcs.push(npc);
            }
        });
        console.log(`Spawned ${this.npcs.length} NPCs for the village.`);
    }

    update(deltaTime) {
        if (!this.areAssetsLoaded || this.npcs.length === 0) return;
        const PLAYER_WALK_SPEED = 5;

        this.npcs.forEach(npc => {
            npc.stateTimer -= deltaTime;

            // Zmiana stanu
            if (npc.stateTimer <= 0) {
                if (npc.state === 'idle') {
                    npc.state = 'walking';
                    npc.stateTimer = Math.random() * 6 + 4; // Chodź przez 4-10 sekund
                    npc.direction = Math.random() < 0.5 ? 1 : -1; // Losowy kierunek przy rozpoczęciu chodzenia
                } else {
                    npc.state = 'idle';
                    npc.stateTimer = Math.random() * 4 + 2; // Stój przez 2-6 sekund
                }
            }
            

            // Aktualizacja logiki na podstawie stanu
            if (npc.state === 'walking') {
                npc.isWalking = true;
                npc.isIdle = false;
                npc.velocityX = 5 * npc.direction; // Stała prędkość NPC
                npc.x += npc.velocityX;

                // Sprawdzanie granic wioski
                if (npc.x < this.villageBounds.minX) {
                    npc.x = this.villageBounds.minX;
                    npc.direction = 1;
                } else if (npc.x > this.villageBounds.maxX - playerSize) {
                    npc.x = this.villageBounds.maxX - playerSize;
                    npc.direction = -1;
                }
                
                // Obliczamy speedFactor tak jak dla gracza
                const speedFactor = Math.abs(npc.velocityX / PLAYER_WALK_SPEED);
                npc.animationFrame = (npc.animationFrame + speedFactor*1.5)
            } else { // Stan 'idle'
                npc.isWalking = false;
                npc.isIdle = true;
                npc.velocityX = 0;
                npc.idleAnimationFrame = (npc.idleAnimationFrame + 1) % IDLE_ANIM_CYCLE_LENGTH;
            }
        });
    }

    draw(ctx) {
        if (!this.areAssetsLoaded || this.npcs.length === 0) return;

        const sortedNPCs = [...this.npcs].sort((a, b) => (a.y + playerSize) - (b.y + playerSize));
        sortedNPCs.forEach(npc => {
            // Używamy funkcji drawPlayer, przekazując jej dane NPC i specjalny zestaw assetów NPC
            this.drawPlayer(npc, this.npcAssets);
        });
    }

    clear() {
        this.npcs = [];
    }
}

// ====================================================================

const lobbyDiv = document.getElementById('lobby');
const gameContainerDiv = document.getElementById('gameContainer');
const myUsernameSpan = document.getElementById('myUsername');
const myColorDisplay = document.getElementById('myColorDisplay');
const createRoomBtn = document.getElementById('createRoomBtn');
const newRoomNameInput = document.getElementById('newRoomName');
const roomListUl = document.getElementById('roomList');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

const playerSize = 128;
const animationCycleLength = 60;
const armRotationDegrees = 45;
const legRotationDegrees = 45;
const bodyHeadPulseAmount = Math.round(2 * (playerSize / 36));
const armRotationAngle = armRotationDegrees * (Math.PI / 180);
const legRotationAngle = legRotationDegrees * (Math.PI / 180);
const originalArmPivotInImageX = Math.round(14 * (playerSize / 36));
const originalArmPivotInImageY = Math.round(15 * (playerSize / 36));
const legPivotInImageX = Math.round(14 * (playerSize / 36));
const legPivotInImageY = Math.round(27 * (playerSize / 36));
const headPivotInImageX = Math.round(16 * (playerSize / 32));
const headPivotInImageY = Math.round(16 * (playerSize / 32));
const headRotationAngleAmount = (Math.PI / 180 * 2);
const headOscillationAmplitudeFactor = 0.5;
const headInitialOffsetY = 0;
const HAIR_VERTICAL_OFFSET = -Math.round(10 * (playerSize / 32));
const BEARD_VERTICAL_OFFSET = -Math.round(10 * (playerSize / 32));
const backArmOffsetX = Math.round(8 * (playerSize / 36));
const backLegOffsetX = Math.round(9 * (playerSize / 36));
const frontArmOffsetX = 0;
const frontLegOffsetX = 0;
const eyeSpriteSize = Math.round(32 * (playerSize / 32));
const eyePivotInImage = eyeSpriteSize / 2;
const eyeMaxMovementRadius = Math.round(0.4 * (playerSize / 32));
const LEFT_EYE_BASE_X_REL_HEAD_TL = Math.round(0 * (playerSize / 32));
const RIGHT_EYE_BASE_X_REL_HEAD_TL = Math.round(4.5 * (playerSize / 32));
const EYE_BASE_Y_REL_HEAD_TL = Math.round(0.5 * (playerSize / 32));
const IDLE_ANIM_CYCLE_LENGTH = 60;
const IDLE_ARM_ROTATION_DEGREES = 8;
const IDLE_BODY_HEAD_PULSE_AMOUNT = Math.round(1.5 * (playerSize / 36));
const IDLE_HEAD_ROTATION_DEGREES = 1;
const IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR = 0.4;
const IDLE_ARM_ROTATION_ANGLE = IDLE_ARM_ROTATION_DEGREES * (Math.PI / 180);
const IDLE_HEAD_ROTATION_ANGLE_AMOUNT = IDLE_HEAD_ROTATION_DEGREES * (Math.PI / 180);
const JUMP_BODY_TILT_DEGREES = -20;
const JUMP_LEG_OPPOSITE_ROTATION_DEGREES = -120;
const JUMP_LEG_WAVE_DEGREES = 120;
const FLOAT_SIZE = 32;
const JUMP_ARM_WAVE_DEGREES = 180;
const INSECT_SCALE_FACTOR = 2.6;
const JUMP_BODY_TILT_ANGLE = JUMP_BODY_TILT_DEGREES * (Math.PI / 180);
const JUMP_LEG_OPPOSITE_ROTATION_ANGLE = JUMP_LEG_OPPOSITE_ROTATION_DEGREES * (Math.PI / 180);
const JUMP_LEG_WAVE_ANGLE = JUMP_LEG_WAVE_DEGREES * (Math.PI / 180);
const JUMP_ARM_WAVE_ANGLE = JUMP_ARM_WAVE_DEGREES * (Math.PI / 180);
let currentZoomLevel = 1.0;
const MIN_ZOOM = 0.76;
const MAX_ZOOM = 1.8;
const ZOOM_SENSITIVITY = 0.1;
const ITEM_NONE = 'none';
const ITEM_ROD = 'rod';
const ITEM_LANTERN = 'lantern';
const FISHING_BAR_WIDTH = 192;
const FISHING_BAR_HEIGHT = 30;
const FISHING_SLIDER_SPEED = 0.05;
const FISHING_LINE_SEGMENT_WIDTH = 4;
const BOBBER_VERTICAL_OSCILLATION = 4;
const BOBBER_ROTATION_OSCILLATION = 10 * (Math.PI / 180);
const BOBBER_ANIMATION_SPEED = 0.05;

const characterImagePaths = { leg: 'img/character/leg.png', body: 'img/character/body.png', arm: 'img/character/arm.png', head: 'img/character/head.png', eye: 'img/character/eye.png' };
const customizationUIPaths = { frame: 'img/ui/frame.png' };
const sliderUIPaths = { bar: 'img/ui/bar.png', sliderHandle: 'img/ui/slider.png', fishingBar: 'img/ui/fishingbar.png' };
const characterImages = {};
const customizationUIImages = {};
const characterCustomImages = { hat: {}, hair: {}, accessories: {}, beard: {}, clothes: {}, clothes_arm: {}, pants: {}, shoes: {}, items: {} };
const exampleCustomItemPaths = {
    hat: { 'red cap': 'img/character/custom/hat/type1.png', 'blue cap': 'img/character/custom/hat/type2.png', 'special': 'img/character/custom/hat/type3.png', 'street cap': 'img/character/custom/hat/type4.png', 'pink cap': 'img/character/custom/hat/type5.png', 'black cap': 'img/character/custom/hat/type6.png', 'oldschool cap': 'img/character/custom/hat/type7.png', 'blue straight cap': 'img/character/custom/hat/type8.png', 'green straight cap': 'img/character/custom/hat/type9.png', 'kiddo cap': 'img/character/custom/hat/type10.png' },
    hair: {'Curly':'img/character/custom/hair/type1.png','Curly Short':'img/character/custom/hair/type2.png','Short':'img/character/custom/hair/type3.png','Plodder':'img/character/custom/hair/type4.png','"Cool Kid"':'img/character/custom/hair/type5.png','inmate':'img/character/custom/hair/type6.png','maniac':'img/character/custom/hair/type7.png','alopecia':'img/character/custom/hair/type8.png','Mrs. Robinson':'img/character/custom/hair/type9.png','Bob':'img/character/custom/hair/type10.png','Mod':'img/character/custom/hair/type11.png','hair12':'img/character/custom/hair/type12.png','hair13':'img/character/custom/hair/type13.png','hair14':'img/character/custom/hair/type14.png','hair15':'img/character/custom/hair/type15.png','hair16':'img/character/custom/hair/type16.png','hair20':'img/character/custom/hair/type20.png'},
    accessories: { 'librarian glasses': 'img/character/custom/accessories/type1.png', 'mole glasses': 'img/character/custom/accessories/type2.png', 'square glasses': 'img/character/custom/accessories/type3.png', 'black glasses': 'img/character/custom/accessories/type4.png', 'red glasses': 'img/character/custom/accessories/type5.png', '"cool" glasses': 'img/character/custom/accessories/type6.png', 'sunglasses': 'img/character/custom/accessories/type7.png', 'windsor glasses': 'img/character/custom/accessories/type8.png', 'eye patch': 'img/character/custom/accessories/type9.png'},
    beard: { 'goatee': 'img/character/custom/beard/type1.png', 'overgrown goatee': 'img/character/custom/beard/type2.png' },
    clothes: { 'white shirt': 'img/character/custom/clothes/type1.png', 'black shirt': 'img/character/custom/clothes/type2.png', 'hawaii shirt': 'img/character/custom/clothes/type3.png' },
    clothes_arm: { 'white shirt': 'img/character/custom/clothes/arm/type1.png', 'black shirt': 'img/character/custom/clothes/arm/type2.png', 'hawaii shirt': 'img/character/custom/clothes/arm/type3.png' },
    pants: { 'pants1': 'img/character/custom/pants/type1.png' },
    shoes: { 'shoes1': 'img/character/custom/shoes/type1.png' },
    items: {'rod':{path:'img/item/rod.png',width:playerSize*2,height:playerSize,pivotX_in_img:Math.round(20*(playerSize/128)),pivotY_in_round:(20*(playerSize/128))},'lantern':{path:'img/item/lantern.png',width:playerSize,height:playerSize,pivotX_in_img:playerSize/2,pivotY_in_img:playerSize/2},'float':{path:'img/item/float.png',width:32,height:62,pivotX_in_img:FLOAT_SIZE/2,pivotY_in_img:FLOAT_SIZE/2}}
};

let localPlayer = { id: null, username: 'Player' + Math.floor(Math.random()*1000), color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'), x: 50, y: DEDICATED_GAME_HEIGHT-50-playerSize, isJumping: false, velocityY: 0, isWalking: false, isIdle: false, animationFrame: 0, idleAnimationFrame: 0, direction: 1, velocityX: 0, currentMouseX: undefined, currentMouseY: undefined, customizations: { hat:'none', hair:'none', accessories:'none', beard:'none', clothes:'none', pants:'none', shoes:'none', rightHandItem:ITEM_NONE, hairSaturation:50, hairHue:180, hairBrightness:50, beardSaturation:50, beardHue:180, beardBrightness:50 }, isCasting:false, castingPower:0, fishingBarSliderPosition:0, fishingBarTime:0, castingDirectionAngle:0, hasLineCast:false, floatWorldX:null, floatWorldY:null, rodTipWorldX:null, rodTipWorldY:null, lineAnchorWorldY:null };
myUsernameSpan.textContent = localPlayer.username; myColorDisplay.style.backgroundColor = localPlayer.color;

let playersInRoom = {};
let insectsInRoom = [];
let currentRoom = null;
let keys = {};
let bobberAnimationTime = 0;
let cameraX = 0;
let cameraY = 0;
let cameraTargetX = 0;
let cameraTargetY = 0;
const CAMERA_SMOOTHING_FACTOR = 0.08;

const CAMERA_VERTICAL_BIAS = 0.4;
let isCustomizationMenuOpen = false;
const customizationCategories = [ 'hat', 'hair', 'accessories', 'beard', 'clothes', 'pants', 'shoes' ];
let selectedCategoryIndex = 0;
let localPlayerCustomizations = { hat: 'none', hair: 'none', accessories: 'none', beard: 'none', clothes: 'none', pants: 'none', shoes: 'none', rightHandItem: ITEM_NONE, hairSaturation: 100, hairHue: 0, hairBrightness: 100, beardSaturation: 100, beardHue: 0, beardBrightness: 100 };
const customizationOptions = { hat: ['none', 'red cap', 'blue cap', 'special', 'street cap', 'pink cap', 'black cap', 'oldschool cap', 'blue straight cap', 'green straight cap', 'kiddo cap'], hair: ['none', 'Curly', 'Curly Short', 'Short', 'Plodder', '"Cool Kid"', 'inmate', 'maniac', 'alopecia', 'Mrs. Robinson', 'Bob', 'Mod', 'hair12', 'hair13', 'hair14', 'hair15', 'hair16', 'hair17', 'hair18', 'hair19', 'hair20'], accessories: ['none', 'librarian glasses', 'mole glasses', 'square glasses', 'black glasses', 'red glasses', '"cool" glasses', 'sunglasses', 'windsor glasses', 'eye patch'], beard: ['none', 'goatee', 'overgrown goatee'], clothes: ['none', 'white shirt', 'black shirt', 'hawaii shirt'], pants: ['none', 'pants1'], shoes: ['none', 'shoes1'] };
let currentCustomizationOptionIndices = { hat: 0, hair: 0, accessories: 0, beard: 0, clothes: 0, pants: 0, shoes: 0 };

const MENU_WIDTH=150,MENU_TEXT_COLOR='white',MENU_HIGHLIGHT_COLOR='yellow',MENU_ITEM_HEIGHT=40,MENU_X_OFFSET_FROM_PLAYER=0,MENU_Y_OFFSET_FROM_PLAYER_TOP_CENTER_SELECTED=-40,ROLLER_VISIBLE_COUNT=3,ROLLER_ITEM_VERTICAL_SPACING=1.2*MENU_ITEM_HEIGHT,ROLLER_DIMMED_SCALE=.7,ROLLER_DIMMED_ALPHA=.3,FRAME_SIZE=186,FRAME_OFFSET_X_FROM_MENU_TEXT=30,FRAME_OSCILLATION_SPEED=.05,FRAME_ROTATION_DEGREES=5;let frameOscillationTime=0;const PIXEL_FONT='Segoe UI, monospace',DEFAULT_FONT_SIZE_USERNAME=16,DEFAULT_FONT_SIZE_MENU=24,HAIR_SATURATION_MIN=0,HAIR_SATURATION_MAX=200,HAIR_BRIGHTNESS_MIN=40,HAIR_BRIGHTNESS_MAX=200,HAIR_HUE_MIN=0,HAIR_HUE_MAX=360,BEARD_SATURATION_MIN=0,BEARD_SATURATION_MAX=200,BEARD_BRIGHTNESS_MIN=40,BEARD_BRIGHTNESS_MAX=200,BEARD_HUE_MIN=0,BEARD_HUE_MAX=360;
let customizationMenuState = 'category'; // 'category', 'value', 'color', 'adjust_value'
let selectedColorPropertyIndex = 0;
const colorProperties = ['brightness', 'saturation', 'hue'];
let lastTime = 0;

// ================= POCZĄTEK ZMIAN: Zmienne dla bali podtrzymujących pomost =================
const pierSpanImages = {};
let pierSupportData = [];
// ================= KONIEC ZMIAN =================


// ====================================================================
// === SEKCJA 2: FUNKCJE RYSOWANIA (z modyfikacjami) ===
// ====================================================================
const npcManager = new NPCManager(drawPlayer);

function mapToDisplayRange(internalValue, internalMin, internalMax) {
    if (internalMax - internalMin === 0) return 0;
    const percentage = (internalValue - internalMin) / (internalMax - internalMin);
    return Math.round(percentage * 100);
}

function mapFromDisplayRange(displayValue, internalMin, internalMax) {
    const percentage = displayValue / 100;
    return Math.round(internalMin + percentage * (internalMax - internalMin));
}

function loadImages(callback) {
    const allPaths = { ...characterImagePaths, ...customizationUIPaths, ...sliderUIPaths, ...tutorialImagePaths };
    let a = Object.keys(allPaths).length;
    for (const b in exampleCustomItemPaths.items) a++;
    for (const c in exampleCustomItemPaths) { if (c === "items") continue; for (const d in exampleCustomItemPaths[c]) a++; }
    
    // ================= POCZĄTEK ZMIAN: Dodanie ładowania grafik bali =================
    const biomeDefsForPierSpans = {
        jurassic: 'img/world/biome/jurassic/pierspan.png',
        grassland: 'img/world/biome/grassland/pierspan.png'
    };
    for (const biome in biomeDefsForPierSpans) {
        a++;
    }
    // ================= KONIEC ZMIAN =================

    if (a === 0) {
        biomeManager.loadBiomeImages(() => {
            npcManager.loadCurrentBiomeAssets(biomeManager.currentBiomeName, callback);
        });
        return;
    }
    let e = 0;
    const f = g => {
        e++;
        if (e === a) {
            biomeManager.loadBiomeImages(() => {
                npcManager.loadCurrentBiomeAssets(biomeManager.currentBiomeName, callback);
            });
        }
    };

    // ================= POCZĄTEK ZMIAN: Logika ładowania grafik bali =================
    for (const biomeName in biomeDefsForPierSpans) {
        const path = biomeDefsForPierSpans[biomeName];
        const img = new Image();
        img.src = path;
        img.onload = () => {
            pierSpanImages[biomeName] = img;
            f(img.src);
        };
        img.onerror = () => {
            console.error(`Pier span image loading error: ${img.src}`);
            f(img.src);
        };
    }
    // ================= KONIEC ZMIAN =================

    for (const h in allPaths) {
        const i = new Image;
        i.src = allPaths[h];
        i.onload = () => {
            if (characterImagePaths[h]) characterImages[h] = i;
            else if (customizationUIPaths[h] || sliderUIPaths[h]) customizationUIImages[h] = i;
            else if (tutorialImagePaths[h]) tutorialImages[h] = i;
            f(i.src)
        }, i.onerror = () => { console.error(`Image loading error: ${i.src}`), f(i.src) }
    }
    for (const j in exampleCustomItemPaths) {
        if (j === "items") continue;
        const k = exampleCustomItemPaths[j];
        for (const l in k) {
            const m = k[l],
                n = new Image;
            n.src = m, n.onload = () => { characterCustomImages[j] || (characterCustomImages[j] = {}), characterCustomImages[j][l] = n, f(n.src) }, n.onerror = () => { console.error(`Image loading error: (${j}/${l}): ${n.src}`), characterCustomImages[j] || (characterCustomImages[j] = {}), characterCustomImages[j][l] = null, f(n.src) }
        }
    }
    const o = exampleCustomItemPaths.items;
    for (const p in o) {
        const q = o[p],
            r = new Image;
        r.src = q.path, r.onload = () => { characterCustomImages.items[p] = r, f(r.src) }, r.onerror = () => { console.error(`Item Image loading error:: ${r.src}`), f(r.src) }
    }
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

const RECONCILIATION_FACTOR = 0.1;

function reconcilePlayerPosition() {
    const serverState = playersInRoom[localPlayer.id];
    if (!serverState) return;
    localPlayer.x = lerp(localPlayer.x, serverState.x, RECONCILIATION_FACTOR);
    localPlayer.y = lerp(localPlayer.y, serverState.y, RECONCILIATION_FACTOR);
    localPlayer.isJumping = serverState.isJumping;
    localPlayer.direction = serverState.direction;
    localPlayer.hasLineCast = serverState.hasLineCast;
    localPlayer.floatWorldX = serverState.floatWorldX;
    localPlayer.floatWorldY = serverState.floatWorldY;
    if (Math.abs(localPlayer.x - serverState.x) < 0.5) {
        localPlayer.x = serverState.x;
    }
    if (Math.abs(localPlayer.y - serverState.y) < 0.5) {
        localPlayer.y = serverState.y;
    }
}

function updateCamera() {
    const playerWorldCenterX = localPlayer.x + playerSize / 2;
    const playerWorldCenterY = localPlayer.y + playerSize / 2;

    const visibleWorldWidth = DEDICATED_GAME_WIDTH / currentZoomLevel;
    const visibleWorldHeight = DEDICATED_GAME_HEIGHT / currentZoomLevel;

    let targetCameraX = playerWorldCenterX - visibleWorldWidth / 2;
    if (targetCameraX < 0) {
        targetCameraX = 0;
    }
    if (targetCameraX > currentWorldWidth - visibleWorldWidth) {
        targetCameraX = currentWorldWidth - visibleWorldWidth;
    }
    if (currentWorldWidth < visibleWorldWidth) {
        targetCameraX = (currentWorldWidth / 2) - (visibleWorldWidth / 2);
    }

    const verticalOffset = visibleWorldHeight * (CAMERA_VERTICAL_BIAS - 0.5);
    let targetCameraY = (playerWorldCenterY + verticalOffset) - (visibleWorldHeight / 2);

    if (targetCameraY < 0) {
        targetCameraY = 0;
    }
    if (targetCameraY > DEDICATED_GAME_HEIGHT - visibleWorldHeight) {
        targetCameraY = DEDICATED_GAME_HEIGHT - visibleWorldHeight;
    }
    if (DEDICATED_GAME_HEIGHT < visibleWorldHeight) {
        targetCameraY = (DEDICATED_GAME_HEIGHT / 2) - (visibleWorldHeight / 2);
    }

    cameraX = lerp(cameraX, targetCameraX, CAMERA_SMOOTHING_FACTOR);
    cameraY = lerp(cameraY, targetCameraY, 1);

    biomeManager.drawParallaxBackground(ctx, cameraX, visibleWorldWidth);
    if (currentRoom && currentRoom.gameData && currentRoom.gameData.biome) {
        const biomeName = currentRoom.gameData.biome;
        const groundLevel = currentRoom.gameData.groundLevel;
        biomeManager.drawBackgroundBiomeGround(ctx, biomeName, groundLevel);
        biomeManager.drawBackgroundTrees(ctx);
        biomeManager.drawBackgroundPlants(ctx);
        biomeManager.drawForegroundBiomeGround(ctx, biomeName, groundLevel);
        biomeManager.drawBuildings(ctx, groundLevel, cameraX, DEDICATED_GAME_WIDTH / currentZoomLevel);
    }
}
function drawFilteredCharacterPart(a,b,c,d,e,f,g=100,h=0,i=100){if(!b||!b.complete)return;const j=document.createElement("canvas");j.width=e,j.height=f;const k=j.getContext("2d");k.imageSmoothingEnabled=!1,k.drawImage(b,0,0,e,f);const l=[];100!==g&&l.push(`saturate(${g}%)`),0!==h&&l.push(`hue-rotate(${h}deg)`),100!==i&&l.push(`brightness(${i}%)`),l.length>0?(a.save(),a.filter=l.join(" "),a.drawImage(j,c,d,e,f),a.restore()):a.drawImage(j,c,d,e,f)}


// ================= POCZĄTEK ZMIAN: Nowa funkcja do rysowania bali pod pomostem =================
function drawPierSupports(ctx) {
    if (!pierSupportData || pierSupportData.length === 0 || !currentRoom || !currentRoom.gameData) return;

    const biomeName = currentRoom.gameData.biome;
    const supportImage = pierSpanImages[biomeName];

    if (!supportImage || !supportImage.complete) return;

    const PILE_GFX_WIDTH = 32;
    const PILE_GFX_HEIGHT = 128;
    const SCALED_TILE_SIZE = 32*4; // Wartość z biomeManager (32 * 3.75)
    const scaledPierGfxHeight = SCALED_TILE_SIZE; // Wysokość grafiki pomostu

    pierSupportData.forEach((pierData, pierIndex) => {
        // Upewniamy się, że mamy dostęp do oryginalnych danych pomostu w biomeManager
        if (pierIndex >= biomeManager.placedPiers.length) return;
        const originalPier = biomeManager.placedPiers[pierIndex];
        if (!originalPier) return;

        pierData.sections.forEach((sectionData, sectionIndex) => {
            const sectionBaseX = originalPier.x + sectionIndex * SCALED_TILE_SIZE;

            // Obliczenia Y na podstawie logiki rysowania z biomeManager.drawPiers
            const pierPlankTopY = originalPier.y - scaledPierGfxHeight + 116;
            const PIER_PLANK_THICKNESS = 20; // Założona grubość deski pomostu
            const pileStartY = pierPlankTopY + PIER_PLANK_THICKNESS;

            sectionData.piles.forEach(pile => {
                const renderWidth = PILE_GFX_WIDTH * pile.scale;
                const renderHeight = PILE_GFX_HEIGHT * pile.scale;
                const pileDrawX = sectionBaseX + pile.x;

                ctx.save();
                // Przesuwamy punkt odniesienia do górnej-środkowej krawędzi bala, aby rotacja działała poprawnie
                ctx.translate(pileDrawX + renderWidth / 2, pileStartY);
                ctx.rotate(pile.rotation);

                ctx.drawImage(
                    supportImage,
                    0, 0, // source x, y
                    PILE_GFX_WIDTH, PILE_GFX_HEIGHT, // source w, h
                    -renderWidth / 2, 0, // rysuj względem nowego punktu (0,0)
                    renderWidth*2.5, renderHeight*2.5 // draw w, h
                );

                ctx.restore();
            });
        });
    });
}
// ================= KONIEC ZMIAN =================


// ZMODYFIKOWANA FUNKCJA
function drawPlayer(p, imageSet = characterImages) {
    // Sprawdzenie czy podstawowe assety (z przekazanego zestawu) są załadowane
    if (!imageSet.body || !imageSet.body.complete) {
        // Fallback, jeśli obrazki się nie załadują (np. dla NPC)
        if (p.color) { // Gracze mają kolor, NPC nie
             ctx.fillStyle = p.color;
             ctx.fillRect(p.x, p.y, playerSize, playerSize);
        }
        return;
    }
    ctx.save();
    let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0;
    const i = (Number(p.animationFrame || 0) % animationCycleLength) / animationCycleLength,
        j = (Number(p.idleAnimationFrame || 0) % IDLE_ANIM_CYCLE_LENGTH) / IDLE_ANIM_CYCLE_LENGTH,
        k = p.isWalking === !0,
        l = p.isIdle === !0,
        m = p.isJumping === !0;
    let n = 0;
    const o = p.x,
        q = p.y;
    let r = 0,
        s = 0;
    if (p.id === localPlayer.id && void 0 !== localPlayer.currentMouseX) {
        const t = localPlayer.currentMouseX,
            u = localPlayer.currentMouseY,
            v = o + headPivotInImageX,
            w = q + (headInitialOffsetY + headPivotInImageY),
            x = (t - v) * p.direction,
            y = u - w,
            z = Math.sqrt(x * x + y * y);
        if (z > 0) {
            const A = x / z,
                B = y / z;
            r = A * Math.min(z, eyeMaxMovementRadius), s = B * Math.min(z, eyeMaxMovementRadius)
        }
    }
    if (k && !m) n = Math.sin(2 * i * Math.PI), a = -bodyHeadPulseAmount * Math.abs(n), b = n * armRotationAngle, c = -b, d = n * legRotationAngle, e = -d, f = n * headRotationAngleAmount, g = Math.sin(4 * i * Math.PI) * bodyHeadPulseAmount * headOscillationAmplitudeFactor;
    else if (l && !m) n = Math.sin(2 * j * Math.PI), a = -IDLE_BODY_HEAD_PULSE_AMOUNT * Math.abs(n), b = n * IDLE_ARM_ROTATION_ANGLE, c = -b, d = 0, e = 0, f = n * IDLE_HEAD_ROTATION_ANGLE_AMOUNT, g = Math.sin(4 * j * Math.PI) * IDLE_BODY_HEAD_PULSE_AMOUNT * IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR;
    else if (m) {
        const C = 18,
            D = 54;
        p.velocityY > 0 ? h = JUMP_BODY_TILT_ANGLE * (1 - Math.min(1, Math.max(0, p.velocityY / C))) : h = JUMP_BODY_TILT_ANGLE * (1 - Math.min(1, Math.max(0, Math.abs(p.velocityY) / D)));
        const E = Math.min(1, Math.abs(p.velocityY) / Math.max(C, D));
        d = -E * JUMP_LEG_OPPOSITE_ROTATION_ANGLE, e = E * JUMP_LEG_WAVE_ANGLE, b = E * JUMP_ARM_WAVE_ANGLE, c = -.7 * b, f = .5 * h, g = 0, a = 0
    }
    ctx.translate(o + playerSize / 2, q + playerSize / 2), ctx.scale(p.direction, 1), m && ctx.rotate(h * p.direction), ctx.translate(-(o + playerSize / 2), -(q + playerSize / 2));

    function t(a, b, c, d, e, f = 0, g = playerSize, h = playerSize) {
        if (!a || !a.complete) return;
        ctx.save();
        const i = o + b,
            j = q + c;
        ctx.translate(i + d, j + e), ctx.rotate(f), ctx.drawImage(a, -d, -e, g, h), ctx.restore()
    }

    const v = p.customizations || {};
    const playerClothes = v.clothes;

    t(imageSet.leg, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, e);
    t(imageSet.arm, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, c);
    
    if (playerClothes && "none" !== playerClothes) {
        const clothesArmImage = characterCustomImages.clothes_arm[playerClothes];
        if (clothesArmImage && clothesArmImage.complete) {
            t(clothesArmImage, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, c);
        }
    }

    t(imageSet.leg, frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, d);
    
    ctx.drawImage(imageSet.body, o, q + a, playerSize, playerSize);

    if (playerClothes && "none" !== playerClothes) {
        const clothesImage = characterCustomImages.clothes[playerClothes];
        if (clothesImage && clothesImage.complete) {
            ctx.drawImage(clothesImage, o, q + a, playerSize, playerSize);
        }
    }

    const u = headInitialOffsetY + a + g;
    t(imageSet.head, 0, u, headPivotInImageX, headPivotInImageY, f);
    t(imageSet.eye, LEFT_EYE_BASE_X_REL_HEAD_TL + r, u + EYE_BASE_Y_REL_HEAD_TL + s, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);
    t(imageSet.eye, RIGHT_EYE_BASE_X_REL_HEAD_TL + r, u + EYE_BASE_Y_REL_HEAD_TL + s, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);

    const accessories = v.accessories;
    if (accessories && "none" !== accessories) {
        const accessoriesImage = characterCustomImages.accessories[accessories];
        if (accessoriesImage && accessoriesImage.complete) {
            ctx.save();
            ctx.translate(o + headPivotInImageX, q + u + headPivotInImageY);
            ctx.rotate(f);
            ctx.drawImage(accessoriesImage, -headPivotInImageX, -headPivotInImageY, playerSize, playerSize);
            ctx.restore();
        }
    }

    const w = v.hair;
    if (w && "none" !== w) {
        const x = characterCustomImages.hair[w];
        x && x.complete && (ctx.save(), ctx.translate(o + headPivotInImageX, q + u + HAIR_VERTICAL_OFFSET + headPivotInImageY - HAIR_VERTICAL_OFFSET), ctx.rotate(f), drawFilteredCharacterPart(ctx, x, -headPivotInImageX, -(headPivotInImageY - HAIR_VERTICAL_OFFSET), playerSize, playerSize, v.hairSaturation, v.hairHue, v.hairBrightness), ctx.restore())
    }
    
    const y = v.beard;
    if (y && "none" !== y) {
        const z = characterCustomImages.beard[y];
        if (z && z.complete) {
            ctx.save();
            ctx.translate(o + headPivotInImageX, q + u + BEARD_VERTICAL_OFFSET + headPivotInImageY - BEARD_VERTICAL_OFFSET);
            ctx.rotate(f);
            drawFilteredCharacterPart(ctx, z, -headPivotInImageX, -(headPivotInImageY - BEARD_VERTICAL_OFFSET), playerSize, playerSize, v.beardSaturation, v.beardHue, v.beardBrightness);
            ctx.restore();
        }
    }

    const B = v.hat;
    if (B && "none" !== B) {
        const C = characterCustomImages.hat[B];
        C && C.complete && t(C, 0, u - Math.round(20 * (playerSize / 32)) + 44, headPivotInImageX, headPivotInImageY - 44 - -Math.round(20 * (playerSize / 32)), f, playerSize, playerSize)
    }

    const D = v.rightHandItem;
    if (D && D !== ITEM_NONE) {
        const E = exampleCustomItemPaths.items[D],
            F = characterCustomImages.items[D];
        E && F && F.complete && t(F, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, b, E.width, E.height)
    }

    t(imageSet.arm, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, b);
    
    if (playerClothes && "none" !== playerClothes) {
        const clothesArmImage = characterCustomImages.clothes_arm[playerClothes];
        if (clothesArmImage && clothesArmImage.complete) {
            t(clothesArmImage, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, b);
        }
    }

    ctx.restore();

    // Rysowanie nazwy użytkownika tylko dla graczy, a nie dla NPC
    if (p.username) {
        p.customizations && p.customizations.rightHandItem === ITEM_ROD ? (p.rodTipWorldX = p.x + playerSize / 2 + (frontArmOffsetX + originalArmPivotInImageX - playerSize / 2) * p.direction + (ROD_TIP_OFFSET_X * Math.cos(b) - ROD_TIP_OFFSET_Y * Math.sin(b)) * p.direction, p.rodTipWorldY = p.y + playerSize / 2 + (0 + originalArmPivotInImageY - playerSize / 2) + (ROD_TIP_OFFSET_X * Math.sin(b) + ROD_TIP_OFFSET_Y * Math.cos(b)), p.id === localPlayer.id && (localPlayer.rodTipWorldX = p.rodTipWorldX, localPlayer.rodTipWorldY = p.rodTipWorldY)) : (p.rodTipWorldX = null, p.rodTipWorldY = null, p.id === localPlayer.id && (localPlayer.rodTipWorldX = null, localPlayer.rodTipWorldY = null)), ctx.fillStyle = "white", ctx.font = `${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`, ctx.textAlign = "center", ctx.fillText(p.username || p.id.substring(0, 5), p.x + playerSize / 2, p.y - 10 + a)
    }
}


function drawCustomizationMenu() {
    const ROLLER_X_OFFSET_FROM_PLAYER = playerSize * currentZoomLevel * 1.5;
    const ROLLER_Y_OFFSET = -playerSize * currentZoomLevel * 0.5;
    const ROLLER_ITEM_SPACING = 50;
    const ALPHAS = [0.2, 0.5, 1, 0.5, 0.2];
    const FONT_SIZES = [16, 20, 24, 20, 16];

    const playerScreenX = (localPlayer.x - cameraX) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;

    const menuX = playerScreenX + (playerSize / 2) * currentZoomLevel + ROLLER_X_OFFSET_FROM_PLAYER;
    const menuY = playerScreenY + (playerSize / 2) * currentZoomLevel + ROLLER_Y_OFFSET;
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (customizationMenuState === 'adjust_value') {
        const category = customizationCategories[selectedCategoryIndex];
        const property = colorProperties[selectedColorPropertyIndex];
        const propertyCapitalized = property.charAt(0).toUpperCase() + property.slice(1);
        const key = category + propertyCapitalized;
        
        let currentDisplayValue, minDisplay, maxDisplay, internalMin, internalMax;

        if (property === 'hue') {
            currentDisplayValue = localPlayer.customizations[key];
            minDisplay = HAIR_HUE_MIN;
            maxDisplay = HAIR_HUE_MAX;
        } else {
            internalMin = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MIN : HAIR_SATURATION_MIN) : (property === 'brightness' ? BEARD_BRIGHTNESS_MIN : BEARD_SATURATION_MIN));
            internalMax = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MAX : HAIR_SATURATION_MAX) : (property === 'brightness' ? BEARD_BRIGHTNESS_MAX : BEARD_SATURATION_MAX));
            currentDisplayValue = mapToDisplayRange(localPlayer.customizations[key], internalMin, internalMax);
            minDisplay = 0;
            maxDisplay = 100;
        }

        const valuesToShow = [];
        if (currentDisplayValue > minDisplay) valuesToShow.push(currentDisplayValue - 1);
        else valuesToShow.push(null);

        valuesToShow.push(currentDisplayValue);
        
        if (currentDisplayValue < maxDisplay) valuesToShow.push(currentDisplayValue + 1);
        else valuesToShow.push(null);

        for (let i = -1; i <= 1; i++) {
            const value = valuesToShow[i + 1];
            if (value === null) continue;

            const text = String(value);
            const yPos = menuY + i * ROLLER_ITEM_SPACING;
            
            const isCenter = (i === 0);
            const alpha = isCenter ? ALPHAS[2] : ALPHAS[1];
            const fontSize = isCenter ? FONT_SIZES[2] : FONT_SIZES[1];

            ctx.fillStyle = isCenter ? `rgba(255, 255, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
            ctx.font = `${fontSize}px ${PIXEL_FONT}`;
            ctx.fillText(text, menuX, yPos);
        }

    } else { 
        let listToDraw;
        let selectedIndex;

        if (customizationMenuState === 'category') {
            listToDraw = customizationCategories;
            selectedIndex = selectedCategoryIndex;
        } else if (customizationMenuState === 'value') {
            const currentCategory = customizationCategories[selectedCategoryIndex];
            listToDraw = customizationOptions[currentCategory];
            selectedIndex = currentCustomizationOptionIndices[currentCategory];
        } else {
            listToDraw = colorProperties;
            selectedIndex = selectedColorPropertyIndex;
        }

        const displayRange = 2;
        for (let i = -displayRange; i <= displayRange; i++) {
            let itemIndex = (selectedIndex + i + listToDraw.length) % listToDraw.length;
            const text = listToDraw[itemIndex].toUpperCase();
            const yPos = menuY + i * ROLLER_ITEM_SPACING;
            const focusIndex = i + displayRange;
            const alpha = ALPHAS[focusIndex];
            const fontSize = FONT_SIZES[focusIndex];

            ctx.fillStyle = (i === 0) ? `rgba(255, 255, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
            ctx.font = `${fontSize}px ${PIXEL_FONT}`;
            ctx.fillText(text, menuX, yPos);
        }
    }
    ctx.restore();
}

function drawFishingBar(p) {
    const barScreenX = DEDICATED_GAME_WIDTH / 2 - FISHING_BAR_WIDTH / 2;
    const barScreenY = DEDICATED_GAME_HEIGHT - 100;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barScreenX, barScreenY, FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT);
    const powerWidth = p.castingPower * FISHING_BAR_WIDTH;
    ctx.fillStyle = `hsl(${120 * (1 - p.castingPower)}, 100%, 50%)`;
    ctx.fillRect(barScreenX, barScreenY, powerWidth, FISHING_BAR_HEIGHT);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(barScreenX, barScreenY, FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT);
    ctx.restore();
}

function drawFishingLine(p) {
    if (!p.hasLineCast || p.rodTipWorldX === null || p.floatWorldX === null) {
        return;
    }
    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);
    ctx.strokeStyle = '#ffffff99';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
    ctx.lineTo(p.floatWorldX, p.floatWorldY+24);
    ctx.stroke();
    const floatImage = characterCustomImages.items.float;
    if (floatImage && floatImage.complete) {
        bobberAnimationTime += BOBBER_ANIMATION_SPEED;
        const verticalOffset = Math.sin(bobberAnimationTime) * BOBBER_VERTICAL_OSCILLATION;
        ctx.drawImage(floatImage, p.floatWorldX - FLOAT_SIZE / 2, p.floatWorldY - FLOAT_SIZE / 2 + verticalOffset, FLOAT_SIZE, FLOAT_SIZE * 2);
    } else {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(p.floatWorldX, p.floatWorldY, 10, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// ================= POCZĄTEK ZMIAN: Rozbudowany Helper (Samouczek) =================
/**
 * Rysuje pojedynczą grafikę samouczka z uwzględnieniem animacji.
 * Ta funkcja jest wywoływana z pętli głównej i rysuje TYLKO na lokalnym canvasie.
 * @param {object} imageInfo - Obiekt z informacjami o grafice do narysowania.
 */
function drawSingleTutorialImage(imageInfo) {
    if (!imageInfo) return;

    const image = tutorialImages[imageInfo.key];
    if (!image || !image.complete) return;

    const playerScreenX = (localPlayer.x - cameraX + playerSize / 2) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;

    const drawWidth = image.width * TUTORIAL_IMAGE_SCALE;
    const drawHeight = image.height * TUTORIAL_IMAGE_SCALE;

    const x = playerScreenX - drawWidth / 2;
    const y = playerScreenY + TUTORIAL_Y_OFFSET - drawHeight + imageInfo.yOffset;

    const rockingAngle = Math.sin(Date.now() / 1000 * TUTORIAL_ROCKING_SPEED) * (TUTORIAL_ROCKING_ANGLE_DEGREES * Math.PI / 180);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = imageInfo.alpha; // Ustaw przezroczystość

    ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
    ctx.rotate(rockingAngle);

    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
}


/**
 * Główna funkcja rysująca samouczek, która obsługuje wiele obrazków naraz (dla płynnych przejść).
 */
function drawTutorialHelper() {
    if (tutorial.state === 'finished') return;

    // Rysuj obrazek, który znika
    drawSingleTutorialImage(tutorial.fadingOutImage);
    // Rysuj obrazek, który jest aktywny (lub właśnie się pojawia)
    drawSingleTutorialImage(tutorial.activeImage);
}
// ================= KONIEC ZMIAN =================

function drawInsects() {
    const insectImage = biomeManager.getCurrentInsectImage();
    if (!insectImage || !insectImage.complete) return;
    const INSECT_TILE_SIZE = 32;
    const INSECT_ANIMATION_SPEED_TICKS = 8;
    const renderedSize = INSECT_TILE_SIZE * INSECT_SCALE_FACTOR;
    for (const insect of insectsInRoom) {
        const currentFrame = Math.floor((insect.animationFrame || 0) / INSECT_ANIMATION_SPEED_TICKS);
        const sourceX = currentFrame * INSECT_TILE_SIZE;
        const sourceY = (insect.typeIndex || 0) * INSECT_TILE_SIZE;
        const angleInRadians = (insect.angle || 0) * (Math.PI / 180);
        ctx.save();
        ctx.translate(insect.x + renderedSize / 2, insect.y + renderedSize / 2);
        ctx.rotate(angleInRadians);
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
        ctx.restore();
    }
}

// ====================================================================
// === SEKCJA 3: LOGIKA SIECIOWA (bez zmian) ===
// ====================================================================

function initializeSignaling() {
    signalingSocket = io();
    signalingSocket.on('connect', () => console.log('Connected to the signaling server.', signalingSocket.id));
    signalingSocket.on('roomListUpdate', (hosts) => {
        availableRooms = hosts;
        if (!currentRoom) {
            roomListUl.innerHTML = '';
            if (Object.keys(hosts).length === 0) {
                roomListUl.innerHTML = '<li>Brak dostępnych pokoi. Stwórz jeden!</li>';
            } else {
                for (let peerId in hosts) {
                    const room = hosts[peerId];
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${room.name} (Players: ${room.playerCount})</span><button data-peer-id="${peerId}">Dołącz</button>`;
                    li.querySelector('button').addEventListener('click', () => joinRoom(peerId));
                    roomListUl.appendChild(li);
                }
            }
        }
    });
    signalingSocket.on('roomRemoved', (removedRoomId) => {
        if (hostConnection && hostConnection.peer === removedRoomId) {
            alert('Pokój, w którym byłeś, został usunięty!');
            leaveCurrentRoomUI();
        }
    });
}


function initializePeer(callback) {
    if (peer && !peer.destroyed) {
        return callback(peer.id);
    }
    const peerConfig = {
    debug: 3,
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject"
            },
            {
                urls: "turn:openrelay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject"
            }
        ]
    }
};

peer = new Peer(undefined, peerConfig);

    peer.on('open', (id) => {
        console.log('My ID in the P2P network (from the PeerJS cloud server): ' + id);
        if (callback) callback(id);
    });

    peer.on('error', (err) => {
    console.error("MAIN PEER OBJECT ERROR: ", err);
    alert("A fatal PeerJS error occurred. Check the console. Error type: " + err.type);
});

peer.on('disconnected', () => {
    console.warn(`PEERJS: Disconnected from PeerJS broker server. I'm trying to reconnect...`);
});

peer.on('close', () => {
    console.error(`PEERJS: The connection to the broker server has been permanently closed. New connections cannot be made.`);
});
}
function onSuccessfulJoin(roomData, hostPeerId = null) {
    if (!roomData || !roomData.name) {
        if (hostPeerId && availableRooms[hostPeerId] && availableRooms[hostPeerId].name) {
            roomData = roomData || {};
            roomData.name = availableRooms[hostPeerId].name;
            console.log(`[INFO] The room name was empty, I'm using the name from the lobby list: ${roomData.name}`);
        } else {
            console.warn(`[WARN] Failed to determine room name. Room details: `, roomData);
            roomData = roomData || {};
            roomData.name = "Undefined room";
        }
    }

    currentRoom = roomData;
    playersInRoom = roomData.playersInRoom;

    if (roomData.gameData) {
        currentWorldWidth = roomData.gameData.worldWidth;
        biomeManager.worldWidth = currentWorldWidth;
        
        // Zmiana: Ładuj assety NPC dla nowego biomu i dopiero potem spawnuj NPC
        npcManager.loadCurrentBiomeAssets(roomData.gameData.biome, () => {
            npcManager.spawnNPCs(roomData.gameData);
        });
        
        biomeManager.setBiome(roomData.gameData.biome);
        biomeManager.setVillageData(roomData.gameData.villageType, roomData.gameData.villageXPosition, roomData.gameData.placedBuildings);
        biomeManager.initializeGroundPlants(roomData.gameData.groundPlants || []);
        biomeManager.initializeTrees(roomData.gameData.trees || []);
        
        if (biomeManager.initializePiers) {
            biomeManager.initializePiers(roomData.gameData.piers || []);
        }

        // ================= POCZĄTEK ZMIAN: Generowanie danych dla bali podtrzymujących =================
        pierSupportData = []; // Wyczyść stare dane
        const serverPiers = roomData.gameData.piers || [];
        const SCALED_TILE_SIZE = 120; // 32 * 3.75, wartość z biomeManager

        serverPiers.forEach(pier => {
            const newPierSupport = {
                sections: []
            };

            // --- POCZĄTEK POPRAWKI ---
            // Zmieniamy pętlę tak, aby iterowała po wszystkich sekcjach Z WYJĄTKIEM OSTATNIEJ.
            // Warunek "i < pier.sections.length - 1" sprawia, że dla ostatniej sekcji
            // kod generujący filary w ogóle się nie wykona.
            for (let i = 0; i < pier.sections.length - 1; i++) {
                const piles = [];
                const sectionWidth = SCALED_TILE_SIZE;
                const PILE_GFX_WIDTH = 32;
                const PILE_RENDER_SCALE = 1.5;
                const PILE_RENDER_WIDTH = PILE_GFX_WIDTH * PILE_RENDER_SCALE;
                const margin = 25; 
                const maxStartPosition = sectionWidth - PILE_RENDER_WIDTH - margin;
                const pileX = margin + Math.random() * (maxStartPosition - margin);
                const rotation = (Math.random() * 16 - 8) * (Math.PI / 180);
                
                piles.push({ x: pileX, rotation: rotation, scale: PILE_RENDER_SCALE });
                
                newPierSupport.sections.push({ piles: piles });
            }
            // --- KONIEC POPRAWKI ---

            pierSupportData.push(newPierSupport);
        });
        // ================= KONIEC ZMIAN =================
        
        insectsInRoom = roomData.gameData.insects || [];
    }

    const myId = peer ? peer.id : null;
    if (myId && playersInRoom[myId]) {
        const serverPlayerState = playersInRoom[myId];
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
                if (index !== -1) currentCustomizationOptionIndices[category] = index;
            }
        }
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
    console.log(`Successfully joined the room: "${currentRoom.name}"`);
}


// ====================================================================
// === SEKCJA 4: GŁÓWNA PĘTLA GRY I KOMUNIKACJA (z modyfikacjami) ===
// ====================================================================

// ================= POCZĄTEK ZMIAN: Rozbudowany Helper (Samouczek) =================
/**
 * Aktualizuje stan animacji dla grafik samouczka (fade in/out).
 */
function updateTutorialAnimations() {
    if (tutorial.state === 'finished') return;

    const now = Date.now();

    // Aktualizuj animację znikania
    if (tutorial.fadingOutImage) {
        const elapsed = now - tutorial.fadingOutImage.startTime;
        if (elapsed >= TUTORIAL_FADE_DURATION_MS) {
            tutorial.fadingOutImage = null; // Animacja zakończona
        } else {
            const progress = elapsed / TUTORIAL_FADE_DURATION_MS;
            tutorial.fadingOutImage.alpha = 1 - progress;
            tutorial.fadingOutImage.yOffset = -TUTORIAL_FADE_UP_DISTANCE * progress;
        }
    }

    // Aktualizuj animację pojawiania się
    if (tutorial.activeImage) {
        const elapsed = now - tutorial.activeImage.startTime;
        if (elapsed < TUTORIAL_FADE_DURATION_MS) {
            const progress = elapsed / TUTORIAL_FADE_DURATION_MS;
            tutorial.activeImage.alpha = progress;
        } else {
            tutorial.activeImage.alpha = 1; // Upewnij się, że jest w pełni widoczny po zakończeniu
        }
    }
}
// ================= KONIEC ZMIAN =================

function sendPlayerInput() {
    const isPlayerInputLocked = isCustomizationMenuOpen;
    const inputPayload = {
        keys: isPlayerInputLocked ? {} : keys,
        currentMouseX: localPlayer.currentMouseX,
        currentMouseY: localPlayer.currentMouseY,
    };

    if (hostConnection) {
        hostConnection.send({ type: 'playerInput', payload: inputPayload });
    }
}

function sendPlayerAction(type, payload = {}) {
    const actionPayload = { type, payload };

    if (hostConnection) {
        hostConnection.send({ type: 'playerAction', payload: actionPayload });
    }
}

function gameLoop(currentTime) {
    function updateLocalPlayerMovement() {
    const PLAYER_WALK_SPEED = 5;
    const DECELERATION_FACTOR = 0.9;
    const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.1;

    let targetVelocityX = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) {
        targetVelocityX = -PLAYER_WALK_SPEED;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        targetVelocityX = PLAYER_WALK_SPEED;
    }
    localPlayer.velocityX = targetVelocityX !== 0 ? targetVelocityX : localPlayer.velocityX * DECELERATION_FACTOR;
    if (Math.abs(localPlayer.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) {
        localPlayer.velocityX = 0;
    }
    localPlayer.x += localPlayer.velocityX;
    localPlayer.x = Math.max(0, Math.min(currentWorldWidth - playerSize, localPlayer.x));
}

    if (!lastTime) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    if (currentRoom === null) {
        requestAnimationFrame(gameLoop);
        return;
    }

    if (insectsInRoom.length > 0 && currentRoom.gameData) {
        const worldWidth = currentRoom.gameData.worldWidth || 0;
        insectsInRoom.forEach(insect => {
             const time = (Date.now() / 1000) + (insect.timeOffset || 0);
             insect.anchorX += (insect.drift || 0);
             if (insect.anchorX < 0 || insect.anchorX > worldWidth) insect.drift *= -1;
             insect.x = (insect.anchorX || 0) + Math.sin(time * (insect.hSpeed || 1)) * (insect.hAmp || 100);
             insect.y = (insect.baseY || 500) + Math.cos(time * (insect.vSpeed || 1)) * (insect.vAmp || 80);
             insect.angle = Math.cos(time * (insect.hSpeed || 1)) * (insect.hAmp || 100) * (insect.hSpeed || 1) * 0.5;
             insect.animationFrame = ((insect.animationFrame || 0) + 1) % 16;
        });
    }

    if (Object.keys(playersInRoom).length > 0 && currentRoom.gameData) {
        const PLAYER_WALK_SPEED = 5;
        const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.1;
        const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - currentRoom.gameData.groundLevel - playerSize;
        for (const id in playersInRoom) {
            const p = playersInRoom[id];
            const isOnGround = (p.y >= groundY_target_for_player_top - 1 && p.y <= groundY_target_for_player_top + 1);
            p.isWalking = Math.abs(p.velocityX || 0) > MIN_VELOCITY_FOR_WALK_ANIMATION && isOnGround;
            const isStationaryHorizontal = Math.abs(p.velocityX || 0) < MIN_VELOCITY_FOR_WALK_ANIMATION;
            p.isIdle = !p.isWalking && !p.isJumping && isStationaryHorizontal && isOnGround;
            if (p.isWalking) {
                 const speedFactor = Math.abs((p.velocityX || 0) / PLAYER_WALK_SPEED);
                 p.animationFrame = ((p.animationFrame || 0) + (1 * speedFactor)) % animationCycleLength;
                 p.idleAnimationFrame = 0;
             } else if (p.isIdle) {
                 p.animationFrame = 0;
                 p.idleAnimationFrame = ((p.idleAnimationFrame || 0) + 1) % IDLE_ANIM_CYCLE_LENGTH;
             } else {
                 p.animationFrame = 0; p.idleAnimationFrame = 0;
             }
        }
    }

    bobberAnimationTime += BOBBER_ANIMATION_SPEED;
    biomeManager.updateAnimations(deltaTime);
    
    // Aktualizacja NPC
    npcManager.update(deltaTime);
    
    updateTutorialAnimations();

    sendPlayerInput();
    updateLocalPlayerMovement();
    reconcilePlayerPosition();
    updateCamera();
    if (localPlayer.isCasting) {
        localPlayer.fishingBarTime += FISHING_SLIDER_SPEED;
        localPlayer.fishingBarSliderPosition = (Math.sin(localPlayer.fishingBarTime) + 1) / 2;
        localPlayer.castingPower = localPlayer.fishingBarSliderPosition;
    }

    ctx.clearRect(0, 0, DEDICATED_GAME_WIDTH, DEDICATED_GAME_HEIGHT);
    biomeManager.drawBackground(ctx);
    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);

    biomeManager.drawParallaxBackground(ctx, cameraX, cameraY, DEDICATED_GAME_WIDTH / currentZoomLevel);

    if (currentRoom?.gameData?.biome) {
        const { biome: b, groundLevel: g } = currentRoom.gameData;
        biomeManager.drawBackgroundBiomeGround(ctx,b,g); biomeManager.drawBackgroundTrees(ctx); biomeManager.drawBackgroundPlants(ctx); biomeManager.drawBuildings(ctx,g,cameraX,DEDICATED_GAME_WIDTH/currentZoomLevel);
    }

    // Połącz graczy i NPC w jedną listę do sortowania i rysowania
    const allCharacters = [...Object.values(playersInRoom), ...npcManager.npcs];
    allCharacters.sort((a,b)=>(a.y+playerSize)-(b.y+playerSize)).forEach(p => {
        if (p.username) { // To jest gracz
            drawPlayer(p);
        } else { // To jest NPC
            npcManager.drawPlayer(p, npcManager.npcAssets);
        }
    });

    if(currentRoom?.gameData?.biome){const {biome:b,groundLevel:g}=currentRoom.gameData;biomeManager.drawForegroundPlants(ctx);biomeManager.drawForegroundTrees(ctx);;drawInsects();biomeManager.drawForegroundBiomeGround(ctx,b,g);
    
    // ================= POCZĄTEK ZMIAN: Rysowanie bali i pomostów w odpowiedniej kolejności =================
    // Rysujemy najpierw bale, aby znalazły się pod pomostem.
    drawPierSupports(ctx);

    if (biomeManager.drawPiers) {
        biomeManager.drawPiers(ctx);
    }
    // ================= KONIEC ZMIAN =================
    
    biomeManager.drawWater(ctx,b,cameraX)}

    ctx.restore();for(const id in playersInRoom) drawFishingLine(playersInRoom[id]);

    drawTutorialHelper();
    if(isCustomizationMenuOpen) drawCustomizationMenu();
    if(localPlayer.isCasting) drawFishingBar(localPlayer);

    requestAnimationFrame(gameLoop);
}

// ====================================================================
// === SEKCJA 5: OBSŁUGA UI i P2P (bez zmian) ===
// ====================================================================

createRoomBtn.addEventListener('click', () => {
    if (isHost) return;
    isHost = true;
    createRoomBtn.disabled = true;
    newRoomNameInput.disabled = true;

    initializePeer((peerId) => {
        if (!peerId) {
            console.error("Failed to obtain Peer ID. Unable to create room.");
            alert("Network error, unable to create room.");
            isHost = false;
            createRoomBtn.disabled = false;
            newRoomNameInput.disabled = false;
            return;
        }

        console.log(`Peer ID obtained: ${peerId}. Initializing the game host...`);
        localPlayer.id = peerId;

        gameHostInstance = new GameHost();
        const roomConfig = gameHostInstance.start({ id: peerId, username: localPlayer.username, color: localPlayer.color, customizations: localPlayer.customizations });
        hostRoomConfiguration = roomConfig;

        signalingSocket.emit('register-host', {
            peerId,
            name: newRoomNameInput.value.trim() || roomConfig.name,
            biome: roomConfig.gameData.biome,
            worldWidth: roomConfig.gameData.worldWidth,
            villageType: roomConfig.gameData.villageType
        });

        peer.on('connection', (conn) => {
            conn.on('open', () => {
                conn.on('data', (data) => {
                    if (data.type === 'requestJoin') {
                        gameHostInstance.addPlayer(conn, data.payload);

                        if (hostRoomConfiguration) {
                            const roomDataToSend = {
                                name: hostRoomConfiguration.name,
                                playersInRoom: playersInRoom,
                                gameData: hostRoomConfiguration.gameData
                            };
                            conn.send({ type: 'roomJoined', payload: roomDataToSend });
                        } else {
                            console.error("Host: Unable to send roomJoined - hostRoomConfiguration missing!");
                        }
                        signalingSocket.emit('notify-join', peerId);
                    }
                    else if (data.type === 'playerInput') { gameHostInstance.handlePlayerInput(conn.peer, data.payload); }
                    else if (data.type === 'playerAction') { gameHostInstance.handlePlayerAction(conn.peer, data.payload); }
                });
            });
            conn.on('close', () => { gameHostInstance.removePlayer(conn.peer); signalingSocket.emit('notify-leave', peerId); });
        });

        console.log(`[HOST] Background server running. Room "${roomConfig.name}" is now visible in the lobby.`);
    });
});

function joinRoom(hostPeerId) {
    initializePeer((myPeerId) => {
        localPlayer.id = myPeerId;

        if (isHost && myPeerId === hostPeerId) {
            console.log('[HOST] Joining to own room detected. Using a simulated connection.');

            const simulatedConnection = {
                peer: myPeerId,
                open: true,
                send: (data) => {
                    switch (data.type) {
                        case 'roomJoined': onSuccessfulJoin(data.payload); break;
                        case 'gameStateUpdate':
                            const map = {};
                            for (const p of data.payload) {
                                if(playersInRoom[p.id]) {
                                    p.animationFrame = playersInRoom[p.id].animationFrame;
                                    p.idleAnimationFrame = playersInRoom[p.id].idleAnimationFrame;
                                }
                                map[p.id] = p;
                            }
                            playersInRoom = map;
                            break;
                        case 'playerJoinedRoom':
                            if (!playersInRoom[data.payload.id]) {
                                playersInRoom[data.payload.id] = data.payload.playerData;
                                console.log(`Player ${data.payload.username} has joined.`);
                            }
                            break;
                        case 'playerLeftRoom':
                            if (playersInRoom[data.payload]) {
                                console.log(`Player ${playersInRoom[data.payload].username} has left the room.`);
                                delete playersInRoom[data.payload];
                            }
                            break;
                        case 'playerCustomizationUpdated':
                            if (playersInRoom[data.payload.id]) {
                                playersInRoom[data.payload.id].customizations = data.payload.customizations;
                            }
                            break;
                        case 'grassSwaying':
                            if (biomeManager) {
                                biomeManager.startSwayAnimation(data.payload.grassId, data.payload.direction);
                            }
                            break;
                    }
                },
                sendToServer: (data) => {
                     if (data.type === 'playerInput') { gameHostInstance.handlePlayerInput(myPeerId, data.payload); }
                     else if (data.type === 'playerAction') { gameHostInstance.handlePlayerAction(myPeerId, data.payload); }
                }
            };
            hostConnection = { send: (data) => simulatedConnection.sendToServer(data) };
            gameHostInstance.addPlayer(simulatedConnection, localPlayer);
        }
        else {
            isHost = false;
            console.log(`[GUEST] I'm trying to establish a P2P connection with host ID: ${hostPeerId}`);

            hostConnection = peer.connect(hostPeerId, { reliable: true });

            if (!hostConnection) {
                console.error("[GUEST] FATAL ERROR: peer.connect() returned null.");
                alert("Failed to initialize connection to host.");
                return;
            }

            console.log("[GUEST] The connection object has been created. I'm waiting for events...");

            hostConnection.on('open', () => {
                console.log(`[GUEST] SUCCESS! A P2P connection to the host (${hostPeerId}) has been opened.`);
                signalingSocket.emit('notify-join', hostPeerId);
                hostConnection.send({ type: 'requestJoin', payload: localPlayer });
            });

            hostConnection.on('error', (err) => {
            console.error(`[GUEST] ERROR P2P CONNECTING TO HOST:`, err);
            alert('An error occurred while trying to connect to the host. Check your console.');
        });

            hostConnection.on('data', (data) => {
                switch(data.type) {
                    case 'roomJoined':
                        onSuccessfulJoin(data.payload, hostPeerId);
                        break;
                    case 'gameStateUpdate':
                        const map = {};
                        for (const p of data.payload) {
                            if(playersInRoom[p.id]) { p.animationFrame = playersInRoom[p.id].animationFrame; p.idleAnimationFrame = playersInRoom[p.id].idleAnimationFrame; }
                            map[p.id] = p;
                        }
                        playersInRoom = map;
                        if (playersInRoom[localPlayer.id]) Object.assign(localPlayer, playersInRoom[localPlayer.id]);
                        break;
                    case 'playerJoinedRoom':
                        if (!playersInRoom[data.payload.id]) {
                            playersInRoom[data.payload.id] = data.payload.playerData;
                            console.log(`Player ${data.payload.username} joined.`);
                        }
                        break;
                    case 'playerLeftRoom': if(playersInRoom[data.payload]) { console.log(`Player ${playersInRoom[data.payload].username} has left.`); delete playersInRoom[data.payload]; } break;
                    case 'playerCustomizationUpdated': if(playersInRoom[data.payload.id]) playersInRoom[data.payload.id].customizations = data.payload.customizations; break;
                    case 'grassSwaying':
                        if (biomeManager) biomeManager.startSwayAnimation(data.payload.grassId, data.payload.direction);
                        break;
                }
            });

            hostConnection.on('error', (err) => {
                console.error(`[GUEST] P2P CONNECTION ERROR:`, err);
                alert('An error occurred while communicating with the host.');
            });

            hostConnection.on('close', () => {
                console.warn("[GUEST] The P2P connection to the host has been closed.");
                alert('The host closed the room or the connection was lost.');
                leaveCurrentRoomUI();
            });
        }
    });
}

leaveRoomBtn.addEventListener('click', () => {
    const hostPeerId = hostConnection?.peer || (isHost ? peer?.id : null);

    if(isHost) {
        if(gameHostInstance) gameHostInstance.stop();
        setTimeout(() => {
            if(peer && !peer.destroyed) peer.destroy();
        }, 500);
    }

    if (!isHost && hostConnection) {
        hostConnection.close();
    }

    if (hostPeerId) {
        signalingSocket.emit('notify-leave', hostPeerId);
    }

    leaveCurrentRoomUI();
});


function leaveCurrentRoomUI() {
    gameContainerDiv.style.display='none'; lobbyDiv.style.display='block';
    currentRoom=null; playersInRoom={}; insectsInRoom=[];
    
    // ================= POCZĄTEK ZMIAN: Czyszczenie danych o balach =================
    pierSupportData = [];
    // ================= KONIEC ZMIAN =================

    // Czyszczenie NPC
    npcManager.clear();

    isHost=false;
    hostConnection=null;
    gameHostInstance=null;
    createRoomBtn.disabled = false;
    newRoomNameInput.disabled = false;
    currentWorldWidth=DEDICATED_GAME_WIDTH * 2; biomeManager.worldWidth=currentWorldWidth; biomeManager.setBiome('jurassic');
    keys={}; cameraX=0; cameraY=0; isCustomizationMenuOpen=false;
    console.log('You left the room, returned to the lobby.');
}


// ====================================================================
// === SEKCJA 6: OBSŁUGA KLAWIATURY I MYSZY (z modyfikacjami) ===
// ====================================================================

// ================= POCZĄTEK ZMIAN: Rozbudowany Helper (Samouczek) =================
/**
 * Inicjuje przejście do następnego kroku samouczka.
 * @param {number | 'finished'} nextState - Numer następnego kroku lub 'finished' aby zakończyć.
 */
function advanceTutorialStep(nextState) {
    if (tutorial.state === 'finished' || tutorial.state === nextState) return;

    // Przenieś aktualny obrazek do 'fadingOut', aby rozpocząć animację znikania
    if (tutorial.activeImage) {
        tutorial.fadingOutImage = { ...tutorial.activeImage, startTime: Date.now() };
    }

    tutorial.state = nextState;

    if (nextState !== 'finished') {
        // Ustaw nowy aktywny obrazek jako niewidoczny, aby mógł się pojawić
        tutorial.activeImage = {
            key: 'info' + nextState,
            alpha: 0,
            yOffset: 0,
            startTime: Date.now()
        };
    } else {
        // Koniec samouczka, nie ma nowego aktywnego obrazka
        tutorial.activeImage = null;
    }
}
// ================= KONIEC ZMIAN =================

function getMousePosOnCanvas(canvas, evt) {
    const gameWidth = 1920;
    const gameHeight = 1080;
    const gameAspectRatio = gameWidth / gameHeight;
    const rect = canvas.getBoundingClientRect();
    const windowAspectRatio = rect.width / rect.height;
    let renderWidth, renderHeight, offsetX, offsetY;
    if (windowAspectRatio > gameAspectRatio) {
        renderWidth = rect.height * gameAspectRatio;
        renderHeight = rect.height;
        offsetX = (rect.width - renderWidth) / 2;
        offsetY = 0;
    } else {
        renderWidth = rect.width;
        renderHeight = rect.width / gameAspectRatio;
        offsetX = 0;
        offsetY = (rect.height - renderHeight) / 2;
    }
    const mouseXInRenderedArea = evt.clientX - rect.left - offsetX;
    const mouseYInRenderedArea = evt.clientY - rect.top - offsetY;
    const scale = gameWidth / renderWidth;
    const gameX = mouseXInRenderedArea * scale;
    const gameY = mouseYInRenderedArea * scale;
    return { x: gameX, y: gameY };
}

document.addEventListener('keydown', (event) => {
    if (!currentRoom) return;

    // Ta sekcja obsługuje logikę samouczka.
    // Zauważ, że nie ma tu `event.preventDefault()` ani `return`.
    // Oznacza to, że po sprawdzeniu klawisza pod kątem samouczka,
    // kod kontynuuje działanie i pozwala grze normalnie zareagować na ten sam klawisz.
    if (tutorial.state !== 'finished') {
        switch (tutorial.state) {
            case 1:
                if (event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'KeyA' || event.code === 'KeyD') {
                    advanceTutorialStep(2);
                }
                break;
            case 2:
                if (event.code === 'Space') {
                    advanceTutorialStep(3);
                }
                break;
            case 3:
                if (['Digit1', 'Numpad1', 'Digit2', 'Numpad2', 'Digit3', 'Numpad3'].includes(event.code)) {
                    advanceTutorialStep(4);
                }
                break;
            case 4:
                if (event.code === 'KeyT') {
                    advanceTutorialStep(5);
                }
                break;
            case 5:
                if (event.code === 'KeyE') {
                    advanceTutorialStep('finished');
                }
                break;
        }
    }

    keys[event.code] = true;

    if (event.code.startsWith('Digit') || event.code.startsWith('Numpad')) {
        let item = localPlayer.customizations.rightHandItem;
        if(event.code.includes('1')) item=ITEM_NONE;
        if(event.code.includes('2')) item=ITEM_ROD;
        if(event.code.includes('3')) item=ITEM_LANTERN;

        if(localPlayer.customizations.rightHandItem !== item) {
            localPlayer.customizations.rightHandItem = item;
            localPlayerCustomizations.rightHandItem = item;
            sendPlayerAction('updateCustomization', localPlayer.customizations);
        }
        event.preventDefault();

    } else if (event.code === 'KeyE' || (event.code === 'Escape' && isCustomizationMenuOpen)) {
        isCustomizationMenuOpen = !isCustomizationMenuOpen;
        if (isCustomizationMenuOpen) {
            customizationMenuState = 'category';
        }
        event.preventDefault();
        
    } else if (isCustomizationMenuOpen) {
        event.preventDefault();

        if (customizationMenuState === 'category') {
            if (event.code === 'ArrowUp') {
                selectedCategoryIndex = (selectedCategoryIndex - 1 + customizationCategories.length) % customizationCategories.length;
            } else if (event.code === 'ArrowDown') {
                selectedCategoryIndex = (selectedCategoryIndex + 1) % customizationCategories.length;
            } else if (event.code === 'ArrowRight') {
                customizationMenuState = 'value';
            }
        } else if (customizationMenuState === 'value') {
            const currentCategory = customizationCategories[selectedCategoryIndex];
            const options = customizationOptions[currentCategory];
            let optionIndex = currentCustomizationOptionIndices[currentCategory];
            let selectionChanged = false;

            if (event.code === 'ArrowUp') {
                optionIndex = (optionIndex - 1 + options.length) % options.length;
                selectionChanged = true;
            } else if (event.code === 'ArrowDown') {
                optionIndex = (optionIndex + 1) % options.length;
                selectionChanged = true;
            } else if (event.code === 'ArrowLeft') {
                customizationMenuState = 'category';
            } else if (event.code === 'ArrowRight' && (currentCategory === 'hair' || currentCategory === 'beard')) {
                customizationMenuState = 'color';
                selectedColorPropertyIndex = 0;
            }

            if (selectionChanged) {
                currentCustomizationOptionIndices[currentCategory] = optionIndex;
                const newValue = options[optionIndex];
                localPlayer.customizations[currentCategory] = newValue;

                if (currentCategory === 'hat' && newValue !== 'none') {
                    localPlayer.customizations.hair = 'none';
                    currentCustomizationOptionIndices['hair'] = 0;
                }
                if (currentCategory === 'hair' && newValue !== 'none') {
                    localPlayer.customizations.hat = 'none';
                    currentCustomizationOptionIndices['hat'] = 0;
                }
                sendPlayerAction('updateCustomization', localPlayer.customizations);
            }
        } else if (customizationMenuState === 'color') {
            if (event.code === 'ArrowUp') {
                selectedColorPropertyIndex = (selectedColorPropertyIndex - 1 + colorProperties.length) % colorProperties.length;
            } else if (event.code === 'ArrowDown') {
                selectedColorPropertyIndex = (selectedColorPropertyIndex + 1) % colorProperties.length;
            } else if (event.code === 'ArrowLeft') {
                customizationMenuState = 'value';
            } else if (event.code === 'ArrowRight') {
                customizationMenuState = 'adjust_value';
            }
        } else if (customizationMenuState === 'adjust_value') {
            if (event.code === 'ArrowLeft') {
                customizationMenuState = 'color';
            } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
                const isIncrement = event.code === 'ArrowUp';
                const category = customizationCategories[selectedCategoryIndex];
                const property = colorProperties[selectedColorPropertyIndex];
                const propertyCapitalized = property.charAt(0).toUpperCase() + property.slice(1);
                const key = category + propertyCapitalized;

                if (property === 'hue') {
                    let currentValue = localPlayer.customizations[key];
                    let newValue = isIncrement ? currentValue + 1 : currentValue - 1;
                    newValue = Math.max(HAIR_HUE_MIN, Math.min(HAIR_HUE_MAX, newValue));
                    if (localPlayer.customizations[key] !== newValue) {
                        localPlayer.customizations[key] = newValue;
                        sendPlayerAction('updateCustomization', localPlayer.customizations);
                    }
                } else {
                    const internalMin = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MIN : HAIR_SATURATION_MIN) : (property === 'brightness' ? BEARD_BRIGHTNESS_MIN : BEARD_SATURATION_MIN));
                    const internalMax = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MAX : HAIR_SATURATION_MAX) : (property === 'brightness' ? BEARD_BRIGHTNESS_MAX : BEARD_SATURATION_MAX));
                    
                    let currentDisplayValue = mapToDisplayRange(localPlayer.customizations[key], internalMin, internalMax);
                    let newDisplayValue = isIncrement ? currentDisplayValue + 1 : currentDisplayValue - 1;
                    newDisplayValue = Math.max(0, Math.min(100, newDisplayValue));

                    const newInternalValue = mapFromDisplayRange(newDisplayValue, internalMin, internalMax);

                    if (localPlayer.customizations[key] !== newInternalValue) {
                        localPlayer.customizations[key] = newInternalValue;
                        sendPlayerAction('updateCustomization', localPlayer.customizations);
                    }
                }
            }
        }
    } else if (event.code === 'Space' && !localPlayer.isJumping) {
        sendPlayerAction('playerJump');
    }
});

document.addEventListener('keyup', (event) => {
    if (currentRoom) delete keys[event.code];
});

canvas.addEventListener('mousemove', (event) => {
    if (currentRoom && localPlayer.id) {
        const rect = canvas.getBoundingClientRect();
        const mouseX_unzoomed = (event.clientX - rect.left) * (DEDICATED_GAME_WIDTH / rect.width);
        const mouseY_unzoomed = (event.clientY - rect.top) * (DEDICATED_GAME_HEIGHT / rect.height);
        localPlayer.currentMouseX = mouseX_unzoomed / currentZoomLevel + cameraX;
        localPlayer.currentMouseY = mouseY_unzoomed / currentZoomLevel + cameraY;
    }
});

canvas.addEventListener('mousedown', (event) => {
    if(event.button !== 0 || !currentRoom) return;

    if (!isCustomizationMenuOpen && localPlayer.customizations.rightHandItem === ITEM_ROD && !localPlayer.hasLineCast) {
        localPlayer.isCasting = true;
        localPlayer.fishingBarTime = 0;
        event.preventDefault();
    }
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0 && !isCustomizationMenuOpen && currentRoom && localPlayer.customizations.rightHandItem === ITEM_ROD) {
        if (localPlayer.isCasting) {
            localPlayer.isCasting = false;
            const angle = Math.atan2(localPlayer.currentMouseY - localPlayer.rodTipWorldY, localPlayer.currentMouseX - localPlayer.rodTipWorldX);

            sendPlayerAction('castFishingLine', {
                power: localPlayer.castingPower,
                angle: angle,
                startX: localPlayer.rodTipWorldX,
                startY: localPlayer.rodTipWorldY
            });
            event.preventDefault();
        } else if (localPlayer.hasLineCast) {
            sendPlayerAction('reelInFishingLine');
            event.preventDefault();
        }
    }
});

canvas.addEventListener('wheel', (event) => {
event.preventDefault();
const zoomDelta = event.deltaY < 0 ? ZOOM_SENSITIVITY : -ZOOM_SENSITIVITY;
currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoomLevel + zoomDelta));
}, { passive: false });


// ====================================================================
// === SEKCJA 7: INICJALIZACJA ===
// ====================================================================

console.log("Initializing P2P client...");
initializeSignaling();
loadImages(() => {
    console.log("All images loaded, starting render loop.");
    requestAnimationFrame(gameLoop);
});