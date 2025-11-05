// host-worker.js

console.log('[DEBUG] Plik host-worker.js został załadowany i uruchomiony.');

const GUEST_TIMEOUT = 15000;
const PING_INTERVAL = 5000;

// ====================================================================================
// === SEKCJA 1: STAŁE GRY ===
// ====================================================================================

const AVAILABLE_BIOMES = ['jurassic', 'grassland'];
const WORLD_WIDTH_MIN = 4000;
const WORLD_WIDTH_MAX = 14000;
const DEDICATED_GAME_HEIGHT = 1080;
const PLAYER_SIZE = 128;
const GRAVITY = 1.6;
const JUMP_STRENGTH = -25;
const PLAYER_WALK_SPEED = 8.8;
const DECELERATION_FACTOR = 0.8;
const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.5;
const GAME_TICK_RATE = 1000 / 60;
const WATER_TOP_Y_WORLD = DEDICATED_GAME_HEIGHT - 164;
const FLOAT_GRAVITY = 0.3;
const FLOAT_WATER_FRICTION = 0.9;
const FLOAT_HITBOX_RADIUS = 16;
const CASTING_POWER_MULTIPLIER = 11.5;
const GRASS_SWAY_DURATION_MS = 1800;
const GRASS_DENSITY_FACTOR = 0.075;
const GRASS_SPRITE_WIDTH = 32 * 3.8;
const TREE_DENSITY_VARIATION_FACTOR = 0.55;
const TREE_FOREGROUND_CHANCE = 0.15;
const TREE_MIN_HORIZONTAL_GAP = 64;
const INSECT_DENSITY_FACTOR = 0.0009;
const MAX_CAST_DISTANCE = 850;
const MAX_PLAYER_FLOAT_DISTANCE = 950;
const MIN_PIER_DISTANCE = 600;
const DIGGING_COOLDOWN_MS = 2000;
const OBSTACLE_DENSITY_FACTOR = 0.001;
const MINING_COOLDOWN_MS = 2000;
const OBSTACLE_SCALE_FACTOR = 3.9;
const OBSTACLE_TYPE_DEFINITIONS = [
    { typeIndex: 0, sWidth: 32, sHeight: 18 }, // szer: 32, wys: 18
    { typeIndex: 1, sWidth: 32, sHeight: 18 }, // szer: 32, wys: 18
    { typeIndex: 2, sWidth: 64, sHeight: 18 }  // szer: 64, wys: 18
];
const VILLAGE_TYPE = { NONE: 'none', MINIMAL: 'minimal', MEDIUM: 'medium', LARGE: 'large' };
const VILLAGE_PROBABILITIES = [
    { type: VILLAGE_TYPE.NONE, weight: 40 }, { type: VILLAGE_TYPE.MINIMAL, weight: 32 },
    { type: VILLAGE_TYPE.MEDIUM, weight: 20 }, { type: VILLAGE_TYPE.LARGE, weight: 8 }
];
const VILLAGE_MIN_WORLD_X_OFFSET_PERCENT = 0.2;
const VILLAGE_MAX_WORLD_X_OFFSET_PERCENT = 0.8;
const BASE_BUILDING_SOURCE_TILE_SIZE = 128;
const AVAILABLE_BIOMES_DETAILS = {
    jurassic: {
        buildings: { definitions: [ { id: 'j_house1', x: 0, y: 0, width: 128, height: 128 }, { id: 'j_house2', x: 128, y: 0, width: 128, height: 128 }, { id: 'j_tower', x: 256, y: 0, width: 128, height: 128 } ], displayScaleFactor: 4.5 },
        treeDefinitionCount: 4, treeDensityBaseFactor: 0.0045
    },
    grassland: {
        buildings: { definitions: [ { id: 'g_hut1', x: 0, y: 0, width: 128, height: 128 }, { id: 'g_hut2', x: 128, y: 0, width: 128, height: 128 }, { id: 'g_farm', x: 256, y: 0, width: 128, height: 128 } ], displayScaleFactor: 4.5 },
        treeDefinitionCount: 4, treeDensityBaseFactor: 0.002
    }
};
const ORIGINAL_ARM_PIVOT_IN_IMAGE_X = Math.round(14 * (PLAYER_SIZE / 36));
const ORIGINAL_ARM_PIVOT_IN_IMAGE_Y = Math.round(15 * (PLAYER_SIZE / 36));
const ROD_TIP_OFFSET_X = Math.round(136 * (PLAYER_SIZE / 128));
const ROD_TIP_OFFSET_Y = Math.round(-38 * (PLAYER_SIZE / 128));
const FRONT_ARM_OFFSET_X = 0;
const ARM_OFFSET_Y_IN_PLAYER_SPACE = 0;

