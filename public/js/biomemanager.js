class BiomeManager {
    constructor(worldWidth, gameHeight, tileSize = 32) {
        this.worldWidth = worldWidth;
        this.gameHeight = gameHeight;
        this.tileSize = tileSize;
        this.scaledTileSize = tileSize * 3.75;

        this.biomeTiles = {};
        this.biomeBuildingsImages = {};
        this.biomeInsectImages = {}; // NOWA ZMIENNA DO PRZECHOWYWANIA OBRAZKÓW INSEKTÓW

        this.backgroundImage = new Image();
        this.backgroundLoaded = false;
        this.background2Image = new Image();
        this.background2Loaded = false;

        this.currentVillageType = 'none';
        this.currentVillageXPosition = null;
        this.placedBuildings = [];

        this.waterScrollX = 0;
        this.waterOscillationTime = 0;
        this.WATER_SCROLL_SPEED = 10;
        this.WATER_OSCILLATION_AMPLITUDE = 3;
        this.WATER_OSCILLATION_SPEED = 1;
        this.WATER_ANIMATION_TILE_SPEED = 0;
        this.currentWaterTileFrame = 0;

        const BASE_BUILDING_SOURCE_TILE_SIZE = 128;

        this.biomeDefinitions = {
            jurassic: {
                backgroundPath: 'img/world/biome/jurassic/background.png',
                background2Path: 'img/world/biome/jurassic/background2.png',
                imgPath: 'img/world/biome/jurassic/ground.png',
                buildingsPath: 'img/world/biome/jurassic/buildings.png',
                insectPath: 'img/world/biome/jurassic/insect.png', // <-- NOWA ŚCIEŻKA
                buildingDefinitions: [
                    { id: 'j_house1', x: 0, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                    { id: 'j_house2', x: BASE_BUILDING_SOURCE_TILE_SIZE, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                    { id: 'j_tower', x: BASE_BUILDING_SOURCE_TILE_SIZE * 2, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                ],
                buildingDisplayScaleFactor: 2.5,
                treesPath: 'img/world/biome/jurassic/trees.png',
                treeDefinitions: [
                    { x: 0,   y: 0, width: 128, height: 256 }, { x: 128, y: 0, width: 128, height: 256 },
                    { x: 256, y: 0, width: 128, height: 256 }, { x: 384, y: 0, width: 128, height: 256 },
                    { x: 512, y: 0, width: 128, height: 256 }, { x: 640, y: 0, width: 128, height: 256 },
                    { x: 768, y: 0, width: 128, height: 256 }, { x: 896, y: 0, width: 128, height: 256 },
                ],
                tileMap: {
                    grass: { x: 0, y: 0, width: 32, height: 32 }, ground1: { x: 32, y: 0, width: 32, height: 32 },
                    ground2: { x: 64, y: 0, width: 32, height: 32 }, ground3: { x: 96, y: 0, width: 32, height: 32 },
                    ground_repeat: { x: 128, y: 0, width: 32, height: 32 }, water_anim1: { x: 128, y: 0, width: 32, height: 32 },
                    water_anim2: { x: 160, y: 0, width: 32, height: 32 }, water_repeat: { x: 192, y: 0, width: 32, height: 32 },
                    ground_variant_224: { x: 224, y: 0, width: 32, height: 32 }, ground_variant_256: { x: 256, y: 0, width: 32, height: 32 }
                },
                layerHeights: {
                    grass: 1, ground1: 1, ground2: 1, ground3: 3, ground_repeat: 0, water_anim1: 1, water_anim2: 1,
                    water_repeat: 0, ground_variant_224: 1, ground_variant_256: 1
                },
                waterPlantsPath: 'img/world/biome/jurassic/waterplants.png',
                groundPlantsPath: 'img/world/biome/jurassic/groundplants.png',
                groundPlantDefinitions: [
                    { x: 0, y: 0, width: 32, height: 64 }, { x: 32, y: 0, width: 32, height: 64 }, { x: 64, y: 0, width: 32, height: 64 },
                    { x: 96, y: 0, width: 32, height: 64 }, { x: 128, y: 0, width: 32, height: 64 }, { x: 160, y: 0, width: 32, height: 64 },
                    { x: 192, y: 0, width: 32, height: 64 }, { x: 224, y: 0, width: 64, height: 64 }, { x: 288, y: 0, width: 32, height: 64 },
                    { x: 320, y: 0, width: 32, height: 64 }, { x: 352, y: 0, width: 32, height: 64 }, { x: 384, y: 0, width: 32, height: 64 }
                ],
                waterPlantDefinitions: [
                    { y: 0, x: 0, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 32, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 64, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 96, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 128, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 },
                    { y: 0, x: 160, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 },
                    { y: 0, x: 192, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 },
                    { y: 0, x: 224, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 }
                ]
            },
            grassland: {
                backgroundPath: 'img/world/biome/grassland/background.png',
                background2Path: 'img/world/biome/grassland/background2.png',
                imgPath: 'img/world/biome/grassland/ground.png',
                buildingsPath: 'img/world/biome/grassland/buildings.png',
                insectPath: 'img/world/biome/grassland/insect.png', // <-- NOWA ŚCIEŻKA
                buildingDefinitions: [
                    { id: 'g_hut1', x: 0, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                    { id: 'g_hut2', x: BASE_BUILDING_SOURCE_TILE_SIZE, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                    { id: 'g_farm', x: BASE_BUILDING_SOURCE_TILE_SIZE * 2, y: 0, width: BASE_BUILDING_SOURCE_TILE_SIZE, height: BASE_BUILDING_SOURCE_TILE_SIZE },
                ],
                buildingDisplayScaleFactor: 2.0,
                treesPath: 'img/world/biome/grassland/trees.png',
                treeDefinitions: [
                    { x: 0,   y: 0, width: 128, height: 256 }, { x: 128, y: 0, width: 128, height: 256 },
                    { x: 256, y: 0, width: 128, height: 256 }, { x: 384, y: 0, width: 128, height: 256 },
                    { x: 512, y: 0, width: 128, height: 256 }, { x: 640, y: 0, width: 128, height: 256 },
                    { x: 768, y: 0, width: 128, height: 256 }, { x: 896, y: 0, width: 128, height: 256 },
                ],
                tileMap: {
                    grass: { x: 0, y: 0, width: 32, height: 32 }, ground1: { x: 32, y: 0, width: 32, height: 32 },
                    ground2: { x: 64, y: 0, width: 32, height: 32 }, ground3: { x: 96, y: 0, width: 32, height: 32 },
                    ground_repeat: { x: 128, y: 0, width: 32, height: 32 }, water_anim1: { x: 128, y: 0, width: 32, height: 32 },
                    water_anim2: { x: 160, y: 0, width: 32, height: 32 }, water_repeat: { x: 192, y: 0, width: 32, height: 32 },
                    ground_variant_224: { x: 224, y: 0, width: 32, height: 32 }, ground_variant_256: { x: 256, y: 0, width: 32, height: 32 }
                },
                layerHeights: {
                    grass: 1, ground1: 1, ground2: 1, ground3: 3, ground_repeat: 0, water_anim1: 1, water_anim2: 1,
                    water_repeat: 0, ground_variant_224: 1, ground_variant_256: 1
                },
                waterPlantsPath: 'img/world/biome/grassland/waterplants.png',
                groundPlantsPath: 'img/world/biome/grassland/groundplants.png',
                groundPlantDefinitions: [
                    { x: 0, y: 0, width: 32, height: 64 }, { x: 32, y: 0, width: 32, height: 64 }, { x: 64, y: 0, width: 32, height: 64 },
                    { x: 96, y: 0, width: 32, height: 64 }, { x: 128, y: 0, width: 32, height: 64 }, { x: 160, y: 0, width: 32, height: 64 },
                    { x: 192, y: 0, width: 32, height: 64 }, { x: 224, y: 0, width: 64, height: 64 }, { x: 288, y: 0, width: 32, height: 64 },
                    { x: 320, y: 0, width: 32, height: 64 }, { x: 352, y: 0, width: 32, height: 64 }, { x: 384, y: 0, width: 32, height: 64 }
                ],
                waterPlantDefinitions: [
                    { y: 0, x: 0, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 32, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 64, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 96, width: 32, height: 64, layer: 'front', canBeMirrored: true, zIndex: 1 },
                    { y: 0, x: 128, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 },
                    { y: 0, x: 160, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 },
                    { y: 0, x: 192, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 },
                    { y: 0, x: 224, width: 32, height: 64, layer: 'background', canBeMirrored: true, zIndex: -1 }
                ]
            }
        };

        this.currentBiomeName = 'jurassic';
        this.currentBiomeDef = this.biomeDefinitions[this.currentBiomeName];
        this.WATER_TOP_Y_WORLD = this.gameHeight - 172;
        this.WATER_HEIGHT_WORLD = 512;
        this.WATER_COLOR = '#4683b404';
        this.waterPlantsImage = new Image();
        this.waterPlantsLoaded = false;
        this.waterPlantsImage.onload = () => { this.waterPlantsLoaded = true; };
        this.waterPlantsImage.onerror = () => { console.error(`Failed to load waterplants.png for biome: ${this.currentBiomeName}`); };
        this.groundPlantsImage = new Image();
        this.groundPlantsLoaded = false;
        this.groundPlantsImage.onload = () => { this.groundPlantsLoaded = true; };
        this.groundPlantsImage.onerror = () => { console.error(`Failed to load groundplants.png for biome: ${this.currentBiomeName}`); };
        this.treesImage = new Image();
        this.treesLoaded = false;
        this.treesImage.onload = () => { this.treesLoaded = true; };
        this.treesImage.onerror = () => { console.error(`Failed to load trees.png for biome: ${this.currentBiomeName}`); };
        this.treeDefinitions = [];
        this.backgroundTrees = [];
        this.foregroundTrees = [];
        this.TREE_VERTICAL_OFFSET = 2;
        this.TREE_MIN_SCALE = 2.7;
        this.TREE_MAX_SCALE = 3.6;
        this.groundPlantDefinitions = [];
        this.waterPlantDefinitions = [];
        this.frontWaterPlants = [];
        this.backgroundWaterPlants = [];
        this.backgroundGroundPlants = [];
        this.foregroundGroundPlants = [];
        this.GROUNDGRASS_VERTICAL_OFFSET = 2;
        this.GROUNDGRASS_MIN_SCALE = 2.2;
        this.GROUNDGRASS_MAX_SCALE = 3.6;
        this.placedWaterPlants = [];
        this.WATER_PLANT_SPAWN_INTERVAL = 30;
        this.WATER_PLANT_MAX_COUNT = Math.ceil(this.worldWidth / this.WATER_PLANT_SPAWN_INTERVAL) * 2;
        this.FRONT_WATER_PLANTS_OFFSET_Y = 50;
        this.firstLayerTilesGrid = [];
        this.setBiome(this.currentBiomeName);
        this._generateFirstLayerTileGrid();
    }

    // === NOWA FUNKCJA DO POBIERANIA OBRAZKA INSEKTA ===
    getCurrentInsectImage() {
        return this.biomeInsectImages[this.currentBiomeName];
    }

    _loadBuildingImageForBiome(biomeName) {
        const biomeDef = this.biomeDefinitions[biomeName];
        if (!biomeDef || !biomeDef.buildingsPath) { return; }
        if (this.biomeBuildingsImages[biomeName] && this.biomeBuildingsImages[biomeName].complete) { return; }
        const img = new Image();
        img.src = biomeDef.buildingsPath;
        img.onload = () => { this.biomeBuildingsImages[biomeName] = img; };
        img.onerror = () => { this.biomeBuildingsImages[biomeName] = null; };
    }

    setBiome(newBiomeName) {
        if (!this.biomeDefinitions[newBiomeName]) { return; }
        this.currentBiomeName = newBiomeName;
        this.currentBiomeDef = this.biomeDefinitions[newBiomeName];
        this.waterPlantsLoaded = false;
        this.groundPlantsLoaded = false;
        this.treesLoaded = false;
        this.backgroundLoaded = false;
        this.background2Loaded = false;
        if (this.currentBiomeDef.backgroundPath) {
            this.backgroundImage.onload = () => { this.backgroundLoaded = true; };
            this.backgroundImage.onerror = () => { console.error(`Failed to load background.png for ${newBiomeName}`); };
            this.backgroundImage.src = this.currentBiomeDef.backgroundPath;
        }
        if (this.currentBiomeDef.background2Path) {
            this.background2Image.onload = () => { this.background2Loaded = true; };
            this.background2Image.onerror = () => { console.error(`Failed to load background2.png for ${newBiomeName}`); };
            this.background2Image.src = this.currentBiomeDef.background2Path;
        }
        this.waterPlantsImage.src = this.currentBiomeDef.waterPlantsPath;
        this.groundPlantsImage.src = this.currentBiomeDef.groundPlantsPath;
        this.treesImage.src = this.currentBiomeDef.treesPath;
        this._loadBuildingImageForBiome(newBiomeName);
        this.groundPlantDefinitions = this.currentBiomeDef.groundPlantDefinitions || [];
        this.waterPlantDefinitions = this.currentBiomeDef.waterPlantDefinitions || [];
        this.treeDefinitions = this.currentBiomeDef.treeDefinitions || [];
        this.frontWaterPlants = this.waterPlantDefinitions.filter(p => p.layer === 'front');
        this.backgroundWaterPlants = this.waterPlantDefinitions.filter(p => p.layer === 'background');
        this.initializeWaterPlants();
        this._generateFirstLayerTileGrid();
    }

    setVillageData(villageType, villageXPosition, placedBuildingsData) {
        this.currentVillageType = villageType;
        this.currentVillageXPosition = villageXPosition;
        this.placedBuildings = placedBuildingsData || [];
        this.placedBuildings.forEach(building => { building.isMirrored = Math.random() < 0.5; });
        this.placedBuildings.sort((a, b) => (a.y + a.height) - (b.y + b.height));
    }

    _generateFirstLayerTileGrid() {
        this.firstLayerTilesGrid = [];
        const numTilesX = Math.ceil(this.worldWidth / this.scaledTileSize);
        const possibleTiles = ['grass', 'ground_variant_224', 'ground_variant_256'];
        for (let x = 0; x < numTilesX; x++) {
            this.firstLayerTilesGrid.push(possibleTiles[Math.floor(Math.random() * possibleTiles.length)]);
        }
    }

    initializeGroundPlants(plantsData) {
        if (!plantsData || plantsData.length === 0) {
            this.backgroundGroundPlants = [];
            this.foregroundGroundPlants = [];
            return;
        }
        const allPlants = plantsData.map(serverPlant => ({
            ...serverPlant,
            definition: this.groundPlantDefinitions[serverPlant.typeIndex],
            scale: this.GROUNDGRASS_MIN_SCALE + Math.random() * (this.GROUNDGRASS_MAX_SCALE - this.GROUNDGRASS_MIN_SCALE),
            isSwaying: false, swayAnimationTime: 0, swayDirection: serverPlant.swayDirection || 1,
            zIndex: serverPlant.zIndex === undefined ? -1 : serverPlant.zIndex,
        }));
        this.backgroundGroundPlants = allPlants.filter(p => p.zIndex <= 0);
        this.foregroundGroundPlants = allPlants.filter(p => p.zIndex > 0);
    }

    initializeTrees(treesData) {
        if (!treesData || treesData.length === 0) {
            this.backgroundTrees = [];
            this.foregroundTrees = [];
            return;
        }
        const allTrees = treesData.map(serverTree => ({
            ...serverTree,
            definition: this.treeDefinitions[serverTree.typeIndex],
            scale: this.TREE_MIN_SCALE + Math.random() * (this.TREE_MAX_SCALE - this.TREE_MIN_SCALE),
            zIndex: serverTree.zIndex === undefined ? -1 : serverTree.zIndex,
        }));
        this.backgroundTrees = allTrees.filter(t => t.zIndex <= 0);
        this.foregroundTrees = allTrees.filter(t => t.zIndex > 0);
    }

    startSwayAnimation(grassId, direction) {
        let grass = this.backgroundGroundPlants.find(g => g.id === grassId) || this.foregroundGroundPlants.find(g => g.id === grassId);
        if (grass && !grass.isSwaying) {
            grass.isSwaying = true;
            grass.swayAnimationTime = 0;
            grass.swayDirection = direction || 1;
        }
    }

    _updateGroundPlantsAnimation(deltaTime) {
        const allPlants = [...this.backgroundGroundPlants, ...this.foregroundGroundPlants];
        const SWAY_DURATION = 1.8;
        allPlants.forEach(grass => {
            if (grass.isSwaying) {
                grass.swayAnimationTime += deltaTime;
                if (grass.swayAnimationTime >= SWAY_DURATION) {
                    grass.isSwaying = false;
                    grass.swayAnimationTime = 0;
                }
            }
        });
    }

    _drawSingleGrass(ctx, grass) {
        if (!this.groundPlantsLoaded || !grass.definition) { return; }
        const SWAY_DURATION = 1.8;
        const MAX_SWAY_ANGLE_RAD = 3.5 * (Math.PI / 180);
        const SWAY_FREQUENCY = 5;
        const DAMPING_FACTOR = 1.8;
        let rotation = 0;
        if (grass.isSwaying) {
            const damp = Math.exp(-DAMPING_FACTOR * grass.swayAnimationTime);
            const sway = Math.sin(grass.swayAnimationTime * SWAY_FREQUENCY * Math.PI);
            rotation = MAX_SWAY_ANGLE_RAD * sway * damp * grass.swayDirection;
        }
        const plantWidth = grass.definition.width * grass.scale;
        const plantHeight = grass.definition.height * grass.scale;
        ctx.save();
        const pivotX = grass.x + plantWidth / 2;
        const pivotY = grass.y + this.GROUNDGRASS_VERTICAL_OFFSET;
        ctx.translate(pivotX, pivotY);
        if (grass.isMirrored) { ctx.scale(-1, 1); }
        ctx.rotate(rotation);
        ctx.drawImage(this.groundPlantsImage, grass.definition.x, grass.definition.y,
            grass.definition.width, grass.definition.height, -plantWidth / 2, -plantHeight,
            plantWidth, plantHeight);
        ctx.restore();
    }

    drawBackgroundPlants(ctx) { this.backgroundGroundPlants.forEach(grass => this._drawSingleGrass(ctx, grass)); }
    drawForegroundPlants(ctx) { this.foregroundGroundPlants.forEach(grass => this._drawSingleGrass(ctx, grass)); }

    _drawSingleTree(ctx, tree) {
        if (!this.treesLoaded || !tree.definition) { return; }
        const treeWidth = tree.definition.width * tree.scale;
        const treeHeight = tree.definition.height * tree.scale;
        ctx.save();
        ctx.translate(tree.x + treeWidth / 2, tree.y);
        if (tree.isMirrored) { ctx.scale(-1, 1); }
        ctx.drawImage(this.treesImage, tree.definition.x, tree.definition.y,
            tree.definition.width, tree.definition.height, -treeWidth / 2, -treeHeight + this.TREE_VERTICAL_OFFSET,
            treeWidth, treeHeight);
        ctx.restore();
    }

    drawBackgroundTrees(ctx) { this.backgroundTrees.forEach(tree => this._drawSingleTree(ctx, tree)); }
    drawForegroundTrees(ctx) { this.foregroundTrees.forEach(tree => this._drawSingleTree(ctx, tree)); }

    initializeWaterPlants() {
        this.placedWaterPlants = [];
        if (!this.waterPlantDefinitions || this.waterPlantDefinitions.length === 0) { return; }
        const numPlants = this.WATER_PLANT_MAX_COUNT;
        this.WATER_PLANT_BASE_Y_LEVEL = this.WATER_TOP_Y_WORLD + this.scaledTileSize + 166;
        if (numPlants > 0) {
            for (let i = 0; i < numPlants; i++) {
                const spawnX = i * (this.worldWidth / numPlants) + (Math.random() - 0.5) * (this.worldWidth / numPlants / 2);
                this.addRandomWaterPlant(spawnX);
            }
            this.placedWaterPlants.sort((a, b) => a.definition.zIndex - b.definition.zIndex);
        }
    }

    addRandomWaterPlant(initialX) {
        const plantDefinition = this.waterPlantDefinitions[Math.floor(Math.random() * this.waterPlantDefinitions.length)];
        const scale = 3.45 + Math.random() * 1.65;
        const rotationAmplitude = (Math.random() * 0.12 + 0.02);
        const rotationSpeed = (Math.random() * 0.4 + 0.2);
        const isMirrored = plantDefinition.canBeMirrored && Math.random() < 0.5;
        this.placedWaterPlants.push({
            definition: plantDefinition, x: initialX, scale: scale,
            rotationAmplitude: rotationAmplitude, rotationSpeed: rotationSpeed,
            animationTime: Math.random() * Math.PI * 2, isMirrored: isMirrored
        });
    }

    updateWaterPlantsAnimation(deltaTime) {
        for (const plant of this.placedWaterPlants) {
            plant.animationTime += plant.rotationSpeed * deltaTime;
        }
    }

    drawBackground(ctx) {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, this.worldWidth, this.gameHeight);
    }

    // FINALNA, POPRAWIONA WERSJA `drawParallaxBackground`
    drawParallaxBackground(ctx, cameraX, cameraY, visibleWidth) {
        const frontLayerHFactor = 0.08;
        const backLayerHFactor = 0.18;
        const BG_WIDTH = 820*3.35; // Używane do bufora

        const verticalParallaxFactor = 0;
        const VERTICAL_OFFSET = 22;

        const parallaxY = cameraY * (1 - verticalParallaxFactor);

        // --- Rysowanie dalszej warstwy (background2) ---
        ctx.save();
        ctx.translate(cameraX, cameraY);
        const parallaxX2 = cameraX * (1 - backLayerHFactor);
        ctx.translate(0, -parallaxY + VERTICAL_OFFSET);
        this._drawParallaxLayer(ctx, this.background2Image, this.background2Loaded, parallaxX2, visibleWidth + BG_WIDTH);
        ctx.restore();

        // --- Rysowanie bliższej warstwy (background) ---
        ctx.save();
        ctx.translate(cameraX, cameraY);
        const parallaxX1 = cameraX * (1 - frontLayerHFactor);
        ctx.translate(0, -parallaxY + VERTICAL_OFFSET);
        this._drawParallaxLayer(ctx, this.backgroundImage, this.backgroundLoaded, parallaxX1, visibleWidth + BG_WIDTH);
        ctx.restore();
    }

    // I FINALNA, POPRAWIONA WERSJA `_drawParallaxLayer` do współpracy z powyższą
    _drawParallaxLayer(ctx, image, isLoaded, parallaxX, coverWidth) {
        if (!isLoaded || !image.complete || image.naturalWidth === 0) return;

        const BG_WIDTH = 820 * 3.35;
        const BG_HEIGHT = 256 * 3.35;

        const startX = Math.floor(parallaxX / BG_WIDTH) * BG_WIDTH;

        for (let currentX = startX; currentX < parallaxX + coverWidth; currentX += BG_WIDTH) {
            ctx.drawImage(image, currentX - parallaxX, 0, BG_WIDTH, BG_HEIGHT);
        }
    }

    updateWaterAnimation(deltaTime) {
        this.waterScrollX = (this.waterScrollX + this.WATER_SCROLL_SPEED * deltaTime) % this.scaledTileSize;
        this.waterOscillationTime += this.WATER_OSCILLATION_SPEED * deltaTime;
        this.currentWaterTileFrame = (this.currentWaterTileFrame + this.WATER_ANIMATION_TILE_SPEED * deltaTime);
        if (this.currentWaterTileFrame >= 2) this.currentWaterTileFrame -= 2;
        this.updateWaterPlantsAnimation(deltaTime);
    }

    updateAnimations(deltaTime) {
        this.updateWaterAnimation(deltaTime);
        this._updateGroundPlantsAnimation(deltaTime);
    }

    drawWater(ctx, biomeName, cameraX) {
        const biomeImage = this.biomeTiles[biomeName];
        const biomeDef = this.biomeDefinitions[biomeName];
        const waterOscillationY = Math.sin(this.waterOscillationTime) * this.WATER_OSCILLATION_AMPLITUDE;

        if (!biomeImage || !biomeDef || !biomeDef.tileMap.water_anim1) {
            ctx.fillStyle = this.WATER_COLOR;
            ctx.fillRect(0, this.WATER_TOP_Y_WORLD + waterOscillationY, this.worldWidth, this.WATER_HEIGHT_WORLD);
            return;
        }

        const numTilesX = Math.ceil(this.worldWidth / this.scaledTileSize) + 1;
        const currentAnimTileKey = Math.floor(this.currentWaterTileFrame) === 0 ? 'water_anim1' : 'water_anim2';
        const animatedWaterTile = biomeDef.tileMap[currentAnimTileKey];
        const waterRepeatTile = biomeDef.tileMap.water_repeat;
        const topWaterDrawY = this.WATER_TOP_Y_WORLD + waterOscillationY;
        const waterBottomY = this.WATER_TOP_Y_WORLD + this.WATER_HEIGHT_WORLD;

        this.drawWaterPlants(ctx, 'background', cameraX, waterOscillationY + 32);
        this.drawWaterPlants(ctx, 'front', cameraX, waterOscillationY + this.FRONT_WATER_PLANTS_OFFSET_Y);

        if (waterRepeatTile) {
            for (let y = topWaterDrawY + this.scaledTileSize; y < waterBottomY; y += this.scaledTileSize) {
                for (let x = -1; x < numTilesX; x++) {
                    ctx.drawImage(biomeImage, waterRepeatTile.x, waterRepeatTile.y, waterRepeatTile.width, waterRepeatTile.height, x * this.scaledTileSize + this.waterScrollX, y, this.scaledTileSize, this.scaledTileSize);
                }
            }
        }
        if (animatedWaterTile) {
            for (let x = -1; x < numTilesX; x++) {
                ctx.drawImage(biomeImage, animatedWaterTile.x, animatedWaterTile.y, animatedWaterTile.width, animatedWaterTile.height, x * this.scaledTileSize + this.waterScrollX, topWaterDrawY, this.scaledTileSize, this.scaledTileSize);
            }
        }
    }

    drawWaterPlants(ctx, layer, cameraX, waterOscillationY) {
        if (!this.waterPlantsLoaded) { return; }
        const visibleWorldLeft = cameraX;
        const visibleWorldRight = cameraX + this.worldWidth;
        for (const plant of this.placedWaterPlants) {
            if (plant.definition.layer !== layer) continue;
            const plantWidth = plant.definition.width * plant.scale;
            const plantHeight = plant.definition.height * plant.scale;
            const adjustedPlantY_world = this.WATER_PLANT_BASE_Y_LEVEL + waterOscillationY;
            if (plant.x + plantWidth < visibleWorldLeft || plant.x > visibleWorldRight) { continue; }
            ctx.save();
            const pivotX = plant.x + plantWidth / 2;
            ctx.translate(pivotX, adjustedPlantY_world);
            if (plant.isMirrored) { ctx.scale(-1, 1); }
            const rotation = Math.sin(plant.animationTime) * plant.rotationAmplitude;
            ctx.rotate(rotation);
            ctx.drawImage(this.waterPlantsImage, plant.definition.x, plant.definition.y,
                plant.definition.width, plant.definition.height, -plantWidth / 2, -plantHeight,
                plantWidth, plantHeight);
            ctx.restore();
        }
    }

    // === ZAKTUALIZOWANA FUNKCJA ŁADOWANIA OBRAZKÓW ===
    loadBiomeImages(onAllLoadedCallback) {
        const biomeNames = Object.keys(this.biomeDefinitions);
        const imagesToLoadPaths = new Set(); // Użyj Set, aby uniknąć duplikatów

        biomeNames.forEach(name => {
            const def = this.biomeDefinitions[name];
            if (def.imgPath) imagesToLoadPaths.add(def.imgPath);
            if (def.insectPath) imagesToLoadPaths.add(def.insectPath); // Dodaj ścieżkę do insekta
        });

        const pathArray = Array.from(imagesToLoadPaths);
        let loadedCount = 0;
        const totalImages = pathArray.length;

        if (totalImages === 0) {
            onAllLoadedCallback();
            return;
        }

        pathArray.forEach(src => {
            const img = new Image();
            img.src = src;

            const onLoaded = () => {
                loadedCount++;
                // Sprawdź, do którego biomu i jakiego typu należy ten obrazek
                for (const biomeName of biomeNames) {
                    const def = this.biomeDefinitions[biomeName];
                    if (def.imgPath === src) {
                        this.biomeTiles[biomeName] = img;
                    }
                    if (def.insectPath === src) { // NOWY WARUNEK
                        this.biomeInsectImages[biomeName] = img;
                    }
                }

                if (loadedCount === totalImages) {
                    onAllLoadedCallback();
                }
            };

            img.onload = onLoaded;
            img.onerror = () => {
                console.error(`Błąd ładowania obrazka biomu: ${src}`);
                onLoaded(); // Mimo błędu, kontynuuj, aby nie blokować gry
            };
        });
    }

    drawBackgroundBiomeGround(ctx, biomeName, groundLevel) {
        const biomeImage = this.biomeTiles[biomeName];
        if (!biomeImage) {
            ctx.fillStyle = 'brown';
            ctx.fillRect(0, this.gameHeight - groundLevel, this.worldWidth, groundLevel);
            return;
        }
        const biomeDef = this.biomeDefinitions[biomeName];
        if (!biomeDef) { return; }
        const numTilesX = Math.ceil(this.worldWidth / this.scaledTileSize);
        const worldGroundTopY = this.gameHeight - groundLevel;
        const backgroundLayerOrder = ['ground1', 'ground2', 'ground3', 'ground_repeat'];
        let currentDrawingY = worldGroundTopY + (biomeDef.layerHeights.grass * this.scaledTileSize);
        for (const layerKey of backgroundLayerOrder) {
            const layerConfig = biomeDef.tileMap[layerKey];
            const layerHeightCount = biomeDef.layerHeights[layerKey];
            if (!layerConfig) { continue; }
            if (layerKey === 'ground_repeat') {
                for (let y = currentDrawingY; y < this.gameHeight; y += this.scaledTileSize) {
                    for (let x = 0; x < numTilesX; x++) {
                        ctx.drawImage(biomeImage, layerConfig.x, layerConfig.y, layerConfig.width, layerConfig.height, x * this.scaledTileSize, y, this.scaledTileSize, this.scaledTileSize);
                    }
                }
            } else {
                for (let i = 0; i < layerHeightCount; i++) {
                    const y = currentDrawingY + (i * this.scaledTileSize);
                    for (let x = 0; x < numTilesX; x++) {
                        ctx.drawImage(biomeImage, layerConfig.x, layerConfig.y, layerConfig.width, layerConfig.height, x * this.scaledTileSize, y, this.scaledTileSize, this.scaledTileSize);
                    }
                }
                currentDrawingY += layerHeightCount * this.scaledTileSize;
            }
        }
    }

    drawForegroundBiomeGround(ctx, biomeName, groundLevel) {
        const biomeImage = this.biomeTiles[biomeName];
        if (!biomeImage) { return; }
        const biomeDef = this.biomeDefinitions[biomeName];
        if (!biomeDef || !biomeDef.tileMap.grass) { return; }
        const numTilesX = Math.ceil(this.worldWidth / this.scaledTileSize);
        const worldGroundTopY = this.gameHeight - groundLevel;
        for (let x = 0; x < numTilesX; x++) {
            const tileKey = this.firstLayerTilesGrid[x];
            const tileToDrawConfig = biomeDef.tileMap[tileKey] || biomeDef.tileMap.grass;
            ctx.drawImage(biomeImage, tileToDrawConfig.x, tileToDrawConfig.y, tileToDrawConfig.width, tileToDrawConfig.height, x * this.scaledTileSize, worldGroundTopY, this.scaledTileSize, this.scaledTileSize);
        }
    }

    drawBuildings(ctx, groundLevel, cameraX, clientVisibleWorldWidth) {
        if (this.currentVillageType === 'none' || this.placedBuildings.length === 0) { return; }
        const biomeBuildingImage = this.biomeBuildingsImages[this.currentBiomeName];
        if (!biomeBuildingImage || !biomeBuildingImage.complete) { return; }
        const biomeDef = this.currentBiomeDef;
        const worldGroundTopY = this.gameHeight - groundLevel;
        const visibleWorldLeft = cameraX;
        const visibleWorldRight = cameraX + clientVisibleWorldWidth;
        for (const building of this.placedBuildings) {
            const clientBuildingDefinition = biomeDef.buildingDefinitions.find(def => def.id === building.definitionId);
            if (!clientBuildingDefinition) { continue; }
            let drawX = building.x;
            const drawY = worldGroundTopY - building.height;
            if (drawX + building.width > visibleWorldLeft && drawX < visibleWorldRight) {
                ctx.save();
                if (building.isMirrored) {
                    ctx.translate(drawX + building.width, 0);
                    ctx.scale(-1, 1);
                    drawX = 0;
                }
                ctx.drawImage(biomeBuildingImage,
                    clientBuildingDefinition.x, clientBuildingDefinition.y, clientBuildingDefinition.width, clientBuildingDefinition.height,
                    drawX, drawY, building.width, building.height);
                ctx.restore();
            }
        }
    }
}