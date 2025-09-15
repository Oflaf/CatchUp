const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let rooms = {};
let playersGlobal = {};

// === Nowe stałe dla biomów i rozmiaru świata ===
const AVAILABLE_BIOMES = ['jurassic', 'grassland'];
const WORLD_WIDTH_MIN = 4000;
const WORLD_WIDTH_MAX = 14000;
// ===============================================

// === STAŁE GRY (serwer jest autorytatywny) ===
const DEDICATED_GAME_HEIGHT = 1080;
const PLAYER_SIZE = 128;
const GRAVITY = 1.6;
const JUMP_STRENGTH = -25;
const PLAYER_WALK_SPEED = 14;
const DECELERATION_FACTOR = 0.8;
const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.5;

const ANIMATION_CYCLE_LENGTH = 30;
const IDLE_ANIM_CYCLE_LENGTH = 60;

const GAME_TICK_RATE = 1000 / 60;

const WATER_TOP_Y_WORLD = DEDICATED_GAME_HEIGHT - 164;
const FLOAT_GRAVITY = 0.3;
const FLOAT_WATER_FRICTION = 0.9;
const FLOAT_HITBOX_RADIUS = 32 / 2;
const CASTING_POWER_MULTIPLIER = 20;

const GRASS_SWAY_DURATION_MS = 1800;
const GRASS_DENSITY_FACTOR = 0.075;
const GRASS_SPRITE_WIDTH = 32 * 3.8;
const GRASS_SPRITE_HEIGHT = 64 * 3.5;

// === NOWE STAŁE DLA DRZEW ===
const TREE_DENSITY_BASE_FACTOR = 0.015;
const TREE_DENSITY_VARIATION_FACTOR = 0.55;
const TREE_FOREGROUND_CHANCE = 0.15;
const TREE_SPRITE_SOURCE_WIDTH = 128;
const TREE_SPRITE_SOURCE_HEIGHT = 256;
const TREE_MIN_HORIZONTAL_GAP = 64; // *** NOWA STAŁA: Minimalna odległość między pniami drzew ***
// ============================================

// === NOWE STAŁE DLA INSEKTÓW ===
const INSECT_DENSITY_FACTOR = 0.0015; // Ilość insektów na piksel szerokości świata
const INSECT_TILE_SIZE = 32;
const INSECT_MAX_ROTATION_DEGREES = 50;
const INSECT_ANIMATION_SPEED_TICKS = 8; // Co ile ticków zmienia się klatka animacji
const INSECT_TOP_BOUNDARY_FACTOR = 0.6; // Nie mogą wejść w górne 30% mapy (1.0 - 0.7)
// ===================================

// === STAŁE I DEFINICJE DLA SYSTEMU WIOSKI NA SERWERZE ===
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
]

const VILLAGE_MIN_WORLD_X_OFFSET_PERCENT = 0.2;
const VILLAGE_MAX_WORLD_X_OFFSET_PERCENT = 0.8;

const BASE_BUILDING_SOURCE_TILE_SIZE = 128;

// === DEFINICJE BIOMÓW NA SERWERZE, AUTORYTATYWNE ===
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

function getBiomeBuildingInfo(biomeName) {
    return AVAILABLE_BIOMES_DETAILS[biomeName]?.buildings;
}
// === KONIEC STAŁYCH DLA SYSTEMU WIOSKI ===


const ORIGINAL_ARM_PIVOT_IN_IMAGE_X = Math.round(14 * (PLAYER_SIZE / 36));
const ORIGINAL_ARM_PIVOT_IN_IMAGE_Y = Math.round(15 * (PLAYER_SIZE / 36));
const ROD_TIP_OFFSET_X = Math.round(136 * (PLAYER_SIZE / 128));
const ROD_TIP_OFFSET_Y = Math.round(-38 * (PLAYER_SIZE / 128));
const ARM_ROTATION_WALK_MAX_DEGREES = 45;
const ARM_ROTATION_WALK_MAX_ANGLE = ARM_ROTATION_WALK_MAX_DEGREES * (Math.PI / 180);
const FRONT_ARM_OFFSET_X = 0;
const ARM_OFFSET_Y_IN_PLAYER_SPACE = 0;


// --- FUNKCJE POMOCNICZE GENERUJĄCE DETERMINISTYCZNIE (DZIĘKI SEEDOWI) ---

