// Ten plik zawiera całą logikę gry, która kiedyś była na serwerze Node.js.
// Działa teraz w przeglądarce gracza, który jest hostem pokoju.
// Nie używa Express, Socket.IO ani żadnych bibliotek Node.js.

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
const PLAYER_WALK_SPEED = 14;
const DECELERATION_FACTOR = 0.8;
const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.5;
const GAME_TICK_RATE = 1000 / 60;
const WATER_TOP_Y_WORLD = DEDICATED_GAME_HEIGHT - 164;
const FLOAT_GRAVITY = 0.3;
const FLOAT_WATER_FRICTION = 0.9;
const FLOAT_HITBOX_RADIUS = 32 / 2;
const CASTING_POWER_MULTIPLIER = 20;
const GRASS_SWAY_DURATION_MS = 1800;
const GRASS_DENSITY_FACTOR = 0.075;
const GRASS_SPRITE_WIDTH = 32 * 3.8;
const TREE_DENSITY_BASE_FACTOR = 0.015;
const TREE_DENSITY_VARIATION_FACTOR = 0.55;
const TREE_FOREGROUND_CHANCE = 0.15;
const TREE_MIN_HORIZONTAL_GAP = 64;
const INSECT_DENSITY_FACTOR = 0.0009;

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
// === SEKCJA 2: FUNKCJE POMOCNICZE (jedna funkcja zmodyfikowana) ===
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

// === POCZĄTEK POPRAWIONEJ FUNKCJI ===
// Wklej to w miejsce testowej funkcji w pliku host_nowa_wersja.js

function _generateBuildingsLayout(roomId, biomeName, villageType, villageXPosition, worldWidth) {
    if (villageType === VILLAGE_TYPE.NONE) return [];
    
    const seededRandom = createSeededRandom(roomId + '-buildings');
    const biomeBuildingInfo = AVAILABLE_BIOMES_DETAILS[biomeName]?.buildings;
    if (!biomeBuildingInfo?.definitions?.length) return [];
    
    const numBuildings = _getNumberOfBuildingsForType(seededRandom, villageType);
    if (numBuildings === 0) return [];

    // --- Stałe kontrolujące minimalny i maksymalny odstęp ---
    // Możesz dowolnie zmieniać te wartości, aby dostosować wygląd wiosek!
    const MIN_GAP = 50;  // Minimalna gwarantowana przerwa między budynkami
    const MAX_GAP = 300; // Do minimalnej przerwy zostanie dodana losowa wartość od 0 do 300
    
    const placedBuildings = [];

    // 1. Umieść pierwszy budynek w centrum wioski
    const firstBuildingDef = biomeBuildingInfo.definitions[Math.floor(seededRandom() * biomeBuildingInfo.definitions.length)];
    const firstBuildingWidth = firstBuildingDef.width * biomeBuildingInfo.displayScaleFactor;
    
    placedBuildings.push({
        definitionId: firstBuildingDef.id,
        x: villageXPosition - (firstBuildingWidth / 2), // Wyśrodkuj pierwszy budynek
        width: firstBuildingWidth,
        height: firstBuildingDef.height * biomeBuildingInfo.displayScaleFactor,
    });
    
    // Inicjalizuj skrajne pozycje (lewa krawędź i prawa krawędź całej grupy budynków)
    let leftmostX = placedBuildings[0].x;
    let rightmostX = placedBuildings[0].x + placedBuildings[0].width;

    // 2. Umieść pozostałe budynki, dodając je po lewej lub prawej stronie
    for (let i = 1; i < numBuildings; i++) {
        // Wybierz losowy budynek do umieszczenia
        const newBuildingDef = biomeBuildingInfo.definitions[Math.floor(seededRandom() * biomeBuildingInfo.definitions.length)];
        const newBuildingWidth = newBuildingDef.width * biomeBuildingInfo.displayScaleFactor;

        // Oblicz losową przerwę
        const gap = MIN_GAP + seededRandom() * (MAX_GAP - MIN_GAP);
        
        let newX;
        
        // Zdecyduj (50/50), czy umieścić po lewej czy po prawej stronie istniejącej grupy
        if (seededRandom() < 0.5) {
            // Umieść po lewej: nowa pozycja = lewa krawędź - przerwa - szerokość nowego budynku
            newX = leftmostX - gap - newBuildingWidth;
            leftmostX = newX; // Zaktualizuj nową lewą krawędź całej grupy
        } else {
            // Umieść po prawej: nowa pozycja = prawa krawędź + przerwa
            newX = rightmostX + gap;
            rightmostX = newX + newBuildingWidth; // Zaktualizuj nową prawą krawędź całej grupy
        }
        
        placedBuildings.push({
            definitionId: newBuildingDef.id,
            x: newX,
            width: newBuildingWidth,
            height: newBuildingDef.height * biomeBuildingInfo.displayScaleFactor,
        });
    }

    // Posortuj budynki po pozycji X dla porządku (przydatne przy renderowaniu)
    return placedBuildings.sort((a, b) => a.x - b.x);
}
// === KONIEC POPRAWIONEJ FUNKCJI ===


