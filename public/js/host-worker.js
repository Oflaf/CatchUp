// ====================================================================================
// === HOST-WORKER.JS ===
// Ta wersja logiki serwera jest przeznaczona do uruchomienia w Web Workerze.
// Nie ma dostępu do DOM ani do obiektów połączeń PeerJS.
// Komunikuje się z głównym wątkiem (script.js) za pomocą `postMessage`.
// ====================================================================================
console.log('[DEBUG] Plik host-worker.js został załadowany i uruchomiony.');


// ====================================================================================
// === SEKCJA 1: STAŁE GRY (bez zmian) ===
// ====================================================================================

const AVAILABLE_BIOMES = ['jurassic', 'grassland'];
const WORLD_WIDTH_MIN = 4000;
const WORLD_WIDTH_MAX = 14000;
const DEDICATED_GAME_HEIGHT = 1080;
const PLAYER_SIZE = 128;
const GRAVITY = 1.6;
const JUMP_STRENGTH = -25;
const PLAYER_WALK_SPEED = 11;
const DECELERATION_FACTOR = 0.8;
const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.5;
const GAME_TICK_RATE = 1000 / 60;
const WATER_TOP_Y_WORLD = DEDICATED_GAME_HEIGHT - 164;
const FLOAT_GRAVITY = 0.3;
const FLOAT_WATER_FRICTION = 0.9;
const FLOAT_HITBOX_RADIUS = 32 / 2;
const CASTING_POWER_MULTIPLIER = 11.5;
const GRASS_SWAY_DURATION_MS = 1800;
const GRASS_DENSITY_FACTOR = 0.075;
const GRASS_SPRITE_WIDTH = 32 * 3.8;
const TREE_DENSITY_BASE_FACTOR = 0.015;
const TREE_DENSITY_VARIATION_FACTOR = 0.55;
const TREE_FOREGROUND_CHANCE = 0.15;
const TREE_MIN_HORIZONTAL_GAP = 64;
const INSECT_DENSITY_FACTOR = 0.0009;
const MAX_CAST_DISTANCE = 850;
const MAX_PLAYER_FLOAT_DISTANCE = 950;
const MIN_PIER_DISTANCE = 600;

const VILLAGE_TYPE = {
    NONE: 'none',
    MINIMAL: 'minimal',
    MEDIUM: 'medium',
    LARGE: 'large'
};

const VILLAGE_PROBABILITIES = [
    { type: VILLAGE_TYPE.NONE, weight: 40 },
    { type: VILLAGE_TYPE.MINIMAL, weight: 32 },
    { type: VILLAGE_TYPE.MEDIUM, weight: 20 },
    { type: VILLAGE_TYPE.LARGE, weight: 8 }
];

const VILLAGE_MIN_WORLD_X_OFFSET_PERCENT = 0.2;
const VILLAGE_MAX_WORLD_X_OFFSET_PERCENT = 0.8;
const BASE_BUILDING_SOURCE_TILE_SIZE = 128;