// I DODAJ POD NIM NOWY BLOK:
const AVAILABLE_GEMS = [
    { name: 'amethyst', tier: 3, chance: 60 },
    { name: 'echo crystal', tier: 4, chance: 25 },
    { name: 'ocean heart', tier: 4, chance: 15 }
];

// ====================================================================================
// === SEKCJA 2: FUNKCJE POMOCNICZE ===
// ====================================================================================

function getRandomGem() {
    const totalChanceWeight = AVAILABLE_GEMS.reduce((sum, gem) => sum + gem.chance, 0);
    let randomPick = Math.random() * totalChanceWeight;

    for (const gem of AVAILABLE_GEMS) {
        if (randomPick < gem.chance) {
            return { name: gem.name, tier: gem.tier };
        }
        randomPick -= gem.chance;
    }
    return null; // Na wszelki wypadek
}


function createSeededRandom(seedStr) {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) { seed = (seed * 31 + seedStr.charCodeAt(i)) | 0; }
    if (seed === 0) seed = 1;
    return () => (seed = (seed * 1664525 + 1013904223) | 0) / 4294967296;
}

function generateObstacles(roomId, groundLevel, worldWidth) {
    const obstacles = [];
    const seededRandom = createSeededRandom(roomId + '-obstacles');
    const groundY = DEDICATED_GAME_HEIGHT - groundLevel;
    const numObstacles = Math.floor(worldWidth * OBSTACLE_DENSITY_FACTOR);
    const MIN_GAP = 500;

    for (let i = 0; i < numObstacles; i++) {
        let attempts = 0;
        while (attempts < 20) {
            const typeDef = OBSTACLE_TYPE_DEFINITIONS[Math.floor(seededRandom() * OBSTACLE_TYPE_DEFINITIONS.length)];
            const width = typeDef.sWidth * OBSTACLE_SCALE_FACTOR;
            const height = typeDef.sHeight * OBSTACLE_SCALE_FACTOR;
            const potentialX = seededRandom() * (worldWidth - width);
            
            const isOverlapping = obstacles.some(obs => Math.abs(potentialX - obs.x) < obs.width / 2 + width / 2 + MIN_GAP);

            if (!isOverlapping) {
                obstacles.push({
                    id: `obstacle_${i}`, x: potentialX,
                    // === POPRAWKA POZYCJI Y ===
                    // Dodajemy +4, aby przeszkoda wizualnie "wtopiła się" w ziemię.
                    y: groundY - height + 4,
                    width: width, height: height, typeIndex: typeDef.typeIndex
                });
                break;
            }
            attempts++;
        }
    }
    return obstacles;
}

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