function createSeededRandom(seedStr) {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
        seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
    }
    if (seed === 0) {
        seed = 1;
    }
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
        const randX = seededRandom();
        const randType = seededRandom();
        const randMirrored = seededRandom();
        const randZIndex = seededRandom();

        plants.push({
            id: `grass_${i}`,
            x: randX * worldWidth,
            y: groundY,
            typeIndex: Math.floor(randType * 12),
            isMirrored: randMirrored < 0.5,
            swaying: false,
            swayStartTime: 0,
            zIndex: (randZIndex < 0.7) ? -1 : 1,
        });
    }
    return plants;
}

// === ZMODYFIKOWANA FUNKCJA GENEROWANIA DRZEW ===
function generateTrees(roomId, groundLevel, worldWidth, biomeName) {
    const trees = [];
    const seededRandom = createSeededRandom(roomId + '-trees');
    const groundY = DEDICATED_GAME_HEIGHT - groundLevel;
    const biomeDetails = AVAILABLE_BIOMES_DETAILS[biomeName];

    if (!biomeDetails || !biomeDetails.treeDefinitionCount || biomeDetails.treeDefinitionCount === 0) {
        console.warn(`[SERVER] No tree definitions count for biome: ${biomeName}. No trees will be generated.`);
        return trees;
    }

    const roomDensityModifier = 1 + (seededRandom() * 2 - 1) * TREE_DENSITY_VARIATION_FACTOR;
    const effectiveDensity = TREE_DENSITY_BASE_FACTOR * roomDensityModifier;
    const numTrees = Math.floor(worldWidth * effectiveDensity);

    for (let i = 0; i < numTrees; i++) {
        let chosenX = null;
        let attempts = 0;

        // *** NOWA PĘTLA: Próbujemy znaleźć odpowiednie miejsce dla drzewa ***
        while (attempts < 50) { // Limit prób, aby uniknąć nieskończonej pętli
            const potentialX = seededRandom() * worldWidth;
            let overlaps = false;

            for (const placedTree of trees) {
                if (Math.abs(potentialX - placedTree.x) < TREE_MIN_HORIZONTAL_GAP) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                chosenX = potentialX;
                break;
            }
            attempts++;
        }

        if (chosenX !== null) {
            const randType = seededRandom();
            const randMirrored = seededRandom();
            const randZIndex = seededRandom();

            trees.push({
                id: `tree_${i}`,
                x: chosenX, // Używamy znalezionej, bezpiecznej pozycji
                y: groundY,
                typeIndex: Math.floor(randType * biomeDetails.treeDefinitionCount),
                isMirrored: randMirrored < 0.5,
                zIndex: (randZIndex < (1 - TREE_FOREGROUND_CHANCE)) ? -1 : 1,
            });
        } else {
             console.warn(`[SERVER] Could not place tree ${i+1} after ${attempts} attempts for room ${roomId}. It might be too crowded.`);
        }
    }
    return trees;
}


// === NOWA FUNKCJA GENEROWANIA INSEKTÓW ===
function generateInsects(roomId, groundLevel, worldWidth) {
    const insects = [];
    const seededRandom = createSeededRandom(roomId + '-insects');
    const numInsects = Math.floor(worldWidth * INSECT_DENSITY_FACTOR);

    // Górna granica (nie mogą wlecieć w górne 30% mapy)
    const minY = DEDICATED_GAME_HEIGHT * (INSECT_TOP_BOUNDARY_FACTOR-2);
    // Dolna granica (tuż nad ziemią)
    const maxY = DEDICATED_GAME_HEIGHT - groundLevel - INSECT_TILE_SIZE;

    for (let i = 0; i < numInsects; i++) {
        const startX = seededRandom() * worldWidth;
        const startY = minY + seededRandom() * (maxY - minY);

        insects.push({
            id: `insect_${i}`,
            x: startX,
            y: startY,
            hue: seededRandom() * 160, // <--- TA LINIA ZOSTAŁA DODANA
            angle: 0,
            animationFrame: 0,
            // Parametry dla ruchu sinusoidalnego
            timeOffset: seededRandom() * 2000,
            // Parametry dla ruchu sinusoidalnego
            timeOffset: seededRandom() * 2000, // Zapewnia, że nie ruszają się identycznie
            anchorX: startX, // Punkt centralny, wokół którego owad lata
            baseY: startY,   // Bazowa wysokość, od której oscyluje
            drift: (seededRandom() - 0.5) * 1.5, // Prędkość ogólnego przemieszczania się w poziomie
            hSpeed: 0.8 + seededRandom() * 0.3, // Prędkość poziomej oscylacji
            vSpeed: 0.8 + seededRandom() * 0.2, // Prędkość pionowej oscylacji
            hAmp: 80 + seededRandom() * 140,   // Amplituda (szerokość) poziomej oscylacji
            vAmp: -20 + seededRandom() * -180,   // Amplituda (wysokość) pionowej oscylacji
        });
    }
    return insects;
}