const AVAILABLE_BIOMES_DETAILS = {
    jurassic: {
        buildings: {
            definitions: [
                { id: 'j_house1', x: 0, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                { id: 'j_house2', x: BASE_BUILDING_SOURCE_TILE_SIZE, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                { id: 'j_tower', x: BASE_BUILDING_SOURCE_TILE_SIZE * 2, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
            ],
            displayScaleFactor: 4.5,
        },
        treeDefinitionCount: 8
    },
    grassland: {
        buildings: {
            definitions: [
                { id: 'g_hut1', x: 0, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                { id: 'g_hut2', x: BASE_BUILDING_SOURCE_TILE_SIZE, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                { id: 'g_farm', x: BASE_BUILDING_SOURCE_TILE_SIZE * 2, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
            ],
            displayScaleFactor: 4.5,
        },
        treeDefinitionCount: 8
    }
};

const ORIGINAL_ARM_PIVOT_IN_IMAGE_X = Math.round(14 * (PLAYER_SIZE / 36));
const ORIGINAL_ARM_PIVOT_IN_IMAGE_Y = Math.round(15 * (PLAYER_SIZE / 36));
const ROD_TIP_OFFSET_X = Math.round(136 * (PLAYER_SIZE / 128));
const ROD_TIP_OFFSET_Y = Math.round(-38 * (PLAYER_SIZE / 128));
const FRONT_ARM_OFFSET_X = 0;
const ARM_OFFSET_Y_IN_PLAYER_SPACE = 0;


// ====================================================================================
// === SEKCJA 2: FUNKCJE POMOCNICZE (bez zmian) ===
// ====================================================================================

function createSeededRandom(seedStr) {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
        seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
    }
    if (seed === 0) seed = 1;
    const MAX_UINT32 = 4294967295;
    return function() {
        seed = (seed * 1664525 + 1013904223) | 0;
        return (seed >>> 0) / MAX_UINT32;
    };
}

function generatePiers(roomId, groundLevel, worldWidth) {
    const seededRandom = createSeededRandom(roomId + '-piers');
    const piers = [];
    
    const numPiersToGenerate = 1 + Math.floor(seededRandom() * 4);
    const PIER_TILE_WIDTH = 32 * 3.75;
    
    for (let i = 0; i < numPiersToGenerate; i++) {
        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            const middleSectionsCount = 2 + Math.floor(seededRandom() * 9);
            const totalSections = 2 + middleSectionsCount;
            const pierWidth = totalSections * PIER_TILE_WIDTH;
            const startX = 200 + seededRandom() * (worldWidth - pierWidth - 400);
            
            let isOverlapping = false;
            for (const placedPier of piers) {
                const distance = Math.abs((startX + pierWidth / 2) - (placedPier.x + placedPier.width / 2));
                if (distance < (pierWidth / 2 + placedPier.width / 2 + MIN_PIER_DISTANCE)) {
                    isOverlapping = true;
                    break;
                }
            }

            if (!isOverlapping) {
                const y = DEDICATED_GAME_HEIGHT - groundLevel;
                const sections = [];
                sections.push({ tileIndex: 0, mirrored: false });
                for (let j = 0; j < middleSectionsCount; j++) {
                    sections.push({
                        tileIndex: 1 + Math.floor(seededRandom() * 4),
                        mirrored: seededRandom() < 0.5
                    });
                }
                sections.push({ tileIndex: 0, mirrored: true });

                piers.push({
                    id: `pier_${i}_${roomId}`,
                    x: startX,
                    y: y,
                    width: pierWidth,
                    sections: sections
                });
                break;
            }
            attempts++;
        }
    }
    return piers;
}

function generateGroundPlants(roomId, groundLevel, worldWidth) {
    const plants = [];
    const seededRandom = createSeededRandom(roomId + '-plants');
    const groundY = DEDICATED_GAME_HEIGHT - groundLevel;
    const numPlants = Math.floor(worldWidth * GRASS_DENSITY_FACTOR);

    for (let i = 0; i < numPlants; i++) {
        plants.push({
            id: `grass_${i}`,
            x: seededRandom() * worldWidth,
            y: groundY,
            typeIndex: Math.floor(seededRandom() * 12),
            isMirrored: seededRandom() < 0.5,
            swaying: false,
            swayStartTime: 0,
            zIndex: (seededRandom() < 0.7) ? -1 : 1,
        });
    }
    return plants;
}

function generateTrees(roomId, groundLevel, worldWidth, biomeName) {
    const trees = [];
    const seededRandom = createSeededRandom(roomId + '-trees');
    const groundY = DEDICATED_GAME_HEIGHT - groundLevel;
    const biomeDetails = AVAILABLE_BIOMES_DETAILS[biomeName];

    if (!biomeDetails || !biomeDetails.treeDefinitionCount) return trees;

    const roomDensityModifier = 1 + (seededRandom() * 2 - 1) * TREE_DENSITY_VARIATION_FACTOR;
    const numTrees = Math.floor(worldWidth * TREE_DENSITY_BASE_FACTOR * roomDensityModifier);

    for (let i = 0; i < numTrees; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const potentialX = seededRandom() * worldWidth;
            if (!trees.some(tree => Math.abs(potentialX - tree.x) < TREE_MIN_HORIZONTAL_GAP)) {
                trees.push({
                    id: `tree_${i}`,
                    x: potentialX,
                    y: groundY,
                    typeIndex: Math.floor(seededRandom() * biomeDetails.treeDefinitionCount),
                    isMirrored: seededRandom() < 0.5,
                    zIndex: (seededRandom() < (1 - TREE_FOREGROUND_CHANCE)) ? -1 : 1,
                });
                break;
            }
            attempts++;
        }
    }
    return trees;
}

function generateInsects(roomId, groundLevel, worldWidth) {
    const insects = [];
    const seededRandom = createSeededRandom(roomId + '-insects');
    const numInsects = Math.floor(worldWidth * INSECT_DENSITY_FACTOR);
    const minY = DEDICATED_GAME_HEIGHT * 0.1;
    const maxY = DEDICATED_GAME_HEIGHT * 0.3;

    for (let i = 0; i < numInsects; i++) {
        const startX = seededRandom() * worldWidth;
        const startY = minY + seededRandom() * (maxY - minY);
        insects.push({
            id: `insect_${i}`, x: startX, y: startY, hue: seededRandom() * 360,
            angle: 0, animationFrame: 0, timeOffset: seededRandom() * 1000,
            anchorX: startX, baseY: startY, drift: (seededRandom() - 0.5) * 2.5,
            hSpeed: 0.6 + seededRandom() * 0.3, vSpeed: 0.5 + seededRandom() * 0.2,
            hAmp: 50 + seededRandom() * 130, vAmp: 30 + seededRandom() * 140,
        });
    }
    return insects;
}

function _getNumberOfBuildingsForType(seededRandom, villageType) {
    switch (villageType) {
        case VILLAGE_TYPE.MINIMAL: return 1 + Math.floor(seededRandom() * 3);
        case VILLAGE_TYPE.MEDIUM: return 3 + Math.floor(seededRandom() * 4);
        case VILLAGE_TYPE.LARGE: return 6 + Math.floor(seededRandom() * 5);
        default: return 0;
    }
}

function _generateBuildingsLayout(roomId, biomeName, villageType, villageXPosition, worldWidth) {
    if (villageType === VILLAGE_TYPE.NONE) return [];
    
    const seededRandom = createSeededRandom(roomId + '-buildings');
    const biomeBuildingInfo = AVAILABLE_BIOMES_DETAILS[biomeName]?.buildings;
    if (!biomeBuildingInfo?.definitions?.length) return [];
    
    const numBuildings = _getNumberOfBuildingsForType(seededRandom, villageType);
    if (numBuildings === 0) return [];

    const MIN_GAP = 50;
    const MAX_GAP = 300;
    
    const placedBuildings = [];
    const firstBuildingDef = biomeBuildingInfo.definitions[Math.floor(seededRandom() * biomeBuildingInfo.definitions.length)];
    const firstBuildingWidth = firstBuildingDef.width * biomeBuildingInfo.displayScaleFactor;
    
    placedBuildings.push({
        definitionId: firstBuildingDef.id,
        x: villageXPosition - (firstBuildingWidth / 2),
        width: firstBuildingWidth,
        height: firstBuildingDef.height * biomeBuildingInfo.displayScaleFactor,
    });
    
    let leftmostX = placedBuildings[0].x;
    let rightmostX = placedBuildings[0].x + placedBuildings[0].width;

    for (let i = 1; i < numBuildings; i++) {
        const newBuildingDef = biomeBuildingInfo.definitions[Math.floor(seededRandom() * biomeBuildingInfo.definitions.length)];
        const newBuildingWidth = newBuildingDef.width * biomeBuildingInfo.displayScaleFactor;
        const gap = MIN_GAP + seededRandom() * (MAX_GAP - MIN_GAP);
        
        let newX;
        
        if (seededRandom() < 0.5) {
            newX = leftmostX - gap - newBuildingWidth;
            leftmostX = newX;
        } else {
            newX = rightmostX + gap;
            rightmostX = newX + newBuildingWidth;
        }
        
        placedBuildings.push({
            definitionId: newBuildingDef.id,
            x: newX,
            width: newBuildingWidth,
            height: newBuildingDef.height * biomeBuildingInfo.displayScaleFactor,
        });
    }
    return placedBuildings.sort((a, b) => a.x - b.x);
}

function getArmRotationAngle(player) {
    if (Math.abs(player.velocityX) > MIN_VELOCITY_FOR_WALK_ANIMATION) return 0;
    return 0;
}

function calculateRodTipWorldPosition(player) {
    if (!player.customizations || player.customizations.rightHandItem !== 'rod') return { x: null, y: null };
    
    const armRotationAmount = getArmRotationAngle(player);
    const playerCenterX = player.x + (PLAYER_SIZE / 2);
    const playerCenterY = player.y + (PLAYER_SIZE / 2);

    const armLocalOffsetX_relToPlayerCenter = (FRONT_ARM_OFFSET_X + ORIGINAL_ARM_PIVOT_IN_IMAGE_X) - (PLAYER_SIZE / 2);
    const armLocalOffsetY_relToPlayerCenter = (ARM_OFFSET_Y_IN_PLAYER_SPACE + ORIGINAL_ARM_PIVOT_IN_IMAGE_Y) - (PLAYER_SIZE / 2);
    
    const rotatedArmPivotX_relToPlayerCenter = armLocalOffsetX_relToPlayerCenter * Math.cos(armRotationAmount) - armLocalOffsetY_relToPlayerCenter * Math.sin(armRotationAmount);
    const rotatedArmPivotY_relToPlayerCenter = armLocalOffsetX_relToPlayerCenter * Math.sin(armRotationAmount) + armLocalOffsetY_relToPlayerCenter * Math.cos(armRotationAmount);
    
    const currentArmPivotWorldX = playerCenterX + rotatedArmPivotX_relToPlayerCenter * player.direction;
    const currentArmPivotWorldY = playerCenterY + rotatedArmPivotY_relToPlayerCenter;
    
    const rodTipLocalX = ROD_TIP_OFFSET_X;
    const rodTipLocalY = ROD_TIP_OFFSET_Y;

    const rotatedRodTipOffsetX_relToArmPivot = rodTipLocalX * Math.cos(armRotationAmount) - rodTipLocalY * Math.sin(armRotationAmount);
    const rotatedRodTipOffsetY_relToArmPivot = rodTipLocalX * Math.sin(armRotationAmount) + rodTipLocalY * Math.cos(armRotationAmount);

    const rodTipWorldX = currentArmPivotWorldX + rotatedRodTipOffsetX_relToArmPivot * player.direction;
    const rodTipWorldY = currentArmPivotWorldY + rotatedRodTipOffsetY_relToArmPivot;

    return { x: rodTipWorldX, y: rodTipWorldY };
}


// ====================================================================================
// === SEKCJA 3: GŁÓWNA KLASA GAMEHOST (zmodyfikowana dla Workera) ===
// ====================================================================================

class GameHost {
    constructor() {
        this.room = null;
        this.gameLoopInterval = null;
        // Usunięto this.connections - worker nie zarządza bezpośrednio połączeniami
    }

    /**
     * ZMODYFIKOWANA: Wysyła wiadomość do głównego wątku, aby ten rozgłosił ją do wszystkich graczy.
     */
    broadcast(message) {
        postMessage({
            type: 'broadcast',
            message: message
        });
    }
    
    /**
     * ZMODYFIKOWANA: Wysyła wiadomość do głównego wątku, aby ten wysłał ją do konkretnego gracza.
     */
    sendTo(peerId, message) {
        postMessage({
            type: 'sendTo',
            peerId: peerId,
            message: message
        });
    }
    
    start(hostData) {
        const roomId = hostData.id;
        
        const roomSeededRandom = createSeededRandom(roomId);
        const randomBiome = AVAILABLE_BIOMES[Math.floor(roomSeededRandom() * AVAILABLE_BIOMES.length)];
        const randomWorldWidth = Math.floor(roomSeededRandom() * (WORLD_WIDTH_MAX - WORLD_WIDTH_MIN + 1)) + WORLD_WIDTH_MIN;
        const totalWeight = VILLAGE_PROBABILITIES.reduce((sum, item) => sum + item.weight, 0);
        let randomNum = roomSeededRandom() * totalWeight;
        let selectedVillageType = VILLAGE_PROBABILITIES.find(opt => (randomNum -= opt.weight) < 0)?.type || VILLAGE_TYPE.NONE;
        let villageXPosition = null;
        if (selectedVillageType !== VILLAGE_TYPE.NONE) {
            const minX = randomWorldWidth * VILLAGE_MIN_WORLD_X_OFFSET_PERCENT;
            const maxX = randomWorldWidth * VILLAGE_MAX_WORLD_X_OFFSET_PERCENT;
            villageXPosition = minX + (roomSeededRandom() * (maxX - minX));
        }

        this.room = {
            worldItems: [],
            id: roomId,
            name: `Pokój ${hostData.username}`,
            hostId: roomId,
            players: {},
            gameData: {
                groundLevel: 256,
                biome: randomBiome,
                worldWidth: randomWorldWidth,
                villageType: selectedVillageType,
                villageXPosition: villageXPosition,
                groundPlants: [],
                trees: [],
                insects: [],
                placedBuildings: [],
                piers: [],
                initialCycleRotation: Math.random() * (Math.PI * 2),
                roomCreationTimestamp: Date.now(),
            },
            playerInputs: {}
        };
        
        this.room.gameData.placedBuildings = _generateBuildingsLayout(roomId, randomBiome, selectedVillageType, villageXPosition, randomWorldWidth);
        this.room.gameData.groundPlants = generateGroundPlants(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);
        this.room.gameData.trees = generateTrees(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth, randomBiome);
        this.room.gameData.insects = generateInsects(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);
        this.room.gameData.piers = generatePiers(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);

        console.log(`[HOST-WORKER] Gra wystartowała w pokoju ${roomId}`);
        
        this.gameLoopInterval = setInterval(() => this.updateGame(), GAME_TICK_RATE);
        
        // Zwracanie wartości nie ma sensu w workerze, ale zostawiamy dla spójności
        return {
            name: this.room.name,
            gameData: this.room.gameData
        };
    }

    stop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        this.room = null;
        console.log("[HOST-WORKER] Gra zatrzymana i zresetowana.");
    }

    /**
     * ZMODYFIKOWANA: Przyjmuje peerId i dane gracza, zamiast obiektu połączenia.
     */
    addPlayer(peerId, initialPlayerData) {
        console.log(`[HOST-WORKER] Gracz ${initialPlayerData.username} (${peerId}) dołącza.`);

        const initialY = DEDICATED_GAME_HEIGHT - this.room.gameData.groundLevel - PLAYER_SIZE;
        
        this.room.players[peerId] = {
            id: peerId, x: 50, y: initialY, color: initialPlayerData.color, username: initialPlayerData.username,
            customizations: { ...initialPlayerData.customizations }, isJumping: false, velocityY: 0, 
            direction: 1, velocityX: 0, hasLineCast: false, floatWorldX: null, floatWorldY: null, 
            floatVelocityX: 0, floatVelocityY: 0, lineAnchorWorldX: null, lineAnchorWorldY: null, 
            rodTipWorldX: null, rodTipWorldY: null
        };
        this.room.playerInputs[peerId] = { keys: {} };
        
        // Wyślij dane o pokoju tylko do nowego gracza
        console.log(`[DEBUG] Worker: Wysyłam 'roomJoined' do ${peerId}`); // <-- DODAJ TEN LOG
    // Wyślij dane o pokoju tylko do nowego gracza
    this.sendTo(peerId, {
        type: 'roomJoined',
        payload: {
                roomId: this.room.id,
                roomName: this.room.name,
                playersInRoom: this.room.players,
                gameData: this.room.gameData
            }
        });
        
        // Z opóźnieniem poinformuj wszystkich (w tym nowego gracza) o nowym graczu
        setTimeout(() => {
             this.broadcast({
                type: 'playerJoinedRoom',
                payload: {
                    id: peerId,
                    playerData: this.room.players[peerId],
                    username: this.room.players[peerId].username
                }
            });
        }, 100);
    }

    removePlayer(peerId) {
        if (this.room && this.room.players[peerId]) {
             console.log(`[HOST-WORKER] Gracz ${this.room.players[peerId].username} (${peerId}) opuścił grę.`);
             delete this.room.players[peerId];
             delete this.room.playerInputs[peerId];
             
             this.broadcast({ type: 'playerLeftRoom', payload: peerId });
        }
    }
    
    handlePlayerInput(peerId, inputData) {
        if(this.room && this.room.playerInputs[peerId]) {
            this.room.playerInputs[peerId] = inputData;
        }
    }
    
    _resetFishingState(player) {
        player.hasLineCast = false;
        player.floatWorldX = null;
        player.floatWorldY = null;
        player.floatVelocityX = 0;
        player.floatVelocityY = 0;
        player.lineAnchorWorldX = null;
        player.lineAnchorWorldY = null;
    }

    handlePlayerAction(peerId, actionData) {
        
        if(!this.room) return;
        const player = this.room.players[peerId];
        if(!player) return;

        switch(actionData.type) {
            case 'dropItem': {
    console.log(`[HOST-WORKER] Gracz ${player.username} wyrzucił ${actionData.payload.name}`);
    
    // Kierunek, w którym patrzy gracz (1 dla prawo, -1 dla lewo)
    const direction = player.direction || 1; 

    const newItem = {
        id: `item_${Date.now()}_${Math.random()}`,
        data: actionData.payload,
        
        // --- ZMIANY TUTAJ ---
        // Pozycja startowa: nieco z przodu gracza
        x: player.x + (PLAYER_SIZE / 2) + (direction * PLAYER_SIZE * 0.6),
        // Pozycja startowa: na wysokości głowy gracza
        y: player.y - (PLAYER_SIZE * 0.2), 
        
        // Nadaj lekki pęd początkowy
        velocityY: -8, // Mocniejsze podrzucenie
        velocityX: direction * 4 // Lekki odrzut w kierunku patrzenia
    };
    this.room.worldItems.push(newItem);
    break;
}
            case 'playerJump': {
                const groundY = DEDICATED_GAME_HEIGHT - this.room.gameData.groundLevel - PLAYER_SIZE;
                const isOnGround = (player.y >= groundY - 1 && player.y <= groundY + 1);
                if (!player.isJumping && isOnGround) {
                    player.isJumping = true;
                    player.velocityY = JUMP_STRENGTH;
                }
                break;
            }
            case 'updateCustomization': {
                if (player.hasLineCast && actionData.payload.rightHandItem !== 'rod') {
                    this._resetFishingState(player);
                }
                
                Object.assign(player.customizations, actionData.payload);
                this.broadcast({ 
                    type: 'playerCustomizationUpdated', 
                    payload: { id: peerId, customizations: player.customizations }
                });
                break;
            }
            case 'castFishingLine': {
                if (player.customizations.rightHandItem === 'rod' && !player.hasLineCast) {
                    player.hasLineCast = true;
                    player.floatVelocityX = actionData.payload.power * CASTING_POWER_MULTIPLIER * Math.cos(actionData.payload.angle);
                    player.floatVelocityY = actionData.payload.power * CASTING_POWER_MULTIPLIER * Math.sin(actionData.payload.angle);
                    player.floatWorldX = actionData.payload.startX;
                    player.floatWorldY = actionData.payload.startY;
                    player.lineAnchorWorldX = null;
                    player.lineAnchorWorldY = null;
                }
                break;
            }
             case 'reelInFishingLine': {
                if (player.hasLineCast) {
                    this._resetFishingState(player);
                }
                break;
            }
            case 'fishCaught': {
                const { fishName, size, tier } = actionData.payload;
                console.log(`[HOST-WORKER] Gracz ${player.username} złapał ${fishName} (Tier: ${tier}) o wielkości ${size}cm.`);

                this.broadcast({
                    type: 'fishCaughtBroadcast',
                    payload: {
                        playerId: peerId,
                        fishName: fishName,
                        size: size,
                        tier: tier
                    }
                });
                break;
            }
        }
    }

    updateGame() {
    if (!this.room) return;
    const room = this.room;
    const groundLevel = room.gameData.groundLevel;
    const worldWidth = room.gameData.worldWidth;
    const groundY_for_items = DEDICATED_GAME_HEIGHT - groundLevel - (92 * 0.7 / 2); // 92 to SLOT_SIZE

    // --- FIZYKA DLA PRZEDMIOTÓW (JUŻ TO MASZ) ---
    room.worldItems.forEach(item => {
    if (item.y < groundY_for_items) {
        item.velocityY += GRAVITY * 0.5;
        item.y += item.velocityY;
        item.x += item.velocityX;
    } else { // Gdy przedmiot jest na ziemi lub pod nią
        item.y = groundY_for_items;
        item.velocityY = 0;
        
        // Zastosuj tarcie, aby przedmiot się zatrzymał
        item.velocityX *= 0.85; 
        if (Math.abs(item.velocityX) < 0.1) {
            item.velocityX = 0;
        }
        item.x += item.velocityX;
    }
});
        const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - groundLevel - PLAYER_SIZE;

        for (const playerId in room.players) {
            const player = room.players[playerId];
            const playerInput = room.playerInputs[playerId] || { keys: {} };
            
            let targetVelocityX = 0;
            if (playerInput.keys['ArrowLeft'] || playerInput.keys['KeyA']) {
                targetVelocityX = -PLAYER_WALK_SPEED;
                player.direction = -1;
            } else if (playerInput.keys['ArrowRight'] || playerInput.keys['KeyD']) {
                targetVelocityX = PLAYER_WALK_SPEED;
                player.direction = 1;
            }
            player.velocityX = targetVelocityX !== 0 ? targetVelocityX : player.velocityX * DECELERATION_FACTOR;
            if (Math.abs(player.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) player.velocityX = 0;
            
            player.x += player.velocityX;
            player.x = Math.max(0, Math.min(worldWidth - PLAYER_SIZE, player.x));

            if (player.isJumping || player.y < groundY_target_for_player_top) {
                player.velocityY += GRAVITY;
                player.y += player.velocityY;

                if (player.y >= groundY_target_for_player_top) {
                    player.y = groundY_target_for_player_top;
                    player.isJumping = false;
                    player.velocityY = 0;
                }
            } else {
                 player.y = groundY_target_for_player_top;
            }

            const playerHitbox = { x: player.x + PLAYER_SIZE * 0.25, y: player.y + PLAYER_SIZE * 0.8, width: PLAYER_SIZE * 0.5, height: PLAYER_SIZE * 0.2 };
            room.gameData.groundPlants.forEach(grass => {
                if (grass.swaying && Date.now() - grass.swayStartTime > GRASS_SWAY_DURATION_MS) grass.swaying = false;
                if (!grass.swaying && player.velocityX !== 0) {
                    const grassHitbox = { x: grass.x, y: grass.y - 20, width: GRASS_SPRITE_WIDTH / 2, height: 20 };
                    if (playerHitbox.x < grassHitbox.x + grassHitbox.width && playerHitbox.x + playerHitbox.width > grassHitbox.x) {
                        grass.swaying = true;
                        grass.swayStartTime = Date.now();
                        this.broadcast({ type: 'grassSwaying', payload: { grassId: grass.id, direction: player.direction } });
                    }
                }
            });
            
            player.rodTipWorldX = calculateRodTipWorldPosition(player).x;
            player.rodTipWorldY = calculateRodTipWorldPosition(player).y;

            if(player.hasLineCast){
                const distanceFromFloat = Math.hypot(player.x - player.floatWorldX, player.y - player.floatWorldY);
                if (distanceFromFloat > MAX_PLAYER_FLOAT_DISTANCE) {
                    this._resetFishingState(player);
                } else {
                    if (player.lineAnchorWorldY === null) {
                        player.floatVelocityY += FLOAT_GRAVITY;
                        player.floatWorldX += player.floatVelocityX;
                        player.floatWorldY += player.floatVelocityY;
                        
                        const castDistance = Math.hypot(player.rodTipWorldX - player.floatWorldX, player.rodTipWorldY - player.floatWorldY);
                        if (castDistance > MAX_CAST_DISTANCE) {
                             this._resetFishingState(player);
                        }
                        else if (player.floatWorldY + FLOAT_HITBOX_RADIUS >= WATER_TOP_Y_WORLD) {
                            player.floatWorldY = WATER_TOP_Y_WORLD - FLOAT_HITBOX_RADIUS;
                            player.floatVelocityY = 0;
                            player.floatVelocityX *= FLOAT_WATER_FRICTION;
                            player.lineAnchorWorldX = player.floatWorldX;
                            player.lineAnchorWorldY = player.floatWorldY; 
                        }
                    } 
                    else {
                        player.floatVelocityX *= FLOAT_WATER_FRICTION;
                        if(Math.abs(player.floatVelocityX) < 0.1) player.floatVelocityX = 0;
                        player.floatWorldX += player.floatVelocityX;
                        player.floatWorldY = player.lineAnchorWorldY;
                    }
                }
            } 
            else {
                 this._resetFishingState(player);
            }
for (let i = room.worldItems.length - 1; i >= 0; i--) {
            const item = room.worldItems[i];
            // Sprawdzaj kolizję tylko, gdy przedmiot leży na ziemi
             if (item.velocityY === 0) {
                const playerCenterX = player.x + PLAYER_SIZE / 2;
                const playerCenterY = player.y + PLAYER_SIZE / 2;
                
                const distance = Math.hypot(playerCenterX - item.x, playerCenterY - item.y);
                const pickupRadius = PLAYER_SIZE / 2; // Gracz musi być wystarczająco blisko

                if (distance < pickupRadius) {
                    console.log(`[HOST-WORKER] Gracz ${player.username} podniósł ${item.data.name}`);
                    
                    // Wyślij wiadomość tylko do gracza, który podniósł przedmiot
                    this.sendTo(playerId, { type: 'itemPickedUp', payload: item.data });
                    
                    // Usuń przedmiot ze świata gry
                    room.worldItems.splice(i, 1);
                }
            }
        }
    }

    // Na końcu funkcji, zaktualizuj wiadomość gameStateUpdate
        this.broadcast({
        type: 'gameStateUpdate',
        payload: {
            players: Object.values(room.players),
            worldItems: room.worldItems // Ta linia jest kluczowa!
        }
    });
}
}


// ====================================================================================
// === SEKCJA 4: MOST KOMUNIKACYJNY WORKERA ===
// ====================================================================================

let gameHostInstance = null;

// 'self' to globalny zasięg wewnątrz Web Workera (odpowiednik 'window')
self.onmessage = function(event) {
    const { type, payload } = event.data;

    // Nie ma potrzeby logowania każdej wiadomości, chyba że do debugowania
    // console.log('[DEBUG] Worker: Otrzymałem wiadomość ->', type, payload);

    switch (type) {
        case 'start':
            if (gameHostInstance) gameHostInstance.stop();
            gameHostInstance = new GameHost();
            gameHostInstance.start(payload);
            break;

        case 'addPlayer':
            if (gameHostInstance) {
                const { peerId, initialPlayerData } = payload;
                gameHostInstance.addPlayer(peerId, initialPlayerData);
            }
            break;

        case 'removePlayer':
            if (gameHostInstance) {
                gameHostInstance.removePlayer(payload.peerId);
            }
            break;

        case 'playerInput':
            if (gameHostInstance) {
                // POPRAWKA: Poprawne wyciąganie danych z payload
                const { peerId, keys, currentMouseX, currentMouseY } = payload;
                gameHostInstance.handlePlayerInput(peerId, { keys, currentMouseX, currentMouseY });
            }
            break;
            
        case 'playerAction':
            if (gameHostInstance) {
                // POPRAWKA: Poprawne wyciąganie danych z payload
                const { peerId, type: actionType, payload: actionPayload } = payload;
                gameHostInstance.handlePlayerAction(peerId, { type: actionType, payload: actionPayload });
            }
            break;
            
        case 'stop':
            if (gameHostInstance) {
                gameHostInstance.stop();
                gameHostInstance = null;
            }
            break;
    }
};