function getRandomBait() {
    const baitData = {
        'worm': { chance: 65, name: 'worm' },
        'bloodworm': { chance: 25, name: 'bloodworm' },
        'maggots': { chance: 55, name: 'maggots' },
        'beetle larvae': { chance: 15, name: 'beetle larvae' },
        'dung worm': { chance: 10, name: 'dung worm' },
    };
    const availableBaits = Object.values(baitData);
    if (availableBaits.length === 0) return null;

    const totalChanceWeight = availableBaits.reduce((sum, bait) => sum + bait.chance, 0);
    let randomPick = Math.random() * totalChanceWeight;

    for (const bait of availableBaits) {
        if (randomPick < bait.chance) {
            return bait; 
        }
        randomPick -= bait.chance;
    }
    return null;
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
            typeIndex: Math.floor(seededRandom() * 13),
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

    // --- ZMODYFIKOWANE LINIE ---
    const roomDensityModifier = 1 + (seededRandom() * 2 - 1) * TREE_DENSITY_VARIATION_FACTOR;
    const densityFactor = biomeDetails.treeDensityBaseFactor || 0.01; // Użyj gęstości z definicji biomu
    const numTrees = Math.floor(worldWidth * densityFactor * roomDensityModifier);


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
// === SEKCJA 3: GŁÓWNA KLASA GAMEHOST ===
// ====================================================================================

class GameHost {
    constructor() {
        this.room = null;
        this.gameLoopInterval = null;
        this.pingInterval = null;
        this.weatherInterval = null; // <-- DODAJ TĘ LINIĘ
        this.digCooldowns = {};

// I DODAJ POD NIM LINIĘ:
        this.miningCooldowns = {}; // <-- DODANA LINIA
    }

    broadcast(message) {
        postMessage({
            type: 'broadcast',
            message: message
        });
    }
    
    sendTo(peerId, message) {
        postMessage({
            type: 'sendTo',
            peerId: peerId,
            message: message
        });
    }

    _updateScoreboard(peerId, username, fishName, size) {
        if (!this.room) return;
        const scoreboard = this.room.roomScoreboard;
        const playerIndex = scoreboard.findIndex(p => p.peerId === peerId);
        let needsUpdate = false;

        if (playerIndex !== -1) {
            // Gracz jest już na tablicy, zaktualizuj, jeśli nowa ryba jest większa
            if (size > scoreboard[playerIndex].size) {
                scoreboard[playerIndex].fishName = fishName;
                scoreboard[playerIndex].size = size;
                needsUpdate = true;
            }
        } else {
            // Dodaj nowego gracza do tablicy
            scoreboard.push({ peerId, username, fishName, size });
            needsUpdate = true;
        }

        if (needsUpdate) {
            // Posortuj od największej do najmniejszej i ogranicz do 4 najlepszych
            scoreboard.sort((a, b) => b.size - a.size);
            if (scoreboard.length > 4) {
                this.room.roomScoreboard = scoreboard.slice(0, 4);
            }

            // Roześlij zaktualizowaną tablicę do wszystkich graczy
            this.broadcast({
                type: 'scoreboardUpdate',
                payload: this.room.roomScoreboard
            });
        }
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
            dynamicObjects: [], // NOWA LINIA
            worldItems: [],
            roomScoreboard: [] ,
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
                obstacles: [],
                totem: null, // <-- NOWA LINIA: Inicjalizujemy totem jako null
                initialCycleRotation: Math.random() * (Math.PI * 2),
                roomCreationTimestamp: Date.now(),
                weather: 'clearsky'
            },
            playerInputs: {}
        };

        // === POCZĄTEK ZMIAN: Logika generowania totemu ===
        const totemSpawnChance = roomSeededRandom();
        if (totemSpawnChance <= 0.9) {
            const groundLevel = this.room.gameData.groundLevel;
            
            // --- NOWE ZMIANY: Przeskalowanie totemu ---
            const totemBaseHeight = 60;
            const totemScale = 3.8;
            const totemHeight = totemBaseHeight * totemScale;
            // --- KONIEC NOWYCH ZMIAN ---
            
            // Losuj pozycję w środkowych 40% świata
            const middleZoneStart = randomWorldWidth * 0.3;
            const middleZoneWidth = randomWorldWidth * 0.4;
            const totemX = middleZoneStart + roomSeededRandom() * middleZoneWidth;
            const totemY = DEDICATED_GAME_HEIGHT - groundLevel - totemHeight; // Ta linia teraz używa poprawnej, większej wysokości

            this.room.gameData.totem = {
            x: totemX,
            y: totemY,
            state: 'IDLE', // Nazwa stanu z klasy Totem
            stateTimer: 0, // Czas pozostały
            // Te wartości są potrzebne, aby łatwo obliczyć czas trwania faz po stronie serwera
            phaseDurations: {
                PHASE1_DURATION: 1.5,
                PHASE2_DURATION: 2.0,
                PHASE3_DURATION: 1.5,
                PHASE4_DURATION: 2.5,
                TRANSITION_DURATION: 1.5,
            }
        };
        console.log(`[HOST-WORKER] Wygenerowano totem w biomie ${randomBiome} na pozycji X: ${totemX}`);
        } else {
            console.log('[HOST-WORKER] Totem nie został wygenerowany (10% szans na brak).');
        }
        // === KONIEC ZMIAN ===
        
        this.room.gameData.placedBuildings = _generateBuildingsLayout(roomId, randomBiome, selectedVillageType, villageXPosition, randomWorldWidth);
        this.room.gameData.groundPlants = generateGroundPlants(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);
        this.room.gameData.trees = generateTrees(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth, randomBiome);
        this.room.gameData.insects = generateInsects(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);
        this.room.gameData.piers = generatePiers(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);
        this.room.gameData.obstacles = generateObstacles(roomId, this.room.gameData.groundLevel, this.room.gameData.worldWidth);
        console.log(`[HOST-WORKER] Gra wystartowała w pokoju ${roomId}`);
        
        this.gameLoopInterval = setInterval(() => this.updateGame(), GAME_TICK_RATE);
        this.pingInterval = setInterval(() => this.checkGuestHeartbeats(), PING_INTERVAL);
        this._changeWeather();
        this.weatherInterval = setInterval(() => this._changeWeather(), 60000);

        return {
            name: this.room.name,
            gameData: this.room.gameData
        };
    }

    stop() {
        if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.weatherInterval) clearInterval(this.weatherInterval); // <-- DODAJ TĘ LINIĘ
        this.gameLoopInterval = null;
        this.pingInterval = null;
        this.weatherInterval = null; // <-- DODAJ TĘ LINIĘ
        this.room = null;
        console.log("[HOST-WORKER] Gra zatrzymana i zresetowana.");
    }

    

    // <-- DODAJ CAŁĄ NOWĄ METODĘ PONIŻEJ -->
    _changeWeather() {
        if (!this.room) return;

        const rand = Math.random();
        let newWeather = 'clearsky';

        if (rand < 0.10) { newWeather = 'rainstorm'; } 
        else if (rand < 0.25) { newWeather = 'rain'; } 
        else if (rand < 0.50) { newWeather = 'drizzle'; }
        
        if (this.room.gameData.weather !== newWeather) {
            console.log(`[HOST-WORKER] Zmiana pogody na: ${newWeather}`);
            this.room.gameData.weather = newWeather;
            this.broadcast({
                type: 'weatherUpdate',
                payload: { newWeather: newWeather }
            });
        }
    }
    

    checkGuestHeartbeats() {
        if (!this.room || !this.room.players) return;
        const now = Date.now();

        for (const peerId in this.room.players) {
            // Nie pingujemy samego hosta
            if (peerId === this.room.hostId) continue;

            const player = this.room.players[peerId];
            
            // Sprawdź, czy gracz przekroczył limit czasu
            if (now - player.lastPongTime > GUEST_TIMEOUT) {
                console.log(`[HOST-WORKER-HEARTBEAT] Gość ${player.username} (${peerId}) przekroczył limit czasu. Usuwanie.`);
                this.removePlayer(peerId);
                // Kontynuuj pętlę, ponieważ removePlayer modyfikuje listę, po której iterujemy
                continue; 
            }
        }
        
        // Wyślij ping do wszystkich (goście i tak zignorują pingi do innych)
        this.broadcast({ type: 'ping' });
    }

     addPlayer(peerId, initialPlayerData) {
    console.log(`[HOST-WORKER] Gracz ${initialPlayerData.username} (${peerId}) dołącza.`);

    const initialY = DEDICATED_GAME_HEIGHT - this.room.gameData.groundLevel - PLAYER_SIZE;
    
    this.room.players[peerId] = {
        id: peerId, x: 50, y: initialY, color: initialPlayerData.color, username: initialPlayerData.username,
        selectedFlag: initialPlayerData.selectedFlag || 'pl', // <-- DODANA TA LINIA
        customizations: { ...initialPlayerData.customizations }, isJumping: false, velocityY: 0, 
        direction: 1, velocityX: 0, hasLineCast: false, floatWorldX: null, floatWorldY: null, 
        floatVelocityX: 0, floatVelocityY: 0, lineAnchorWorldX: null, lineAnchorWorldY: null, 
        rodTipWorldX: null, rodTipWorldY: null,
        meActionText: null, 
        meActionExpiry: null,
        // ======================= POCZĄTEK ZMIAN =======================
        chatMessageText: null,
        chatMessageExpiry: null
        // ======================== KONIEC ZMIAN =========================
    };
        this.room.playerInputs[peerId] = { keys: {} };
        
        this.sendTo(peerId, {
            type: 'roomJoined',
            payload: {
                roomId: this.room.id,
                roomName: this.room.name,
                playersInRoom: this.room.players,
                gameData: this.room.gameData,
                currentWeather: this.room.gameData.weather
            }
        });

        if (this.room.roomScoreboard.length > 0) {
            setTimeout(() => {
                this.sendTo(peerId, {
                    type: 'scoreboardUpdate',
                    payload: this.room.roomScoreboard
                });
            }, 250); // Małe opóźnienie, aby klient był gotowy
        }
    
        
        // ======================= POCZĄTEK ZMIAN =======================
        // Wyślij nowemu graczowi informację o starowym haczyku.
        // Robimy to w małym opóźnieniu, aby klient na pewno zdążył przetworzyć `roomJoined`.
        setTimeout(() => {
            this.sendTo(peerId, {
                type: 'awardStarterItem',
                payload: {
                    itemName: 'weedless',
                    itemTier: 0, // Domyślny tier
                    targetSlot: 'hook'
                }
            });
        }, 150);

        setTimeout(() => {
        this.broadcast({
                type: 'playerJoinedRoomNotification', // ZMIANA TUTAJ
                payload: {
                    username: this.room.players[peerId].username
                }
            });
        }, 100);
        // ======================== KONIEC ZMIAN =========================
        
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
         const username = this.room.players[peerId].username;
         console.log(`[HOST-WORKER] Gracz ${username} (${peerId}) opuścił grę.`);
         
         delete this.room.players[peerId];
         delete this.room.playerInputs[peerId];
         delete this.digCooldowns[peerId];

// I DODAJ POD NIM LINIĘ:
         delete this.miningCooldowns[peerId]; // <-- DODANA LINIA
         
         // === KLUCZOWA POPRAWKA ===
         // Musimy rozgłosić nie tylko notyfikację na czacie,
         // ale też informację dla klienta, aby FIZYCZNIE usunął gracza ze swojej lokalnej kopii stanu.
         this.broadcast({
            type: 'gameStateUpdate',
            payload: {
                players: Object.values(this.room.players), // Poprawiono `room` na `this.room`
                worldItems: this.room.worldItems,
                dynamicObjects: this.room.dynamicObjects 
            }
        });
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
    // NOWA AKCJA: Obsługa odpowiedzi 'pong' od gościa
    case 'pong':
        if (this.room && this.room.players[peerId]) {
            // === KLUCZOWA POPRAWKA ===
            // Aktualizujemy czas ostatniej odpowiedzi od gracza.
            this.room.players[peerId].lastPongTime = Date.now();
        }
        break;

        
        case 'changeWeather': {
        // Ta akcja może być wywołana tylko przez hosta
        if (peerId !== this.room.hostId) return;

        const rand = Math.random();
        let newWeather = 'clearsky';

        if (rand < 0.1) { // 10%
            newWeather = 'rainstorm';
        } else if (rand < 0.15) { // 15%
            newWeather = 'rain';
        } else if (rand < 0.35) { // 25%
            newWeather = 'drizzle';
        }
        
        // Jeśli pogoda się faktycznie zmienia, zapisz stan i rozgłoś
        if (this.room.gameData.weather !== newWeather) {
            console.log(`[HOST-WORKER] Zmiana pogody na: ${newWeather}`);
            this.room.gameData.weather = newWeather;
            this.broadcast({
                type: 'weatherUpdate',
                payload: { newWeather: newWeather }
            });
        }
        break;
        
    }

            // NOWY CASE START
            case 'sendDirectMessage': {
                const { targetNickname, message } = actionData.payload;
                const sender = this.room.players[peerId];
    
                if (!sender) return;
    
                const targetPlayer = Object.values(this.room.players).find(p => p.username.toLowerCase() === targetNickname.toLowerCase());
    
                if (targetPlayer && targetPlayer.id !== sender.id) {
                    this.sendTo(targetPlayer.id, {
                        type: 'directMessageReceived',
                        payload: { senderUsername: sender.username, message: message }
                    });
                    this.sendTo(sender.id, {
                        type: 'directMessageSent',
                        payload: { recipientUsername: targetPlayer.username, message: message }
                    });
                } else {
                    this.sendTo(sender.id, {
                        type: 'systemNotification',
                        payload: {
                            message: `Nie znaleziono gracza "${targetNickname}" lub nie możesz wysyłać wiadomości do siebie.`,
                            notificationType: 'error'
                        }
                    });
                }
                break;
            }
            // NOWY CASE KONIEC

            case 'sendMeCommand': {
            const actionText = actionData.payload.action;
            if (actionText && actionText.length > 0 && actionText.length <= 100) {
                this.broadcast({
                    type: 'meCommandBroadcast',
                    payload: {
                        peerId: peerId,
                        username: player.username,
                        action: actionText
                    }
                });
            }
            break;
        }

        case 'sendOverheadMessage': {
                const message = actionData.payload.message;
                if (message && message.length > 0 && message.length <= 100) {
                    this.broadcast({
                        type: 'overheadMessageBroadcast',
                        payload: {
                            peerId: peerId,
                            message: message
                        }
                    });
                }
                break;
            }

            case 'sendChatMessage': {
                const message = actionData.payload.message;
                if (message && message.length > 0 && message.length <= 100) {
                    console.log(`[HOST-WORKER] Czat od ${player.username}: ${message}`);
                    this.broadcast({
                        type: 'chatMessageBroadcast',
                        payload: {
                            username: player.username,
                            message: message
                        }
                    });
                }
                break;
            }

            case 'dropItem': {
                console.log(`[HOST-WORKER] Gracz ${player.username} wyrzucił ${actionData.payload.name}`);
                
                const direction = player.direction || 1; 

                const newItem = {
                    id: `item_${Date.now()}_${Math.random()}`,
                    data: actionData.payload,
                    x: player.x + (PLAYER_SIZE / 2) + (direction * PLAYER_SIZE * 0.6),
                    y: player.y - (PLAYER_SIZE * 0.2), 
                    velocityY: -8,
                    velocityX: direction * 4
                };
                this.room.worldItems.push(newItem);
                break;
            }
            case 'playerJump': {
                // Gracz może skoczyć tylko, jeśli nie jest już w powietrzu (czyli nie jest w trakcie skoku)
                // i jego prędkość pionowa jest bliska zeru (zapobiega "double jumpom").
                if (!player.isJumping && Math.abs(player.velocityY) < 1) {
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
    // ======================= POCZĄTEK ZMIAN =======================
    // Dodajemy 'scale' do destrukturyzacji
    const { fishName, size, tier, scale } = actionData.payload;
    // ======================== KONIEC ZMIAN =========================

    this.broadcast({
        type: 'fishCaughtBroadcast',
        payload: {
            playerId: peerId,
            fishName: fishName,
            size: size,
            tier: tier,
            // ======================= POCZĄTEK ZMIAN =======================
            scale: scale, // <-- Przekazujemy 'scale' dalej
            // ======================== KONIEC ZMIAN =========================
            startPos: { x: player.floatWorldX, y: player.floatWorldY }
        }
    });
    

    this.broadcast({
        type: 'fishCaughtNotification',
        payload: {
            username: player.username,
            fishName: fishName,
            size: size
        }
    });
    this._updateScoreboard(peerId, player.username, fishName, size);
    
    break;


}


            case 'activateTotem': {
            if (this.room.gameData.totem && this.room.gameData.totem.state === 'IDLE') {
                console.log(`[HOST-WORKER] Gracz ${player.username} aktywował totem.`);
                const totem = this.room.gameData.totem;
                totem.state = 'TOTEM_SHAKE_INCREASING';
                totem.stateTimer = totem.phaseDurations.PHASE1_DURATION;
                // Natychmiast rozgłoś zmianę, aby wszyscy gracze ją zobaczyli
                this.broadcast({
                    type: 'totemStateUpdate',
                    payload: {
                        newState: totem.state,
                        remainingTime: totem.stateTimer
                    }
                });
            }
            break;
        }

        // === POCZĄTEK ZMIAN ===
        case 'createDynamicObject': {
            if (!player) return;

            // Znajdź wszystkie obiekty należące do gracza
            const ownedObjects = this.room.dynamicObjects.filter(obj => obj.ownerId === peerId);
            
            // Jeśli gracz ma 4 lub więcej obiektów, usuń najstarszy
            if (ownedObjects.length >= 4) {
                // Najstarszy to pierwszy obiekt w odfiltrowanej tablicy
                const oldestObjectId = ownedObjects[0].id;
                const indexToRemove = this.room.dynamicObjects.findIndex(obj => obj.id === oldestObjectId);
                
                if (indexToRemove > -1) {
                    this.room.dynamicObjects.splice(indexToRemove, 1);
                }
            }
            
            // Zawsze twórz nowy obiekt
            const direction = Math.random() < 0.5 ? -1 : 1;
            const offset = 60 + Math.random() * 40;
            
            const newObject = {
                id: `dyn_${peerId}_${Date.now()}`,
                ownerId: peerId,
                type: Math.floor(Math.random() * 8) + 1, // Losowy typ od 1 do 8
                x: player.x + (PLAYER_SIZE / 2) + (offset * direction),
                y: DEDICATED_GAME_HEIGHT - this.room.gameData.groundLevel, // Finalna pozycja Y na ziemi
            };
            this.room.dynamicObjects.push(newObject);
            break;
        }
        // === KONIEC ZMIAN ===
            case 'digForBait': {
                const now = Date.now();
                const lastDigTime = this.digCooldowns[peerId] || 0;

                if (now - lastDigTime < DIGGING_COOLDOWN_MS) {
                    return;
                }

                this.digCooldowns[peerId] = now;

                const dugBait = getRandomBait();
                if (dugBait) {
                    
                    
                    this.broadcast({
                        type: 'baitDugBroadcast',
                        payload: {
                            playerId: peerId,
                            bait: dugBait,
                            startPos: actionData.payload
                        }
                    });

                    this.sendTo(peerId, {
                        type: 'dugBaitAwarded',
                        payload: {
                            baitData: dugBait
                        }
                    });
                }
                break;
            }
            case 'mineObstacle': {
    const now = Date.now();
    const lastMineTime = this.miningCooldowns[peerId] || 0;

    if (now - lastMineTime < MINING_COOLDOWN_MS) {
        return; // Gracz jest na cooldownie
    }

    this.miningCooldowns[peerId] = now;

    const obstacle = this.room.gameData.obstacles.find(o => o.id === actionData.payload.obstacleId);
    if (!obstacle) return;

    // Rozgłoś informację o uderzeniu w kamień do wszystkich graczy
    this.broadcast({
        type: 'obstacleMined',
        payload: {
            obstacleId: obstacle.id
        }
    });

    // Sprawdź 90% szansy na drop
    if (Math.random() < 0.8) {
        const gem = getRandomGem();
        if (gem) {
            // Roześlij informację o animacji do wszystkich
            this.broadcast({
                type: 'gemMinedBroadcast',
                payload: {
                    playerId: peerId,
                    gemData: gem,
                    startPos: { x: obstacle.x + obstacle.width / 2, y: obstacle.y }
                }
            });

            // Przyznaj przedmiot tylko graczowi, który kopał
            this.sendTo(peerId, {
                type: 'gemAwarded',
                payload: { gemData: gem }
            });
        }
    }
    break;
}}}

    // host-worker.js - ZASTĄP CAŁĄ FUNKCJĘ updateGame() W KLASIE GameHost

    updateGame() {
        if (!this.room) return;
        const room = this.room;
        const groundLevel = room.gameData.groundLevel;
        const worldWidth = room.gameData.worldWidth;
        const groundY_for_items = DEDICATED_GAME_HEIGHT - groundLevel - (92 * 0.7 / 2);
        if (room.gameData.totem && room.gameData.totem.state !== 'IDLE' && room.gameData.totem.state !== 'ACTIVE') {
        const totem = room.gameData.totem;
        const deltaTime = GAME_TICK_RATE / 1000; // Czas od ostatniej klatki w sekundach
        totem.stateTimer -= deltaTime;

        let stateChanged = false;

        if (totem.stateTimer <= 0) {
            stateChanged = true;
            switch (totem.state) {
                case 'TOTEM_SHAKE_INCREASING':
                    totem.state = 'SCREEN_SHAKE_INCREASING';
                    totem.stateTimer = totem.phaseDurations.PHASE2_DURATION;
                    break;
                case 'SCREEN_SHAKE_INCREASING':
                    totem.state = 'TOTEM_SHAKE_DECREASING';
                    totem.stateTimer = totem.phaseDurations.PHASE3_DURATION;
                    break;
                case 'TOTEM_SHAKE_DECREASING':
                    totem.state = 'SCREEN_SHAKE_DECREASING';
                    totem.stateTimer = totem.phaseDurations.PHASE4_DURATION;
                    break;
                case 'SCREEN_SHAKE_DECREASING':
                    totem.state = 'TRANSITIONING';
                    totem.stateTimer = totem.phaseDurations.TRANSITION_DURATION;
                    break;
                case 'TRANSITIONING':
                    totem.state = 'ACTIVE';
                    totem.stateTimer = 0; // Stan ACTIVE trwa w nieskończoność (lub do resetu serwera)
                    break;
            }
        }
        
        // Jeśli stan się zmienił, poinformuj o tym wszystkich graczy
        if (stateChanged) {
             this.broadcast({
                type: 'totemStateUpdate',
                payload: {
                    newState: totem.state,
                    remainingTime: totem.stateTimer
                }
            });
        }
    }

        // Aktualizacja przedmiotów leżących na ziemi (bez zmian)
        room.worldItems.forEach(item => {
            if (item.y < groundY_for_items) {
                item.velocityY += GRAVITY * 0.5;
                item.y += item.velocityY;
                item.x += item.velocityX;
            } else {
                item.y = groundY_for_items;
                item.velocityY = 0;
                item.velocityX *= 0.85; 
                if (Math.abs(item.velocityX) < 0.1) item.velocityX = 0;
                item.x += item.velocityX;
            }
        });

        // Główna pętla aktualizacji graczy (NOWA, ULEPSZONA LOGIKA)
        for (const playerId in room.players) {
            const player = room.players[playerId];
            const playerInput = room.playerInputs[playerId] || { keys: {} };
            const groundY = DEDICATED_GAME_HEIGHT - groundLevel - PLAYER_SIZE;

            // --- 1. RUCH POZIOMY I KOLIZJE BOCZNE ---
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
            
            const oldX = player.x;
            player.x += player.velocityX;

            // Definicja hitboxa gracza do kolizji bocznych (nieco węższy i wyższy)
            const playerSideHitbox = {
                x: player.x + PLAYER_SIZE * 0.3,
                y: player.y + PLAYER_SIZE * 0.1, // Zaczyna się trochę wyżej
                width: PLAYER_SIZE * 0.4,
                height: PLAYER_SIZE * 0.8 // Nie obejmuje samych stóp
            };

            for (const obstacle of room.gameData.obstacles) {
                if (
                    playerSideHitbox.x < obstacle.x + obstacle.width &&
                    playerSideHitbox.x + playerSideHitbox.width > obstacle.x &&
                    playerSideHitbox.y < obstacle.y + obstacle.height &&
                    playerSideHitbox.y + playerSideHitbox.height > obstacle.y
                ) {
                    player.x = oldX;
                    player.velocityX = 0;
                    break;
                }
            }
            player.x = Math.max(0, Math.min(worldWidth - PLAYER_SIZE, player.x));

            // --- 2. RUCH PIONOWY I KOLIZJE Z PLATFORMAMI ---
            const oldY = player.y;
            player.velocityY += GRAVITY;
            player.y += player.velocityY;

            let landedOnPlatform = false;
            
            // Definicja hitboxa stóp gracza
            const playerFeetHitbox = {
                x: player.x + PLAYER_SIZE * 0.3,
                width: PLAYER_SIZE * 0.4
            };

            // Sprawdzenie lądowania na przeszkodach
            if (player.velocityY >= 0) { // Sprawdzaj lądowanie tylko, gdy gracz spada
                for (const obstacle of room.gameData.obstacles) {
                    // Sprawdzenie, czy stopy gracza przecinają górną krawędź przeszkody
                    if (
                        oldY + PLAYER_SIZE <= obstacle.y && // Czy stopy były NAD przeszkodą?
                        player.y + PLAYER_SIZE >= obstacle.y && // Czy stopy są TERAZ POD lub NA przeszkodzie?
                        playerFeetHitbox.x < obstacle.x + obstacle.width && // Czy jest kolizja pozioma?
                        playerFeetHitbox.x + playerFeetHitbox.width > obstacle.x
                    ) {
                        player.y = obstacle.y - PLAYER_SIZE; // Ustaw gracza na wierzchu
                        player.velocityY = 0;
                        player.isJumping = false;
                        landedOnPlatform = true;
                        break; // Gracz wylądował, nie ma potrzeby sprawdzać dalej
                    }
                }
            }

            // Sprawdzenie lądowania na głównej ziemi, jeśli nie wylądowano na platformie
            if (!landedOnPlatform && player.y >= groundY) {
                player.y = groundY;
                player.isJumping = false;
                player.velocityY = 0;
            }
            
            // --- 3. KOLIZJE Z GŁOWĄ ---
            if (player.velocityY < 0) { // Sprawdzaj uderzenia głową tylko, gdy gracz leci w górę
                 for (const obstacle of room.gameData.obstacles) {
                    if (
                        oldY >= obstacle.y + obstacle.height &&
                        player.y <= obstacle.y + obstacle.height &&
                        playerFeetHitbox.x < obstacle.x + obstacle.width &&
                        playerFeetHitbox.x + playerFeetHitbox.width > obstacle.x
                    ) {
                        player.y = obstacle.y + obstacle.height; // Odepchnij gracza w dół
                        player.velocityY = 0; // Zatrzymaj ruch w górę
                        break;
                    }
                }
            }


            // --- 4. POZOSTAŁA LOGIKA (TRAWA, WĘDKA ITD.) ---
            const playerGrassHitbox = { x: player.x + PLAYER_SIZE * 0.25, y: player.y + PLAYER_SIZE * 0.8, width: PLAYER_SIZE * 0.5, height: PLAYER_SIZE * 0.2 };
            room.gameData.groundPlants.forEach(grass => {
                if (grass.swaying && Date.now() - grass.swayStartTime > GRASS_SWAY_DURATION_MS) grass.swaying = false;
                if (!grass.swaying && player.velocityX !== 0) {
                    const grassHitbox = { x: grass.x, y: grass.y - 20, width: GRASS_SPRITE_WIDTH / 2, height: 20 };
                    if (playerGrassHitbox.x < grassHitbox.x + grassHitbox.width && playerGrassHitbox.x + playerGrassHitbox.width > grassHitbox.x) {
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
                if (item.velocityY === 0) {
                    const playerCenterX = player.x + PLAYER_SIZE / 2;
                    const playerCenterY = player.y + PLAYER_SIZE / 2;
                    
                    const distance = Math.hypot(playerCenterX - item.x, playerCenterY - item.y);
                    const pickupRadius = PLAYER_SIZE / 2;

                    if (distance < pickupRadius) {
                        console.log(`[HOST-WORKER] Gracz ${player.username} podniósł ${item.data.name}`);
                        this.sendTo(playerId, { type: 'itemPickedUp', payload: item.data });
                        room.worldItems.splice(i, 1);
                    }
                }
            }
        }

this.broadcast({
            type: 'gameStateUpdate',
            payload: {
                players: Object.values(room.players),
                worldItems: room.worldItems,
                dynamicObjects: room.dynamicObjects // <-- DODAJ TĘ LINIĘ
            }
        });
    }}


// ====================================================================================
// === SEKCJA 4: MOST KOMUNIKACYJNY WORKERA ===
// ====================================================================================

let gameHostInstance = null;

self.onmessage = function(event) {
    const { type, payload } = event.data;

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
                const { peerId, keys, currentMouseX, currentMouseY } = payload;
                gameHostInstance.handlePlayerInput(peerId, { keys, currentMouseX, currentMouseY });
            }
            break;
            
        case 'playerAction':
            if (gameHostInstance) {
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