function getArmRotationAngle(player) {
    if (Math.abs(player.velocityX) > MIN_VELOCITY_FOR_WALK_ANIMATION) return 0; // Uproszczone, klient sam liczy animacje
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
// === SEKCJA 3: GŁÓWNA KLASA GAMEHOST ===
// ====================================================================================

class GameHost {
    constructor() {
        this.room = null;
        this.gameLoopInterval = null;
        this.connections = {}; // Przechowuje aktywne połączenia PeerJS { peerId: conn }
    }

    // --- Metody Komunikacji ---
    broadcast(message) {
        // console.log("[HOST] Broadcasting:", message.type);
        for (const peerId in this.connections) {
            if (this.connections[peerId].open) {
                this.connections[peerId].send(message);
            }
        }
    }
    
    sendTo(peerId, message) {
        if (this.connections[peerId] && this.connections[peerId].open) {
            this.connections[peerId].send(message);
        }
    }
    
    // --- Metody Zarządzania Grą ---
    start(hostData) {
        const roomId = hostData.id; // PeerID Hosta jest ID pokoju
        
        // Generowanie świata
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
                groundPlants: [], trees: [], insects: [], placedBuildings: []
            },
            playerInputs: {}
        };
        
        this.room.gameData.placedBuildings = _generateBuildingsLayout(roomId, randomBiome, selectedVillageType, villageXPosition, randomWorldWidth);
        this.room.gameData.groundPlants = generateGroundPlants(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);
        this.room.gameData.trees = generateTrees(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth, randomBiome);
        this.room.gameData.insects = generateInsects(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);

        console.log(`[HOST] Gra wystartowała w pokoju ${roomId}`);
        
        this.gameLoopInterval = setInterval(() => this.updateGame(), GAME_TICK_RATE);
        
        return {
            name: this.room.name,
            gameData: this.room.gameData
        };
    }

    stop() {
        clearInterval(this.gameLoopInterval);
        this.room = null;
        // Zamknij wszystkie połączenia
        for (const peerId in this.connections) {
            this.connections[peerId].close();
        }
        this.connections = {};
        console.log("[HOST] Gra zatrzymana i zresetowana.");
    }
    
    // --- Metody Zarządzania Graczami i Inputem ---

    // ZMIANA W TEJ FUNKCJI
    addPlayer(conn, initialPlayerData) {
        const peerId = conn.peer;
        this.connections[peerId] = conn;

        console.log(`[HOST] Gracz ${initialPlayerData.username} (${peerId}) dołącza.`);

        const initialY = DEDICATED_GAME_HEIGHT - this.room.gameData.groundLevel - PLAYER_SIZE;
        
        this.room.players[peerId] = {
            id: peerId, x: 50, y: initialY, color: initialPlayerData.color, username: initialPlayerData.username,
            customizations: { ...initialPlayerData.customizations }, isJumping: false, velocityY: 0, 
            direction: 1, velocityX: 0, hasLineCast: false, floatWorldX: null, floatWorldY: null, 
            floatVelocityX: 0, floatVelocityY: 0, lineAnchorWorldX: null, lineAnchorWorldY: null, 
            rodTipWorldX: null, rodTipWorldY: null
        };
        this.room.playerInputs[peerId] = { keys: {} };
        
        // KLUCZOWA ZMIANA: Wyślij odpowiedź powitalną bezpośrednio przez obiekt 'conn'.
        // To działa zarówno dla prawdziwych połączeń, jak i dla naszej symulacji.
        conn.send({
            type: 'roomJoined',
            payload: {
                roomId: this.room.id,
                roomName: this.room.name,
                playersInRoom: this.room.players,
                gameData: this.room.gameData
            }
        });
        
        // Poinformuj WSZYSTKICH (łącznie z nowym) o dołączeniu gracza
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
             console.log(`[HOST] Gracz ${this.room.players[peerId].username} (${peerId}) opuścił grę.`);
             delete this.room.players[peerId];
             delete this.room.playerInputs[peerId];
             delete this.connections[peerId];
             
             this.broadcast({ type: 'playerLeftRoom', payload: peerId });
        }
    }
    
    handlePlayerInput(peerId, inputData) {
        if(this.room && this.room.playerInputs[peerId]) {
            this.room.playerInputs[peerId] = inputData;
        }
    }
    
    handlePlayerAction(peerId, actionData) {
        if(!this.room) return;
        const player = this.room.players[peerId];
        if(!player) return;

        switch(actionData.type) {
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
                    player.hasLineCast = false;
                    player.floatWorldX = null;
                    player.floatWorldY = null;
                    player.floatVelocityX = 0;
                    player.floatVelocityY = 0;
                }
                break;
            }
        }
    }

    // --- Główna pętla gry (bez zmian) ---
    updateGame() {
        if (!this.room) return;

        const room = this.room;
        const groundLevel = room.gameData.groundLevel;
        const worldWidth = room.gameData.worldWidth;
        const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - groundLevel - PLAYER_SIZE;

        for (const playerId in room.players) {
            const player = room.players[playerId];
            const playerInput = room.playerInputs[playerId] || { keys: {} };
            
            // --- Logika ruchu ---
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

            // --- Logika grawitacji i skoku ---
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

            // --- Logika kołysania trawy ---
            const playerHitbox = { x: player.x + PLAYER_SIZE * 0.25, y: player.y + PLAYER_SIZE * 0.8, width: PLAYER_SIZE * 0.5, height: PLAYER_SIZE * 0.2 };
            room.gameData.groundPlants.forEach(grass => {
                if (grass.swaying && Date.now() - grass.swayStartTime > GRASS_SWAY_DURATION_MS) grass.swaying = false;
                if (!grass.swaying && player.velocityX !== 0) {
                    const grassHitbox = { x: grass.x, y: grass.y - 20, width: GRASS_SPRITE_WIDTH / 2, height: 20 };
                    if (playerHitbox.x < grassHitbox.x + grassHitbox.width && playerHitbox.x + playerHitbox.width > grassHitbox.x) {
                        grass.swaying = true;
                        grass.swayStartTime = Date.now();
                        // Rozgłoś event do klientów, żeby odtworzyli animację
                        this.broadcast({ type: 'grassSwaying', payload: { grassId: grass.id, direction: player.direction } });
                    }
                }
            });
            
            // --- Logika wędki i spławika ---
            player.rodTipWorldX = calculateRodTipWorldPosition(player).x;
            player.rodTipWorldY = calculateRodTipWorldPosition(player).y;
            if(player.hasLineCast){
                if (player.lineAnchorWorldY === null) {
                    player.floatVelocityY += FLOAT_GRAVITY;
                    player.floatWorldX += player.floatVelocityX;
                    player.floatWorldY += player.floatVelocityY;

                    if (player.floatWorldY + FLOAT_HITBOX_RADIUS >= WATER_TOP_Y_WORLD) {
                        player.floatWorldY = WATER_TOP_Y_WORLD - FLOAT_HITBOX_RADIUS;
                        player.floatVelocityY = 0;
                        player.floatVelocityX *= FLOAT_WATER_FRICTION;
                        player.lineAnchorWorldX = player.floatWorldX;
                        player.lineAnchorWorldY = player.lineAnchorWorldY;
                    }
                } else {
                    player.floatVelocityX *= FLOAT_WATER_FRICTION;
                    if(Math.abs(player.floatVelocityX) < 0.1) player.floatVelocityX = 0;
                    player.floatWorldX += player.floatVelocityX;
                    player.floatWorldY = player.lineAnchorWorldY;
                }
            } else {
                 player.floatVelocityX = 0;
                 player.floatVelocityY = 0;
                 player.floatWorldX = null;
                 player.floatWorldY = null;
                 player.lineAnchorWorldY = null;
            }
        }

        // --- Rozgłoś zaktualizowany stan do wszystkich graczy ---
        this.broadcast({
            type: 'gameStateUpdate',
            payload: Object.values(room.players)
        });
    }
}