function _getNumberOfBuildingsForType(seededRandom, villageType) {
    switch (villageType) {
        case VILLAGE_TYPE.MINIMAL:
            return 1 + Math.floor(seededRandom() * 3);
        case VILLAGE_TYPE.MEDIUM:
            return 3 + Math.floor(seededRandom() * 4);
        case VILLAGE_TYPE.LARGE:
            return 6 + Math.floor(seededRandom() * 5);
        case VILLAGE_TYPE.NONE:
        default:
            return 0;
    }
}

function _generateBuildingsLayout(roomId, biomeName, villageType, villageXPosition, worldWidth) {
    const placedBuildings = [];
    if (villageType === VILLAGE_TYPE.NONE) {
        return placedBuildings;
    }

    const seededRandom = createSeededRandom(roomId + '-buildings');

    const biomeBuildingInfo = getBiomeBuildingInfo(biomeName);
    if (!biomeBuildingInfo || !biomeBuildingInfo.definitions || biomeBuildingInfo.definitions.length === 0) {
        console.warn(`[SERVER] No building definitions for biome: ${biomeName}. Cannot generate buildings layout.`);
        return placedBuildings;
    }

    const numBuildingsToDraw = _getNumberOfBuildingsForType(seededRandom, villageType);
    if (numBuildingsToDraw === 0) {
        return placedBuildings;
    }

    const effectiveVillageCenterX = villageXPosition;
    const buildingDisplayScaleFactor = biomeBuildingInfo.displayScaleFactor || 1;
    const minBuildingGap = 32;

    const averageBuildingWidth = BASE_BUILDING_SOURCE_TILE_SIZE * buildingDisplayScaleFactor;
    const estimatedMinTotalWidth = (numBuildingsToDraw * averageBuildingWidth) + ((numBuildingsToDraw - 1) * minBuildingGap);

    const minCalculatedClusterWidth = Math.max(estimatedMinTotalWidth + (minBuildingGap * 2), worldWidth * 0.1);
    const villageClusterWidth = Math.min(minCalculatedClusterWidth, worldWidth * 0.8);

    const minClusterX = effectiveVillageCenterX - villageClusterWidth / 2;
    const maxClusterX = effectiveVillageCenterX + villageClusterWidth / 2;

    for (let i = 0; i < numBuildingsToDraw; i++) {
        const definition = biomeBuildingInfo.definitions[Math.floor(seededRandom() * biomeBuildingInfo.definitions.length)];
        const effectiveBuildingRenderWidth = definition.width * buildingDisplayScaleFactor;
        const effectiveBuildingRenderHeight = definition.height * buildingDisplayScaleFactor;

        let chosenX = null;
        let attempts = 0;

        while (attempts < 100) {
            const randomXInRange = seededRandom() * Math.max(0, (maxClusterX - effectiveBuildingRenderWidth - minClusterX));
            let potentialX = minClusterX + randomXInRange;

            potentialX = Math.max(minClusterX, potentialX);
            potentialX = Math.min(maxClusterX - effectiveBuildingRenderWidth, potentialX);

            let overlaps = false;
            for (const pb of placedBuildings) {
                if (!((potentialX + effectiveBuildingRenderWidth + minBuildingGap <= pb.x) ||
                      (pb.x + pb.width + minBuildingGap <= potentialX))) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                chosenX = potentialX;
                break;
            }
            attempts++;
        }

        if (chosenX !== null) {
            placedBuildings.push({
                definitionId: definition.id,
                x: chosenX,
                width: effectiveBuildingRenderWidth,
                height: effectiveBuildingRenderHeight
            });
        } else {
            console.warn(`[SERVER] Could not place building ${i+1} (type: ${villageType}) after ${attempts} attempts for biome ${biomeName}. Remaining buildings will not be placed.`);
            break;
        }
    }
    placedBuildings.sort((a,b) => a.x - b.x);
    return placedBuildings;
}
// --- KONIEC FUNKCJI POMOCNICZYCH ---


