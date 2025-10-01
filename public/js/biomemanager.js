class BiomeManager {
    constructor(worldWidth, gameHeight, tileSize = 32) {
        this.worldWidth = worldWidth;
        this.gameHeight = gameHeight;
        this.tileSize = tileSize;
        this.scaledTileSize = tileSize * 3.75;

        this.biomeTiles = {};
        this.biomeBuildingsImages = {};
        this.biomeInsectImages = {};
        this.biomePierImages = {}; 
        this.biomePierSpanImages = {};

        this.placedPiers = [];     

        this.backgroundImage = new Image();
        this.backgroundLoaded = false;
        this.background2Image = new Image();
        this.background2Loaded = false;

        // ======================= POCZĄTEK ZMIAN DLA UNIKATOWEGO TŁA =======================
        this.biomeTileBackgroundImages = {}; // Obiekt do przechowywania teł dla różnych biomów
        this.tileBackgroundLoaded = false;   // Flaga ładowania dla bieżącego tła
        // ======================= KONIEC ZMIAN DLA UNIKATOWEGO TŁA ========================

        // ======================= POCZĄTEK NOWEGO KODU DLA CHMUR =======================
        this.cloudImage = new Image();
        this.cloudLoaded = false;
        this.clouds = [];
        
        this.cloudImage.src = 'img/world/clouds.png';
        this.cloudImage.onload = () => { this.cloudLoaded = true; };
        this.cloudImage.onerror = () => { console.error('Failed to load clouds.png'); };
        // ======================== KONIEC NOWEGO KODU DLA CHMUR ========================

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
        
        // Właściwości dla ogniska
        this.fireplaceImage = new Image();
        this.fireplaceLoaded = false;
        this.fireplaceFrame = 0;
        this.fireplaceAnimationTimer = 0;
        this.fireplaceObject = null;
        this.fireplaceParticles = [];
        this.particleSpawnTimer = 0;

        this.fireplaceImage.src = 'img/world/fireplace.png';
        this.fireplaceImage.onload = () => { this.fireplaceLoaded = true; };
        this.fireplaceImage.onerror = () => { console.error('Failed to load fireplace.png'); };

        // Właściwości dla smugi światła
        this.lightImage = new Image();
        this.lightLoaded = false;
        this.lightAlpha = 1.0;
        this.lightScale = 1.0;
        this.lightAnimationTime = 0;

        this.lightImage.src = 'img/world/light.png';
        this.lightImage.onload = () => { this.lightLoaded = true; };
        this.lightImage.onerror = () => { console.error('Failed to load light.png'); };

        // === POCZĄTEK ZMIAN ===
        // Właściwości dla kempingu
        this.campsiteImage = new Image();
        this.campsiteLoaded = false;
        this.campsiteObject = null;
         this.playerIsNearCamp = false;

         this.campsiteX = 0;
        this.campsiteY = 0;
        this.campsiteWidth = 0;
        this.campsiteHeight = 0;

        this.campsiteImage.src = 'img/world/camp.png';
        this.campsiteImage.onload = () => { this.campsiteLoaded = true; };
        this.campsiteImage.onerror = () => { console.error('Failed to load camp.png'); };
        // === KONIEC ZMIAN ===


        const BASE_BUILDING_SOURCE_TILE_SIZE = 128;

        this.biomeDefinitions = {
            jurassic: {
                // ======================= POCZĄTEK ZMIAN DLA UNIKATOWEGO TŁA =======================
                tileBackgroundPath: 'img/world/biome/jurassic/background_tile.png',
                // ======================= KONIEC ZMIAN DLA UNIKATOWEGO TŁA ========================
                backgroundPath: 'img/world/biome/jurassic/background.png',
                background2Path: 'img/world/biome/jurassic/background2.png',
                imgPath: 'img/world/biome/jurassic/ground.png',
                buildingsPath: 'img/world/biome/jurassic/buildings.png',
                insectPath: 'img/world/biome/jurassic/insect.png',
                pierPath: 'img/world/biome/jurassic/pier.png',
                pierSpanPath: 'img/world/biome/jurassic/pierspan.png',
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
                // ======================= POCZĄTEK ZMIAN DLA UNIKATOWEGO TŁA =======================
                tileBackgroundPath: 'img/world/biome/grassland/background_tile.png',
                // ======================= KONIEC ZMIAN DLA UNIKATOWEGO TŁA ========================
                backgroundPath: 'img/world/biome/grassland/background.png',
                background2Path: 'img/world/biome/grassland/background2.png',
                imgPath: 'img/world/biome/grassland/ground.png',
                buildingsPath: 'img/world/biome/grassland/buildings.png',
                insectPath: 'img/world/biome/grassland/insect.png',
                pierPath: 'img/world/biome/grassland/pier.png',
                pierSpanPath: 'img/world/biome/grassland/pierspan.png',
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
        this.TREE_VERTICAL_OFFSET = 0;
        this.TREE_MIN_SCALE = 2.7;
        this.TREE_MAX_SCALE = 3.6;
        this.groundPlantDefinitions = [];
        this.waterPlantDefinitions = [];
        this.frontWaterPlants = [];
        this.backgroundWaterPlants = [];
        this.backgroundGroundPlants = [];
        this.foregroundGroundPlants = [];
        this.GROUNDGRASS_VERTICAL_OFFSET = 0;
        this.GROUNDGRASS_MIN_SCALE = 2.2;
        this.GROUNDGRASS_MAX_SCALE = 3.6;
        this.placedWaterPlants = [];
        this.WATER_PLANT_SPAWN_INTERVAL = 30;
        this.WATER_PLANT_MAX_COUNT = Math.ceil(this.worldWidth / this.WATER_PLANT_SPAWN_INTERVAL) * 2;
        this.FRONT_WATER_PLANTS_OFFSET_Y = 50;
        this.firstLayerTilesGrid = [];
        this.fishData = null;       // Obiekt z danymi ryb z fishing.js
        this.fishImages = null;     // Obiekt z załadowanymi obrazami ryb
        this.swimmingFish = [];     // Tablica aktywnych, pływających ryb
        this.setBiome(this.currentBiomeName);
        this._generateFirstLayerTileGrid();
        this._initializeClouds(); // Inicjalizacja chmur
    }
    

    setPlayerProximity(isNear) { // <--- NOWOŚĆ
        this.playerIsNearCamp = isNear;
    }
    // ======================= POCZĄTEK NOWEGO KODU DLA CHMUR =======================
    /**
     * Inicjalizuje chmury, losując ich gęstość, pozycję, rozmiar, prędkość i wygląd.
     */
    _initializeClouds() {
        this.clouds = [];
        const isDense = Math.random() > 0.6; // 60% szans na gęste chmury
        const cloudCount = isDense ? 
            Math.floor(this.worldWidth / 60) :  // Gęsto (np. ~22 chmury dla świata 2000px)
            Math.floor(this.worldWidth / 220); // Rzadko (np. ~8 chmur dla świata 2000px)

        const SOURCE_WIDTH = 512;
        const SOURCE_HEIGHT = 128;

        for (let i = 0; i < cloudCount; i++) {
            const scale = 0.5 + Math.random() * 0.8; // Niewielkie różnice w wielkości
            const cloudWidth = SOURCE_WIDTH * scale;
            
            this.clouds.push({
                // === POCZĄTEK ZMIANY ===
                // Rozszerzamy obszar startowy chmur.
                // Teraz generują się w zakresie od -szerokość_chmury do +szerokość_świata.
                // Dzięki temu niektóre chmury zaczną poza lewą krawędzią ekranu.
                x: Math.random() * (this.worldWidth + cloudWidth) - cloudWidth,
                // === KONIEC ZMIANY ===
                y: Math.random() * (this.gameHeight * 0.2), // Różne wysokości w górnej części ekranu
                speedX: 5 + Math.random() * 15, // Minimalnie różna prędkość w prawo
                scale: scale,
                mirrored: Math.random() < 0.5, // 50% szans na odbicie lustrzane
                spriteY: Math.random() < 0.5 ? 0 : SOURCE_HEIGHT, // Wybór jednej z dwóch sekcji obrazka
                width: cloudWidth,
                height: SOURCE_HEIGHT * scale,
            });
        }
    }

    /**
     * Aktualizuje pozycję chmur w każdej klatce.
     * Gdy chmura opuści prawą stronę świata, jest tworzona na nowo po lewej stronie,
     * co daje efekt ciągłego tworzenia się nowych chmur i znikania starych.
     * @param {number} deltaTime Czas od ostatniej klatki.
     */
    _updateClouds(deltaTime) {
        if (!this.cloudLoaded) return;

        const SOURCE_WIDTH = 512;
        const SOURCE_HEIGHT = 128;

        this.clouds.forEach(cloud => {
            cloud.x += cloud.speedX * deltaTime;
            
            // Jeśli chmura wyjdzie całkowicie poza prawą krawędź świata...
            if (cloud.x > this.worldWidth) {
                const newScale = 0.3 + Math.random() * 1.1;
                const newWidth = SOURCE_WIDTH * newScale;
                
                cloud.x = -newWidth; // Pozycja startowa daleko po lewej, poza ekranem
                cloud.y = Math.random() * (this.gameHeight * 0.2); // Nowa losowa wysokość
                cloud.speedX = 5 + Math.random() * 15; // Nowa losowa prędkość
                cloud.scale = newScale;
                cloud.mirrored = Math.random() < 0.5;
                cloud.spriteY = Math.random() < 0.5 ? 0 : SOURCE_HEIGHT;
                cloud.width = newWidth;
                cloud.height = SOURCE_HEIGHT * newScale;
            }
        });
    }

    /**
     * Rysuje warstwę chmur z efektem paralaksy.
     * @param {CanvasRenderingContext2D} ctx Kontekst canvas.
     * @param {number} cameraX Pozycja X kamery.
     * @param {number} cameraY Pozycja Y kamery.
     */
    drawClouds(ctx, cameraX, cameraY) {
        if (!this.cloudLoaded || this.clouds.length === 0) return;

        const PARALLAX_FACTOR_X = -0.6; // Chmury poruszają się wolniej niż świat, ale szybciej niż tło
        const PARALLAX_FACTOR_Y = -0.4; // Minimalny ruch pionowy

        const parallaxX = cameraX * PARALLAX_FACTOR_X;
        const parallaxY = cameraY * PARALLAX_FACTOR_Y;
        
        const SOURCE_WIDTH = 512;
        const SOURCE_HEIGHT = 128;

        this.clouds.forEach(cloud => {
            const drawX = cloud.x - parallaxX;
            const drawY = cloud.y - parallaxY;

            ctx.save();
            ctx.globalAlpha = 0.75; // Lekka przezroczystość
            ctx.translate(drawX + cloud.width / 2, drawY + cloud.height / 2);
            
            if (cloud.mirrored) {
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(
                this.cloudImage,
                0,                // sx
                cloud.spriteY,    // sy
                SOURCE_WIDTH,     // sWidth
                SOURCE_HEIGHT,    // sHeight
                -cloud.width / 2, // dx
                -cloud.height / 2,// dy
                cloud.width,      // dWidth
                cloud.height      // dHeight
            );

            ctx.restore();
        });
    }
    // ======================== KONIEC NOWEGO KODU DLA CHMUR ========================

    _initializeFireplace(groundLevel) {
        if (this.fireplaceObject) return;

        const FIREPLACE_SCALE = 3.5;
        const FIREPLACE_SPRITE_WIDTH = 32;
        const FIREPLACE_SPRITE_HEIGHT = 32;
        
        this.fireplaceObject = {
            x: 420,
            y: this.gameHeight - groundLevel, // y to spód obiektu
            scale: FIREPLACE_SCALE,
            width: FIREPLACE_SPRITE_WIDTH * FIREPLACE_SCALE,
            height: FIREPLACE_SPRITE_HEIGHT * FIREPLACE_SCALE,
        };
    }

    // === POCZĄTEK ZMIAN ===
    _initializeCampsite(groundLevel) { // <--- MODYFIKACJA
        if (this.campsiteObject) return;

        const CAMPSITE_SCALE = 3.5;
        // UWAGA: Użyj prawidłowych wymiarów źródłowych swojego obrazka camp.png
        const SOURCE_WIDTH = 113; 
        const SOURCE_HEIGHT = 80;
        
        const campX = 600; // Ustaw pozycję X obozu
        const campY = this.gameHeight - groundLevel; // y to spód obiektu, wyrównany z ziemią

        this.campsiteObject = {
            x: campX,
            y: campY,
            scale: CAMPSITE_SCALE,
            width: SOURCE_WIDTH * CAMPSITE_SCALE,
            height: SOURCE_HEIGHT * CAMPSITE_SCALE,
        };

        // <--- NOWOŚĆ: Ustawiamy publiczne właściwości dla detekcji kolizji.
        // Pamiętaj, że `campsiteObject.y` to DÓŁ, więc Y dla kolizji to `y - height`.
        this.campsiteX = campX;
        this.campsiteY = campY - this.campsiteObject.height;
        this.campsiteWidth = this.campsiteObject.width;
        this.campsiteHeight = this.campsiteObject.height;
    }
    // === KONIEC ZMIAN ===

    _updateFireplaceAnimation(deltaTime) {
        if (!this.fireplaceLoaded || !this.fireplaceObject) return;

        const FIREPLACE_FRAME_COUNT = 4;
        const FIREPLACE_ANIMATION_SPEED = 0.15;

        this.fireplaceAnimationTimer += deltaTime;
        if (this.fireplaceAnimationTimer >= FIREPLACE_ANIMATION_SPEED) {
            this.fireplaceAnimationTimer -= FIREPLACE_ANIMATION_SPEED;
            this.fireplaceFrame = (this.fireplaceFrame + 1) % FIREPLACE_FRAME_COUNT;
        }
    }
    
    _updateLightEffect(deltaTime) {
        if (!this.lightLoaded) return;

        this.lightAnimationTime += deltaTime;

        const LIGHT_MIN_ALPHA = 0.12;
        const LIGHT_MAX_ALPHA = 0.3;
        const LIGHT_MIN_SCALE = 3.5;
        const LIGHT_MAX_SCALE = 6.5;
        const LIGHT_ALPHA_SPEED = 2.2;
        const LIGHT_SCALE_SPEED = 0.6;

        const alphaWave = (Math.sin(this.lightAnimationTime * LIGHT_ALPHA_SPEED) + 1) / 2;
        this.lightAlpha = LIGHT_MIN_ALPHA + alphaWave * (LIGHT_MAX_ALPHA - LIGHT_MIN_ALPHA);

        const scaleWave = (Math.sin(this.lightAnimationTime * LIGHT_SCALE_SPEED) + 1) / 2;
        this.lightScale = LIGHT_MIN_SCALE + scaleWave * (LIGHT_MAX_SCALE - LIGHT_MIN_SCALE);
    }


    _spawnFireplaceParticle() {
        if (!this.fireplaceObject) return;

        const colors = ['#d8a808ff', '#e48918', '#cc280c'];
        const sourceX = this.fireplaceObject.x + this.fireplaceObject.width / 2;
        const sourceY = this.fireplaceObject.y - this.fireplaceObject.height * 0.1; // Wyżej, bo y to spód

        const particle = {
            x: sourceX + (Math.random() - 0.5) * 20,
            y: sourceY + (Math.random() - 0.5) * 15,
            baseX: 0,
            size: 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 0,
            maxLife: 4 + Math.random() * 2,
            velocityY: -(30 + Math.random() * 80),
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 2,
            sineAmplitude: 15 + Math.random() * 45,
            sineFrequency: 0.1 + Math.random() * 0.1,
        };
        particle.baseX = particle.x;
        
        this.fireplaceParticles.push(particle);
    }

    
    _updateFireplaceParticles(deltaTime) {
        if (!this.fireplaceLoaded || !this.fireplaceObject) return;

        this.particleSpawnTimer -= deltaTime;
        if (this.particleSpawnTimer <= 0) {
            this._spawnFireplaceParticle();
            this.particleSpawnTimer = 0.01 + Math.random() * 0.1;
        }
        
        for (let i = this.fireplaceParticles.length - 1; i >= 0; i--) {
            const p = this.fireplaceParticles[i];

            p.life += deltaTime;
            if (p.life >= p.maxLife) {
                this.fireplaceParticles.splice(i, 1);
                continue;
            }
            
            p.y += p.velocityY * deltaTime;
            const sineOffset = Math.sin(p.life * p.sineFrequency) * p.sineAmplitude;
            p.x = p.baseX + sineOffset;
            
            p.rotation += p.rotationSpeed * deltaTime;
        }
    }
    
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

    setFishAssets(fishData, fishImages) {
    this.fishData = fishData;
    this.fishImages = fishImages;
}

/**
 * Inicjalizuje ryby pływające w wodzie dla bieżącego biomu.
 * Ta funkcja jest wywoływana przy zmianie biomu.
 * @private
 */

_initializeSwimmingFish() {
    this.swimmingFish = [];
    if (!this.fishData || !this.fishImages || !this.fishData[this.currentBiomeName]) {
        return;
    }

    const biomeFishData = this.fishData[this.currentBiomeName];
    const fishNames = Object.keys(biomeFishData);
    if (fishNames.length === 0) return;

    const MAX_SWIMMING_FISH = 105;

    for (let i = 0; i < MAX_SWIMMING_FISH; i++) {
        const randomFishName = fishNames[Math.floor(Math.random() * fishNames.length)];
        const fishInfo = biomeFishData[randomFishName];
        const image = this.fishImages[randomFishName];

        if (!image || !image.complete) continue;

        this.swimmingFish.push({
            name: randomFishName,
            image: image,
            x: Math.random() * this.worldWidth,
            y: this.WATER_TOP_Y_WORLD + 50 + Math.random() * (this.gameHeight - this.WATER_TOP_Y_WORLD + 40),
            scale: fishInfo.scale * (1.8 + Math.random() * 0.3),
            speed: 40 + Math.random() * 60,
            targetSpeed: 40 + Math.random() * 60,
            direction: Math.random() < 0.5 ? 1 : -1,
            decisionTimer: 2 + Math.random() * 8,
        lerpFactor: 0.03,
        rockingTime: Math.random() * Math.PI * 2,
        // ==== NOWE WŁAŚCIWOŚCI ====
        isFleeing: false,
        fleeTimer: 0
        });
    }
}

 scareFishAt(splashX, splashY_ignored) {
        const SCARE_RADIUS = 250;
        const SCARE_RADIUS_SQUARED = SCARE_RADIUS * SCARE_RADIUS;
        const FLEE_SPEED = 350;
        const FLEE_DURATION = 1.5;

        // ==================== KLUCZOWA POPRAWKA ====================
        // Zakłócenie (plusk) zawsze dzieje się na powierzchni wody.
        // Używamy przekazanego splashX, ale nadpisujemy Y na stałą wartość tafli wody.
        const effectiveSplashY = this.WATER_TOP_Y_WORLD;
        // =========================================================

        this.swimmingFish.forEach(fish => {
            if (fish.isFleeing) return;

            // Oblicz dystans od punktu plusku na POWIERZCHNI wody
            const dx = fish.x - splashX;
            const dy = fish.y - effectiveSplashY; // <-- Używamy poprawionej wartości Y
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared < SCARE_RADIUS_SQUARED) {
                fish.isFleeing = true;
                fish.fleeTimer = FLEE_DURATION;
                fish.targetSpeed = FLEE_SPEED;

                // Jeśli plusk jest po lewej stronie ryby (dx > 0), ryba ucieka w prawo.
                // Jeśli plusk jest po prawej stronie ryby (dx < 0), ryba ucieka w lewo.
                if (dx > 0) {
                    fish.direction = 1; // Uciekaj w prawo
                } else {
                    fish.direction = -1; // Uciekaj w lewo
                }
            }
        });
    }
/**
 * Aktualizuje pozycję i zachowanie każdej ryby.
 * @param {number} deltaTime Czas od ostatniej klatki.
 * @private
 */
_updateSwimmingFish(deltaTime) {
    this.swimmingFish.forEach(fish => {
        // ==== NOWA LOGIKA STANU UCIECZKI ====
        if (fish.isFleeing) {
            fish.fleeTimer -= deltaTime;
            if (fish.fleeTimer <= 0) {
                // Koniec ucieczki, powrót do normalnego zachowania
                fish.isFleeing = false;
                fish.targetSpeed = 80 + Math.random() * 100; // Ustaw nową, normalną prędkość
                fish.decisionTimer = 1 + Math.random() * 4; // Szybciej podejmij nową decyzję
            }
        }
        // ===================================

        fish.speed = fish.speed * (1 - fish.lerpFactor) + fish.targetSpeed * fish.lerpFactor;
        fish.x += fish.speed * fish.direction * deltaTime;
        fish.rockingTime += deltaTime;

        // ==== MODYFIKACJA: Zwykłe decyzje tylko gdy ryba nie ucieka ====
        if (!fish.isFleeing) {
            fish.decisionTimer -= deltaTime;
            if (fish.decisionTimer <= 0) {
                fish.decisionTimer = 3 + Math.random() * 10;
                fish.targetSpeed = 20 + Math.random() * 80;
                if (Math.random() < 0.4) {
                    fish.direction *= -1;
                }
            }
        }
        // ===============================================================
        
        const fishWidth = fish.image.naturalWidth * fish.scale;
        if (fish.direction === 1 && fish.x > this.worldWidth + fishWidth) {
            fish.x = -fishWidth;
        } else if (fish.direction === -1 && fish.x < -fishWidth) {
            fish.x = this.worldWidth + fishWidth;
        }
    });
}
/**
 * Rysuje wszystkie aktywne ryby na ekranie.
 * @param {CanvasRenderingContext2D} ctx Kontekst canvas.
 */

drawSwimmingFish(ctx) {
    // Podstawowy kąt korekcyjny dla grafiki ryby
    const baseRotation = 45 * (Math.PI / 180);

    // ======== NOWE STAŁE DLA EFEKTU KOŁYSANIA ========
    const MAX_ROCKING_ANGLE_DEG = 3; // Maksymalne wychylenie to 3 stopnie
    const MAX_ROCKING_ANGLE_RAD = MAX_ROCKING_ANGLE_DEG * (Math.PI / 180);
    const MAX_FISH_SPEED_FOR_ANIM = 100; // Prędkość, przy której kołysanie jest najsilniejsze
    // ==================================================

    this.swimmingFish.forEach(fish => {
        const fishWidth = fish.image.naturalWidth * fish.scale;
        const fishHeight = fish.image.naturalHeight * fish.scale;
        
        ctx.save();
        ctx.globalAlpha = 0.75; 
        ctx.translate(fish.x, fish.y);
        ctx.scale(fish.direction, 1);
        
        // ======== NOWA LOGIKA ROTACJI ========
        // Oblicz, jak bardzo ryba powinna się kołysać na podstawie jej aktualnej prędkości
        const speedRatio = Math.min(fish.speed / MAX_FISH_SPEED_FOR_ANIM, 1.0);
        const currentMaxRock = MAX_ROCKING_ANGLE_RAD * speedRatio;

        // Częstotliwość (szybkość) kołysania również zależy od prędkości
        const rockingFrequency = 2 + (speedRatio * 8); // Od 2 (wolno) do 10 (szybko)

        // Oblicz aktualny kąt kołysania za pomocą fali sinusoidalnej
        const rockingAngle = Math.sin(fish.rockingTime * rockingFrequency) * currentMaxRock;

        // Połącz podstawowy kąt korekcyjny z dynamicznym kątem kołysania
        const totalRotation = baseRotation + rockingAngle;
        ctx.rotate(totalRotation);
        // =====================================
        
        ctx.drawImage(
            fish.image,
            -fishWidth / 2,
            -fishHeight / 2,
            fishWidth,
            fishHeight
        );

        ctx.restore();
    });
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
        this.tileBackgroundLoaded = false;
        this.placedPiers = [];
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

        if (this.currentBiomeDef.tileBackgroundPath) {
            if (this.biomeTileBackgroundImages[newBiomeName] && this.biomeTileBackgroundImages[newBiomeName].complete) {
                this.tileBackgroundLoaded = true;
            } else {
                const img = new Image();
                img.onload = () => { this.tileBackgroundLoaded = true; };
                img.onerror = () => { console.error(`Failed to load ${this.currentBiomeDef.tileBackgroundPath}`); };
                img.src = this.currentBiomeDef.tileBackgroundPath;
                this.biomeTileBackgroundImages[newBiomeName] = img;
            }
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

        // ====================== TUTAJ JEST POPRAWKA ======================
        // Po każdej zmianie biomu, musimy zainicjalizować ryby na nowo.
        this._initializeSwimmingFish();
        // ===============================================================
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
    
    initializePiers(piersData) {
        this.placedPiers = piersData || [];
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
        const SWAY_DURATION = 2.1;
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

    drawParallaxBackground(ctx, cameraX, cameraY, visibleWidth) {
        const tileBackgroundHFactor = 0.25; // Niezwykle wolno
        const frontLayerHFactor = 0.08;
        const backLayerHFactor = 0.18;
        const BG_WIDTH = 820 * 3.35;

        const verticalParallaxFactor = 0;
        const VERTICAL_OFFSET = 22;

        const parallaxY = cameraY * (1 - verticalParallaxFactor);

        // ======================= POCZĄTEK ZMIAN DLA UNIKATOWEGO TŁA =======================
        ctx.save();
        ctx.translate(cameraX, cameraY);
        const parallaxX_tile = cameraX * (1 - tileBackgroundHFactor);
        ctx.translate(0, -parallaxY + VERTICAL_OFFSET);
        const currentTileBgImage = this.biomeTileBackgroundImages[this.currentBiomeName];
        this._drawTilingMirroredParallaxLayer(ctx, currentTileBgImage, this.tileBackgroundLoaded, parallaxX_tile, visibleWidth);
        ctx.restore();
        // ======================= KONIEC ZMIAN DLA UNIKATOWEGO TŁA ========================

        ctx.save();
        ctx.translate(cameraX, cameraY);
        const parallaxX2 = cameraX * (1 - backLayerHFactor);
        ctx.translate(0, -parallaxY + VERTICAL_OFFSET);
        this._drawParallaxLayer(ctx, this.background2Image, this.background2Loaded, parallaxX2, visibleWidth + BG_WIDTH);
        ctx.restore();

        ctx.save();
        ctx.translate(cameraX, cameraY);
        const parallaxX1 = cameraX * (1 - frontLayerHFactor);
        ctx.translate(0, -parallaxY + VERTICAL_OFFSET);
        this._drawParallaxLayer(ctx, this.backgroundImage, this.backgroundLoaded, parallaxX1, visibleWidth + BG_WIDTH);
        ctx.restore();
    }

    _drawParallaxLayer(ctx, image, isLoaded, parallaxX, coverWidth) {
        if (!isLoaded || !image || !image.complete || image.naturalWidth === 0) return;

        const BG_WIDTH = 820 * 3.35;
        const BG_HEIGHT = 256 * 3.35;

        const startX = Math.floor(parallaxX / BG_WIDTH) * BG_WIDTH;

        for (let currentX = startX; currentX < parallaxX + coverWidth; currentX += BG_WIDTH) {
            ctx.drawImage(image, currentX - parallaxX, 0, BG_WIDTH, BG_HEIGHT);
        }
    }

    _drawTilingMirroredParallaxLayer(ctx, image, isLoaded, parallaxX, coverWidth) {
        if (!isLoaded || !image || !image.complete || image.naturalWidth === 0) return;

        const BG_HEIGHT = 256 * 2.85;
        const scaleFactor = BG_HEIGHT / image.naturalHeight;
        const TILE_WIDTH = image.naturalWidth * scaleFactor;
        const TILE_HEIGHT = BG_HEIGHT;

        const startTileIndex = Math.floor(parallaxX / TILE_WIDTH);
        const startX = startTileIndex * TILE_WIDTH;
        
        let isMirrored = (startTileIndex % 2 !== 0);

        for (let currentX = startX; currentX < parallaxX + coverWidth + TILE_WIDTH; currentX += TILE_WIDTH) {
            const drawX = currentX - parallaxX;

            if (isMirrored) {
                ctx.save();
                ctx.translate(drawX + TILE_WIDTH, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(image, 0, 0, TILE_WIDTH, TILE_HEIGHT);
                ctx.restore();
            } else {
                ctx.drawImage(image, drawX, 0, TILE_WIDTH, TILE_HEIGHT);
            }
            isMirrored = !isMirrored;
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
        this._updateFireplaceAnimation(deltaTime);
        this._updateFireplaceParticles(deltaTime);
        this._updateLightEffect(deltaTime);
        this._updateSwimmingFish(deltaTime);
        this._updateClouds(deltaTime);
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

    loadBiomeImages(onAllLoadedCallback) {
        const biomeNames = Object.keys(this.biomeDefinitions);
        const imagesToLoadPaths = new Set();

        biomeNames.forEach(name => {
            const def = this.biomeDefinitions[name];
            if (def.imgPath) imagesToLoadPaths.add(def.imgPath);
            if (def.insectPath) imagesToLoadPaths.add(def.insectPath);
            if (def.pierPath) imagesToLoadPaths.add(def.pierPath);
            if (def.pierSpanPath) imagesToLoadPaths.add(def.pierSpanPath);
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
                for (const biomeName of biomeNames) {
                    const def = this.biomeDefinitions[biomeName];
                    if (def.imgPath === src) this.biomeTiles[biomeName] = img;
                    if (def.insectPath === src) this.biomeInsectImages[biomeName] = img;
                    if (def.pierPath === src) this.biomePierImages[biomeName] = img;
                    if (def.pierSpanPath === src) this.biomePierSpanImages[biomeName] = img;
                }

                if (loadedCount === totalImages) {
                    onAllLoadedCallback();
                }
            };

            img.onload = onLoaded;
            img.onerror = () => {
                console.error(`Image loading error: ${src}`);
                onLoaded();
            };
        });
    }

    drawBackgroundBiomeGround(ctx, biomeName, groundLevel) {
        this._initializeFireplace(groundLevel);
        // === POCZĄTEK ZMIAN ===
        this._initializeCampsite(groundLevel);
        // === KONIEC ZMIAN ===
    
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
    
    drawFireplace(ctx) {
        if (!this.fireplaceLoaded || !this.fireplaceObject) return;

        const FIREPLACE_SPRITE_WIDTH = 32;
        const FIREPLACE_SPRITE_HEIGHT = 32;

        const sourceX = this.fireplaceFrame * FIREPLACE_SPRITE_WIDTH;
        const sourceY = 0;

        // Rysuj od góry, bazując na dolnej krawędzi zapisanej w `y`
        const drawY = this.fireplaceObject.y - this.fireplaceObject.height;

        ctx.drawImage(
            this.fireplaceImage,
            sourceX, sourceY,
            FIREPLACE_SPRITE_WIDTH, FIREPLACE_SPRITE_HEIGHT,
            this.fireplaceObject.x, drawY,
            this.fireplaceObject.width, this.fireplaceObject.height
        );
    }
    drawFireplaceParticles(ctx) {
        if (this.fireplaceParticles.length === 0) return;

        for (const p of this.fireplaceParticles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }
    }
    
    drawLightEffect(ctx) {
        if (!this.lightLoaded || !this.fireplaceObject || !this.lightImage.complete || this.lightImage.naturalWidth === 0) return;

        ctx.save();
        ctx.globalAlpha = this.lightAlpha;

        const lightWidth = this.lightImage.naturalWidth * this.lightScale;
        const lightHeight = this.lightImage.naturalHeight * this.lightScale;
        
        const centerX = this.fireplaceObject.x + (this.fireplaceObject.width / 2);
        const centerY = this.fireplaceObject.y - (this.fireplaceObject.height * 1.1); // Wyżej, bo y to spód
        const drawX = centerX - lightWidth / 2;
        const drawY = centerY - lightHeight / 2;
        
        ctx.drawImage(
            this.lightImage,
            drawX, drawY,
            lightWidth, lightHeight
        );
        
        ctx.restore();
    }

    // === POCZĄTEK ZMIAN ===
    /**
     * Rysuje statyczny obiekt kempingu.
     * @param {CanvasRenderingContext2D} ctx 
     */
    drawCampsite(ctx) {
        if (!this.campsiteLoaded || !this.campsiteObject) return;

        const { x, y, width, height } = this.campsiteObject;
        const drawY = y - height; // Obliczamy górną krawędź do rysowania

        ctx.drawImage(
                this.campsiteImage,
                x, drawY,
                width, height
            );
        
        // Krok 2: Jeśli gracz jest blisko, narysuj na wierzchu poświatę
        if (this.playerIsNearCamp) {
            ctx.save();
            // Tryb 'lighter' powoduje, że kolory są dodawane, co tworzy efekt rozjaśnienia.
            // Jest to znacznie wydajniejsze niż filtry CSS.
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.35; // Ustaw subtelną przezroczystość dla poświaty

            // Narysuj ten sam obrazek ponownie w tym samym miejscu
            ctx.drawImage(
                this.campsiteImage,
                x, drawY,
                width, height
            );
            
            ctx.restore(); // Przywróć normalny tryb rysowania i alpha
        }
    }
    // === KONIEC ZMIAN ===


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
    
    drawPierSupports(ctx, pierSupportData) {
        const supportImage = this.biomePierSpanImages[this.currentBiomeName];

        if (!supportImage || !supportImage.complete || !pierSupportData || pierSupportData.length === 0 || this.placedPiers.length === 0) {
            return;
        }

        const PILE_GFX_WIDTH = 32;
        const PILE_GFX_HEIGHT = 128;

        pierSupportData.forEach((pierData, pierIndex) => {
            if (pierIndex >= this.placedPiers.length) return;
            const originalPier = this.placedPiers[pierIndex];
            if (!originalPier) return;
            
            const scaledPierGfxHeight = this.scaledTileSize; 
            const pierPlankTopY = originalPier.y - scaledPierGfxHeight + 116;
            const PIER_PLANK_THICKNESS = 20;
            const pileStartY = pierPlankTopY + PIER_PLANK_THICKNESS;

            pierData.sections.forEach((sectionData, sectionIndex) => {
                const sectionBaseX = originalPier.x + sectionIndex * this.scaledTileSize;

                sectionData.piles.forEach(pile => {
                    const renderWidth = PILE_GFX_WIDTH * pile.scale;
                    const renderHeight = PILE_GFX_HEIGHT * pile.scale;
                    const pileDrawX = sectionBaseX + pile.x;

                    ctx.save();
                    ctx.translate(pileDrawX + renderWidth / 2, pileStartY);
                    ctx.rotate(pile.rotation);

                    ctx.drawImage(
                        supportImage,
                        0, 0,
                        PILE_GFX_WIDTH, PILE_GFX_HEIGHT,
                        -renderWidth / 2, 0,
                        renderWidth, renderHeight
                    );

                    ctx.restore();
                });
            });
        });
    }

    drawPiers(ctx) {
        const pierImage = this.biomePierImages[this.currentBiomeName];
        if (!pierImage || !pierImage.complete || this.placedPiers.length === 0) {
            return;
        }

        const TILE_SOURCE_WIDTH = 32;
        const TILE_SOURCE_HEIGHT = 64;
        const scaledWidth = this.scaledTileSize;
        const scaledHeight = this.scaledTileSize * 2; 

        for (const pier of this.placedPiers) {
            pier.sections.forEach((section, index) => {
                const drawX = pier.x + index * scaledWidth;
                const drawY = pier.y - scaledHeight + 116; 

                const sourceX = section.tileIndex * TILE_SOURCE_WIDTH;
                const sourceY = 0;

                ctx.save();
                if (section.mirrored) {
                    ctx.translate(drawX + scaledWidth, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(
                        pierImage,
                        sourceX, sourceY,
                        TILE_SOURCE_WIDTH, TILE_SOURCE_HEIGHT,
                        0, drawY, 
                        scaledWidth, scaledHeight
                    );
                } else {
                    ctx.drawImage(
                        pierImage,
                        sourceX, sourceY,
                        TILE_SOURCE_WIDTH, TILE_SOURCE_HEIGHT,
                        drawX, drawY,
                        scaledWidth, scaledHeight
                    );
                }
                ctx.restore();
            });
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