function getArmRotationAngle(player) {
    if (player.isWalking) {
        const animationProgress = (player.animationFrame % ANIMATION_CYCLE_LENGTH) / ANIMATION_CYCLE_LENGTH;
        const oscillationWave = Math.sin(animationProgress * Math.PI * 2);
        return oscillationWave * ARM_ROTATION_WALK_MAX_ANGLE;
    }
    return 0;
}

function calculateRodTipWorldPosition(player) {
    if (!player.customizations || player.customizations.rightHandItem !== 'rod') {
        return { x: null, y: null };
    }

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


io.on('connection', (socket) => {
    console.log('Nowy gracz połączony:', socket.id);

    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
    playersGlobal[socket.id] = {
        id: socket.id,
        username: 'Gracz' + Math.floor(Math.random() * 10000),
        color: randomColor,
        currentRoomId: null,
        customizations: {
            hat: 'none', hair: 'none', accessories: 'none', beard: 'none', clothes: 'none', pants: 'none', shoes: 'none',
            rightHandItem: 'none',
            hairSaturation: 100, hairHue: 180, hairBrightness: 50,
            beardSaturation: 100, beardHue: 0, beardBrightness: 100
        }
    };

    socket.emit('playerInfo', playersGlobal[socket.id]);
    socket.emit('roomListUpdate', getPublicRoomList());

    socket.on('createRoom', (roomName, callback) => {
        const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
        roomName = roomName || `Pokój ${Object.keys(rooms).length + 1}`;

        if (playersGlobal[socket.id].currentRoomId) {
            if (callback) callback({ success: false, message: 'Już jesteś w pokoju. Najpierw go opuść.' });
            return;
        }

        const roomSeededRandom = createSeededRandom(roomId);

        const randomBiome = AVAILABLE_BIOMES[Math.floor(roomSeededRandom() * AVAILABLE_BIOMES.length)];
        const randomWorldWidth = Math.floor(roomSeededRandom() * (WORLD_WIDTH_MAX - WORLD_WIDTH_MIN + 1)) + WORLD_WIDTH_MIN;

        let totalWeight = VILLAGE_PROBABILITIES.reduce((sum, item) => sum + item.weight, 0);
        let randomNum = roomSeededRandom() * totalWeight;
        let selectedVillageType = VILLAGE_TYPE.NONE;

        for (const option of VILLAGE_PROBABILITIES) {
            if (randomNum < option.weight) {
                selectedVillageType = option.type;
                break;
            }
            randomNum -= option.weight;
        }

        let villageXPosition = null;
        let placedBuildings = [];
        if (selectedVillageType !== VILLAGE_TYPE.NONE) {
            const minX = randomWorldWidth * VILLAGE_MIN_WORLD_X_OFFSET_PERCENT;
            const maxX = randomWorldWidth * VILLAGE_MAX_WORLD_X_OFFSET_PERCENT;
            villageXPosition = minX + (roomSeededRandom() * (maxX - minX));

            placedBuildings = _generateBuildingsLayout(roomId, randomBiome, selectedVillageType, villageXPosition, randomWorldWidth);
        }

        rooms[roomId] = {
            id: roomId,
            name: roomName,
            hostId: socket.id,
            players: {},
            gameData: {
                groundLevel: 256,
                biome: randomBiome,
                worldWidth: randomWorldWidth,
                groundPlants: [],
                trees: [],
                insects: [], // Nowa tablica na insekty
                villageType: selectedVillageType,
                villageXPosition: villageXPosition,
                placedBuildings: placedBuildings
            },
            playerInputs: {}
        };

        rooms[roomId].gameData.groundPlants = generateGroundPlants(roomId, rooms[roomId].gameData.groundLevel, rooms[roomId].gameData.worldWidth);
        rooms[roomId].gameData.trees = generateTrees(roomId, rooms[roomId].gameData.groundLevel, rooms[roomId].gameData.worldWidth, randomBiome);
        rooms[roomId].gameData.insects = generateInsects(roomId, rooms[roomId].gameData.groundLevel, rooms[roomId].gameData.worldWidth);

        socket.join(roomId);
        playersGlobal[socket.id].currentRoomId = roomId;

        const initialY = DEDICATED_GAME_HEIGHT - rooms[roomId].gameData.groundLevel - PLAYER_SIZE;

        rooms[roomId].players[socket.id] = {
            id: socket.id,
            x: 50, y: initialY,
            color: playersGlobal[socket.id].color,
            isJumping: false, velocityY: 0,
            username: playersGlobal[socket.id].username,
            isWalking: false, animationFrame: 0,
            isIdle: true, idleAnimationFrame: 0,
            direction: 1, velocityX: 0,
            currentMouseX: undefined, currentMouseY: undefined,
            customizations: { ...playersGlobal[socket.id].customizations },
            hasLineCast: false, floatWorldX: null, floatWorldY: null,
            floatVelocityX: 0, floatVelocityY: 0,
            lineAnchorWorldX: null, lineAnchorWorldY: null,
            rodTipWorldX: null, rodTipWorldY: null,
        };
        rooms[roomId].playerInputs[socket.id] = { keys: {}, currentMouseX: undefined, currentMouseY: undefined };


        console.log(`Gracz ${playersGlobal[socket.id].username} (${socket.id}) stworzył pokój: "${roomName}" (${roomId}) z biomem "${randomBiome}", szerokością ${randomWorldWidth}, wioską: ${selectedVillageType} @ X:${villageXPosition?.toFixed(2) || 'N/A'}, i ${placedBuildings.length} budynków.`);
        io.emit('roomListUpdate', getPublicRoomList());

        socket.emit('roomJoined', {
            roomId: roomId,
            roomName: rooms[roomId].name,
            playersInRoom: rooms[roomId].players,
            gameData: rooms[roomId].gameData
        });

        socket.to(roomId).emit('playerJoinedRoom', {
            id: socket.id,
            playerData: rooms[roomId].players[socket.id],
            username: playersGlobal[socket.id].username
        });

        if (callback) callback({
            success: true,
            roomId: roomId,
            roomName: roomName,
            gameData: rooms[roomId].gameData
        });
    });

    socket.on('joinRoom', (roomId, callback) => {
        if (rooms[roomId] && !playersGlobal[socket.id].currentRoomId) {
            socket.join(roomId);
            playersGlobal[socket.id].currentRoomId = roomId;

            const initialY = DEDICATED_GAME_HEIGHT - rooms[roomId].gameData.groundLevel - PLAYER_SIZE;

            rooms[roomId].players[socket.id] = {
                id: socket.id,
                x: 50, y: initialY,
                color: playersGlobal[socket.id].color,
                isJumping: false, velocityY: 0,
                username: playersGlobal[socket.id].username,
                isWalking: false, animationFrame: 0,
                isIdle: true, idleAnimationFrame: 0,
                direction: 1, velocityX: 0,
                currentMouseX: undefined, currentMouseY: undefined,
                customizations: { ...playersGlobal[socket.id].customizations },
                hasLineCast: false, floatWorldX: null, floatWorldY: null,
                floatVelocityX: 0, floatVelocityY: 0,
                lineAnchorWorldX: null, lineAnchorWorldY: null,
                rodTipWorldX: null, rodTipWorldY: null,
            };
            rooms[roomId].playerInputs[socket.id] = { keys: {}, currentMouseX: undefined, currentMouseY: undefined };

            socket.emit('roomJoined', {
                roomId: roomId,
                roomName: rooms[roomId].name,
                playersInRoom: rooms[roomId].players,
                gameData: rooms[roomId].gameData
            });

            socket.to(roomId).emit('playerJoinedRoom', {
                id: socket.id,
                playerData: rooms[roomId].players[socket.id],
                username: playersGlobal[socket.id].username
            });

            console.log(`Gracz ${playersGlobal[socket.id].username} (${socket.id}) dołączył do pokoju: ${roomId}`);
            io.emit('roomListUpdate', getPublicRoomList());

            if (callback) callback({ success: true });
        } else {
            let message = 'Nieznany błąd.';
            if (!rooms[roomId]) {
                message = 'Pokój nie istnieje.';
            } else if (playersGlobal[socket.id].currentRoomId) {
                message = 'Już jesteś w innym pokoju.';
            }
            if (callback) callback({ success: false, message: message });
        }
    });

    socket.on('leaveRoom', (callback) => {
        const roomId = playersGlobal[socket.id].currentRoomId;
        if (roomId && rooms[roomId]) {
            socket.leave(roomId);
            delete rooms[roomId].players[socket.id];
            delete rooms[roomId].playerInputs[socket.id];
            playersGlobal[socket.id].currentRoomId = null;

            socket.to(roomId).emit('playerLeftRoom', socket.id);

            if (Object.keys(rooms[roomId].players).length === 0 || rooms[roomId].hostId === socket.id) {
                console.log(`Pokój ${roomId} jest pusty lub host (${rooms[roomId].hostId}) rozłączył się. Pokój został usunięty.`);
                delete rooms[roomId];
                io.emit('roomRemoved', roomId);
            }

            console.log(`Gracz ${playersGlobal[socket.id].username} (${socket.id}) opuścił pokój: ${roomId}`);
            io.emit('roomListUpdate', getPublicRoomList());

            if (callback) callback({ success: true });
        } else {
            if (callback) callback( { success: false, message: 'Nie jesteś w żadnym pokoju.' });
        }
    });

    socket.on('getRoomList', (callback) => {
        if (callback) callback(getPublicRoomList());
    });

    socket.on('playerInput', (inputData) => {
        const roomId = playersGlobal[socket.id].currentRoomId;
        if (roomId && rooms[roomId] && rooms[roomId].playerInputs && rooms[roomId].playerInputs[socket.id]) {
            rooms[roomId].playerInputs[socket.id].keys = inputData.keys;
            rooms[roomId].playerInputs[socket.id].currentMouseX = inputData.currentMouseX;
            rooms[roomId].playerInputs[socket.id].currentMouseY = inputData.currentMouseY;
        }
    });

    socket.on('playerJump', () => {
        const roomId = playersGlobal[socket.id].currentRoomId;
        if (roomId && rooms[roomId] && rooms[roomId].players[socket.id]) {
            const player = rooms[roomId].players[socket.id];
            const groundLevel = rooms[roomId].gameData?.groundLevel || 0;
            const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - groundLevel - PLAYER_SIZE;
            const isOnGround = (player.y >= groundY_target_for_player_top - 1 && player.y <= groundY_target_for_player_top + 1);

            if (!player.isJumping && isOnGround) {
                player.isJumping = true;
                player.velocityY = JUMP_STRENGTH;
            }
        }
    });

    socket.on('updateCustomization', (newCustomizations) => {
        const playerId = socket.id;
        const roomId = playersGlobal[playerId].currentRoomId;

        if (roomId && rooms[roomId] && rooms[roomId].players[playerId]) {
            Object.assign(playersGlobal[playerId].customizations, newCustomizations);
            Object.assign(rooms[roomId].players[playerId].customizations, newCustomizations);

            socket.to(roomId).emit('playerCustomizationUpdated', {
                id: playerId,
                customizations: rooms[roomId].players[playerId].customizations
            });
        }
    });

    socket.on('castFishingLine', (data) => {
        const roomId = playersGlobal[socket.id].currentRoomId;
        if (roomId && rooms[roomId] && rooms[roomId].players[socket.id]) {
            const player = rooms[roomId].players[socket.id];
            if (player.customizations.rightHandItem === 'rod' && !player.hasLineCast) {
                player.hasLineCast = true;

                player.floatVelocityX = data.power * CASTING_POWER_MULTIPLIER * Math.cos(data.angle);
                player.floatVelocityY = data.power * CASTING_POWER_MULTIPLIER * Math.sin(data.angle);

                player.floatWorldX = data.startX;
                player.floatWorldY = data.startY;

                player.lineAnchorWorldX = null;
                player.lineAnchorWorldY = null;
            }
        }
    });

    socket.on('reelInFishingLine', () => {
        const roomId = playersGlobal[socket.id].currentRoomId;
        if (roomId && rooms[roomId] && rooms[roomId].players[socket.id]) {
            const player = rooms[roomId].players[socket.id];
            if (player.hasLineCast) {
                player.hasLineCast = false;
                player.floatWorldX = null;
                player.floatWorldY = null;
                player.floatVelocityX = 0;
                player.floatVelocityY = 0;
                player.lineAnchorWorldX = null;
                player.lineAnchorWorldY = null;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Gracz rozłączony:', socket.id);
        const roomId = playersGlobal[socket.id] ? playersGlobal[socket.id].currentRoomId : null;

        if (roomId && rooms[roomId]) {
            delete rooms[roomId].players[socket.id];
            if (rooms[roomId].playerInputs) {
                delete rooms[roomId].playerInputs[socket.id];
            }
            socket.to(roomId).emit('playerLeftRoom', socket.id);

            if (Object.keys(rooms[roomId].players).length === 0 || rooms[roomId].hostId === socket.id) {
                console.log(`Pokój ${roomId} jest pusty lub host (${rooms[roomId].hostId}) rozłączył się. Pokój został usunięty.`);
                delete rooms[roomId];
                io.emit('roomRemoved', roomId);
            }
        }
        delete playersGlobal[socket.id];
        io.emit('roomListUpdate', getPublicRoomList());
    });
});

setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const groundLevel = room.gameData?.groundLevel || 0;
        const worldWidth = room.gameData?.worldWidth || WORLD_WIDTH_MIN;
        const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - groundLevel - PLAYER_SIZE;

        // === LOGIKA RUCHU GRACZY ===
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

            if (targetVelocityX === 0) {
                player.velocityX *= DECELERATION_FACTOR;
                if (Math.abs(player.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) {
                    player.velocityX = 0;
                }
            } else {
                player.velocityX = targetVelocityX;
            }

            player.x += player.velocityX;

            player.x = Math.max(0, Math.min(worldWidth - PLAYER_SIZE, player.x));

            if (player.y > groundY_target_for_player_top) {
                player.y = groundY_target_for_player_top;
                player.isJumping = false;
                player.velocityY = 0;
            }

            if (player.isJumping || player.y < groundY_target_for_player_top) {
                player.velocityY += GRAVITY;
                player.y += player.velocityY;

                if (player.y >= groundY_target_for_player_top) {
                    player.y = groundY_target_for_player_top;
                    player.isJumping = false;
                    player.velocityY = 0;
                }
            }

            const isOnGround = (player.y >= groundY_target_for_player_top - 1 && player.y <= groundY_target_for_player_top + 1);

            player.isWalking = Math.abs(player.velocityX) > MIN_VELOCITY_FOR_WALK_ANIMATION && isOnGround;

            const isStationaryHorizontal = Math.abs(player.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION;
            player.isIdle = !player.isWalking && !player.isJumping && isStationaryHorizontal && isOnGround;

            if (player.isWalking) {
                const speedFactor = Math.abs(player.velocityX / PLAYER_WALK_SPEED);
                player.animationFrame = (Number(player.animationFrame ?? 0) + (1 * speedFactor)) % ANIMATION_CYCLE_LENGTH;
                player.idleAnimationFrame = 0;
            } else if (player.isIdle) {
                player.animationFrame = 0;
                player.idleAnimationFrame = (Number(player.idleAnimationFrame ?? 0) + 1) % IDLE_ANIM_CYCLE_LENGTH;
            } else {
                player.animationFrame = 0;
                player.idleAnimationFrame = 0;
            }

            player.currentMouseX = playerInput.currentMouseX;
            player.currentMouseY = playerInput.currentMouseY;

            const playerHitbox = {
                x: player.x + PLAYER_SIZE * 0.25,
                y: player.y + PLAYER_SIZE * 0.8,
                width: PLAYER_SIZE * 0.5,
                height: PLAYER_SIZE * 0.2
            };

            if (room.gameData.groundPlants) {
                room.gameData.groundPlants.forEach(grass => {
                    if (grass.swaying && Date.now() - grass.swayStartTime > GRASS_SWAY_DURATION_MS) {
                        grass.swaying = false;
                    }

                    if (!grass.swaying && player.isWalking) {
                        const grassHitbox = {
                            x: grass.x,
                            y: grass.y - 20,
                            width: GRASS_SPRITE_WIDTH / 2,
                            height: 20
                        };

                        if (playerHitbox.x < grassHitbox.x + grassHitbox.width &&
                            playerHitbox.x + playerHitbox.width > grassHitbox.x &&
                            playerHitbox.y < grassHitbox.y + grassHitbox.height &&
                            playerHitbox.y + playerHitbox.height > grassHitbox.y)
                        {
                            grass.swaying = true;
                            grass.swayStartTime = Date.now();
                            io.to(roomId).emit('grassSwaying', { grassId: grass.id, direction: player.direction });
                        }
                    }
                });
            }

            if (player.customizations && player.customizations.rightHandItem === 'rod') {
                const rodTip = calculateRodTipWorldPosition(player);
                player.rodTipWorldX = rodTip.x;
                player.rodTipWorldY = rodTip.y;

                if (player.hasLineCast) {
                    if (player.lineAnchorWorldY === null) {
                        player.floatVelocityY += FLOAT_GRAVITY;
                        player.floatWorldX += player.floatVelocityX;
                        player.floatWorldY += player.floatVelocityY;

                        if (player.floatWorldY + FLOAT_HITBOX_RADIUS >= WATER_TOP_Y_WORLD) {
                            player.floatWorldY = WATER_TOP_Y_WORLD - FLOAT_HITBOX_RADIUS;
                            player.floatVelocityY = 0;
                            player.floatVelocityX *= FLOAT_WATER_FRICTION;
                            player.lineAnchorWorldX = player.floatWorldX;
                            player.lineAnchorWorldY = player.floatWorldY;
                        }
                    } else {
                        player.floatVelocityX *= FLOAT_WATER_FRICTION;
                        player.floatWorldX += player.floatVelocityX;
                        player.floatWorldY = player.lineAnchorWorldY;

                        if (Math.abs(player.floatVelocityX) < 0.1) {
                            player.floatVelocityX = 0;
                        }
                    }
                }
            } else {
                player.hasLineCast = false;
                player.floatWorldX = null;
                player.floatWorldY = null;
                player.floatVelocityX = 0;
                player.floatVelocityY = 0;
                player.lineAnchorWorldX = null;
                player.lineAnchorWorldY = null;
                player.rodTipWorldX = null;
                player.rodTipWorldY = null;
            }
        }


        // === NOWA LOGIKA RUCHU INSEKTÓW ===
        if (room.gameData.insects) {
            const insectMinY = DEDICATED_GAME_HEIGHT * (1 - INSECT_TOP_BOUNDARY_FACTOR);
            const insectMaxY = DEDICATED_GAME_HEIGHT - groundLevel - INSECT_TILE_SIZE;

            room.gameData.insects.forEach(insect => {
                const time = (Date.now() / 1000) + insect.timeOffset;

                // 1. Aktualizacja punktu centralnego (dryfowanie)
                insect.anchorX += insect.drift;
                if (insect.anchorX < 0 || insect.anchorX > worldWidth) {
                    insect.drift *= -1; // Odbij się od krawędzi świata
                }

                // 2. Obliczenie pozycji na bazie funkcji sinusoidalnych
                const offsetX = Math.sin(time * insect.hSpeed) * insect.hAmp;
                const offsetY = Math.cos(time * insect.vSpeed) * insect.vAmp;

                insect.x = insect.anchorX + offsetX;
                insect.y = insect.baseY + offsetY;

                // 3. Ograniczenie pozycji w pionie
                insect.y = Math.max(insectMinY, Math.min(insectMaxY, insect.y));

                // 4. Obliczenie rotacji na podstawie chwilowej prędkości poziomej
                // Prędkość to pochodna pozycji: d/dt(sin(t*k)) = k*cos(t*k)
                const currentHorizontalVelocity = Math.cos(time * insect.hSpeed) * insect.hAmp * insect.hSpeed;
                insect.angle = currentHorizontalVelocity * 0.5; // Mnożnik do dostosowania "czułości" obrotu

                // 5. Ograniczenie rotacji
                insect.angle = Math.max(-INSECT_MAX_ROTATION_DEGREES, Math.min(INSECT_MAX_ROTATION_DEGREES, insect.angle));

                // 6. Aktualizacja klatki animacji
                insect.animationFrame = (insect.animationFrame + 1) % (INSECT_ANIMATION_SPEED_TICKS * 2); // 2 klatki animacji
            });

            // Wysyłanie zaktualizowanego stanu insektów do klientów w pokoju
            io.to(roomId).emit('insectsUpdate', room.gameData.insects);
        }

        io.to(roomId).emit('playerMovedInRoom', Object.values(room.players));
    }
}, GAME_TICK_RATE);

function getPublicRoomList() {
    const publicRooms = {};
    for (const roomId in rooms) {
        publicRooms[roomId] = {
            id: rooms[roomId].id,
            name: rooms[roomId].name,
            hostId: rooms[roomId].hostId,
            playerCount: Object.keys(rooms[roomId].players).length,
            biome: rooms[roomId].gameData.biome,
            worldWidth: rooms[roomId].gameData.worldWidth,
            villageType: rooms[roomId].gameData.villageType
        };
    }
    return publicRooms;
}

server.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});