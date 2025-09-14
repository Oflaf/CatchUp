class BiomeManager {
    constructor(worldWidth, gameHeight, tileSize = 32) {
        this.worldWidth = worldWidth;
        this.gameHeight = gameHeight;
        this.tileSize = tileSize;
        this.scaledTileSize = tileSize * 4;
        this.biomeTiles = {};
        
        // NEW: Zmienne dla animacji wody
        this.waterScrollX = 0;
        this.waterOscillationTime = 0;
        this.WATER_SCROLL_SPEED = 10; // Prędkość przewijania wody w prawo (pixele na klatkę)
        this.WATER_OSCILLATION_AMPLITUDE = 3; // Amplituda ruchu góra-dół (w pixelach)
        this.WATER_OSCILLATION_SPEED = 1; // Prędkość ruchu góra-dół
        this.WATER_ANIMATION_TILE_SPEED = 0; // Szybkość zmiany kafelków animacji (np. 0.1 oznacza zmianę co 10 klatek)
        this.currentWaterTileFrame = 0; // Aktualna klatka animacji kafelka wody

        this.biomeDefinitions = {
            jurassic: {
                imgPath: 'img/world/biome/jurassic/ground.png',
                tileMap: {
                    grass: { x: 0, y: 0, width: 32, height: 32 },
                    ground1: { x: 32, y: 0, width: 32, height: 32 },
                    ground2: { x: 64, y: 0, width: 32, height: 32 },
                    ground3: { x: 96, y: 0, width: 32, height: 32 },
                    ground_repeat: { x: 128, y: 0, width: 32, height: 32 },
                    // ZAKTUALIZOWANE KAFELKI WODY (water_anim1, water_anim2, water_repeat)
                    water_anim1: { x: 128, y: 0, width: 32, height: 32 }, // Nowy kafelek dla animacji
                    water_anim2: { x: 160, y: 0, width: 32, height: 32 }, // Kolejny kafelek dla animacji
                    water_repeat: { x: 192, y: 0, width: 32, height: 32 } // Kafelek powtarzalny dla głębszej wody
                },
                layerHeights: {
                    grass: 1,
                    ground1: 1,
                    ground2: 1,
                    ground3: 3,
                    ground_repeat: 0,
                    // ZAKTUALIZOWANE WYSOKOŚCI WARSTW WODY
                    water_anim1: 1, // Warstwa animowana (górna)
                    water_anim2: 1, // Warstwa animowana (górna)
                    water_repeat: 0 // Powtarzalna warstwa
                }
            }
        };

        // NEW: Stałe dla wody (przeniesione z script.js, jeśli chcesz je mieć w BiomeManager)
        this.WATER_TOP_Y_WORLD = this.gameHeight - 172; 
        this.WATER_HEIGHT_WORLD = 512;                       
        this.WATER_COLOR = '#4683b404';     
        
        // --- NOWE: Rośliny wodne ---
        this.waterPlantsImage = new Image();
        this.waterPlantsImage.src = 'img/world/biome/jurassic/waterplants.png';
        this.waterPlantsLoaded = false;
        this.waterPlantsImage.onload = () => {
            this.waterPlantsLoaded = true;
            // console.log('Water plants image loaded.'); // Do debugowania
        };
        this.waterPlantsImage.onerror = () => {
            console.error('Failed to load waterplants.png');
        };

 this.waterPlantDefinitions = [
            // Frontowe rośliny (mają być rysowane nad wodą, ale poniżej graczy)
            { y: 0, x: 0, width: 32, height: 64, layer: 'front', canBeMirrored: true },  // Roślina 1
            { y: 0, x: 32, width: 32, height: 64, layer: 'front', canBeMirrored: true }, // Roślina 2
            { y: 0, x: 64, width: 32, height: 64, layer: 'front', canBeMirrored: true }, // Roślina 3 (przykładowo bez odbicia)
            { y: 0, x: 96, width: 32, height: 64, layer: 'front', canBeMirrored: true }, // Roślina 4
            // Tło rośliny (mają być rysowane pod wodą)
            { y: 0, x: 128, width: 32, height: 32, layer: 'front', canBeMirrored: true }, // Roślina 5
            { y: 0, x: 160, width: 32, height: 32, layer: 'background', canBeMirrored: true }, // Roślina 6
            { y: 0, x: 196, width: 32, height: 32, layer: 'background', canBeMirrored: true }, // Roślina 7 (przykładowo bez odbicia)
            { y: 0, x: 228, width: 32, height: 32, layer: 'background', canBeMirrored: true }  // Roślina 8
 ]
 
        // Zgrupuj rośliny według warstwy
        this.frontWaterPlants = this.waterPlantDefinitions.filter(p => p.layer === 'front');
        this.backgroundWaterPlants = this.waterPlantDefinitions.filter(p => p.layer === 'background');

        this.placedWaterPlants = []; // Tutaj będziemy przechowywać instancje roślin
        
        // --- KLUCZOWA ZMIANA: Inicjalizuj te zmienne PRZED wywołaniem initializeWaterPlants() ---
        this.WATER_PLANT_SPAWN_INTERVAL = 60; // Co ile pikseli umieszczać rośliny
        this.WATER_PLANT_MAX_COUNT = Math.ceil(this.worldWidth / this.WATER_PLANT_SPAWN_INTERVAL) * 2; // Maksymalna liczba roślin
        // ---------------------------------------------------------------------------------------

        this.initializeWaterPlants(); // Teraz ta metoda będzie miała dostęp do poprawnych wartości
        console.log('BiomeManager constructor finished. Total placedWaterPlants:', this.placedWaterPlants.length);
        // --- KONIEC NOWYCH: Rośliny wodne ---
    }

    // --- NOWE: Inicjalizacja roślin wodnych ---
     initializeWaterPlants() {
        console.log('initializeWaterPlants started.');
        this.placedWaterPlants = [];
        const numPlants = this.WATER_PLANT_MAX_COUNT;
        console.log('Number of plants to spawn (WATER_PLANT_MAX_COUNT):', numPlants);
        
        // Dodana stała dla ułatwienia zarządzania poziomem Y roślin
        // Rośliny będą generowane na poziomie dna górnej warstwy wody (WATER_TOP_Y_WORLD)
        this.WATER_PLANT_BASE_Y_LEVEL = this.WATER_TOP_Y_WORLD + this.scaledTileSize +166; // Możesz dostosować tę wartość

        if (numPlants > 0) {
            for (let i = 0; i < numPlants; i++) {
                this.addRandomWaterPlant(i * (this.worldWidth / numPlants));
            }
            // Sortowanie roślin, aby tło było rysowane przed frontem
            this.placedWaterPlants.sort((a, b) => {
                if (a.definition.layer === 'background' && b.definition.layer === 'front') return -1;
                if (a.definition.layer === 'front' && b.definition.layer === 'background') return 1;
                return 0; // Zachowaj istniejącą kolejność dla tej samej warstwy
            });
        } else {
            console.warn('WATER_PLANT_MAX_COUNT is 0 or less. No water plants will be initialized.');
        }
        console.log('initializeWaterPlants finished. Placed water plants count:', this.placedWaterPlants.length);
    }

    addRandomWaterPlant(initialX) {
        const plantDefinition = this.waterPlantDefinitions[Math.floor(Math.random() * this.waterPlantDefinitions.length)];
        const scale = 3.45 + Math.random() * 1.65; // Skala od 2.95 do 3.05
        const rotationAmplitude = (Math.random() * 0.12 + 0.02); // Amplituda rotacji (np. od 0.02 do 0.1 radiana)
        const rotationSpeed = (Math.random() * 0.4 + 0.2); // Prędkość rotacji (np. od 0.2 do 1.0)
        const rotationOffset = Math.random() * Math.PI * 2; // Losowe przesunięcie fazowe dla animacji bujania
        const horizontalOffset = -plantDefinition.width * scale * 1.1 + Math.random() * plantDefinition.width * scale; // Losowe przesunięcie poziome
        
        // NOWE: Decyzja o lustrzanym odbiciu
        const isMirrored = plantDefinition.canBeMirrored && Math.random() < 0.5; // 50% szans na lustrzane odbicie

        this.placedWaterPlants.push({
            definition: plantDefinition,
            x: initialX + horizontalOffset,
            scale: scale,
            rotationAmplitude: rotationAmplitude,
            rotationSpeed: rotationSpeed,
            rotationOffset: rotationOffset,
            animationTime: Math.random() * Math.PI * 2,
            isMirrored: isMirrored // Dodajemy flagę lustrzanego odbicia
        });
    }

    // --- NAPRAWIONA FUNKCJA: TYLKO AKTUALIZUJE CZAS ANIMACJI ROŚLIN ---
    updateWaterPlantsAnimation(deltaTime) {
        for (const plant of this.placedWaterPlants) {
            plant.animationTime += plant.rotationSpeed * deltaTime;
        }
    }
    // --- KONIEC NOWYCH: Inicjalizacja roślin wodnych ---

    // Nowa metoda do rysowania tła
    drawBackground(ctx) {
        ctx.fillStyle = '#87CEEB'; // Kolor nieba
        ctx.fillRect(0, 0, this.worldWidth, this.gameHeight); // Użyj this.worldWidth i this.gameHeight
    }

    // NEW: Metoda do aktualizacji logiki animacji wody
    updateWaterAnimation(deltaTime) {
        this.waterScrollX = (this.waterScrollX + this.WATER_SCROLL_SPEED * deltaTime) % this.scaledTileSize; // Przewijanie w prawo, modulo by zapętlać
        this.waterOscillationTime += this.WATER_OSCILLATION_SPEED * deltaTime;
        this.currentWaterTileFrame = (this.currentWaterTileFrame + this.WATER_ANIMATION_TILE_SPEED * deltaTime);
        if (this.currentWaterTileFrame >= 2) this.currentWaterTileFrame -= 2; // Zakładamy 2 kafelki animacji

        this.updateWaterPlantsAnimation(deltaTime); // Zaktualizuj animację roślin wodnych
    }

    // ZAKTUALIZOWANA METODA RYSUJĄCA WODĘ (TERAZ UŻYWA KAFELKÓW I ANIMACJI)
    drawWater(ctx, biomeName, cameraX) { // Usunięto waterPlantsDrawIndex, bo teraz to drawWaterPlants będzie decydować
        const biomeImage = this.biomeTiles[biomeName];
        const biomeDef = this.biomeDefinitions[biomeName];

        const waterOscillationY = Math.sin(this.waterOscillationTime) * this.WATER_OSCILLATION_AMPLITUDE;

        if (!biomeImage || !biomeDef || !biomeDef.tileMap.water_anim1) {
            ctx.fillStyle = this.WATER_COLOR;
            const waterTopY_world = this.WATER_TOP_Y_WORLD + waterOscillationY;
            const waterDrawHeight = this.WATER_HEIGHT_WORLD;
            if (waterDrawHeight > 0 && waterTopY_world < this.gameHeight) {
                ctx.fillRect(0, waterTopY_world, this.worldWidth, waterDrawHeight);
            }
            return;
        }

        const numTilesX = Math.ceil(this.worldWidth / this.scaledTileSize) + 1;

        const currentAnimTileKey = Math.floor(this.currentWaterTileFrame) === 0 ? 'water_anim1' : 'water_anim2';
        const animatedWaterTile = biomeDef.tileMap[currentAnimTileKey];

        const waterRepeatTile = biomeDef.tileMap.water_repeat;
        const topWaterDrawY = this.WATER_TOP_Y_WORLD + waterOscillationY;
        const waterBottomY = this.WATER_TOP_Y_WORLD + this.WATER_HEIGHT_WORLD;

        // 1. Rysuj rośliny tła (pod całą wodą)
        this.drawWaterPlants(ctx, 'background', cameraX, waterOscillationY+60);
        this.drawWaterPlants(ctx, 'front', cameraX, waterOscillationY);
        

        // 2. Rysuj powtarzalną warstwę wody
        if (waterRepeatTile) {
            for (let y = topWaterDrawY + this.scaledTileSize; y < waterBottomY; y += this.scaledTileSize) {
                for (let x = -1; x < numTilesX; x++) {
                    const drawX = x * this.scaledTileSize + this.waterScrollX;
                    ctx.drawImage(
                        biomeImage,
                        waterRepeatTile.x, waterRepeatTile.y, waterRepeatTile.width, waterRepeatTile.height,
                        drawX, y, this.scaledTileSize, this.scaledTileSize
                    );
                }
            }
        }

        // 3. Rysuj górną, animowaną warstwę wody
        if (animatedWaterTile) {
            for (let x = -1; x < numTilesX; x++) {
                const drawX = x * this.scaledTileSize + this.waterScrollX;
                ctx.drawImage(
                    biomeImage,
                    animatedWaterTile.x, animatedWaterTile.y, animatedWaterTile.width, animatedWaterTile.height,
                    drawX, topWaterDrawY, this.scaledTileSize, this.scaledTileSize
                );
            }
        }

        // 4. Rysuj rośliny frontowe (nad górną warstwą wody)

        
    }

    // --- ZAKTUALIZOWANA Metoda do rysowania roślin wodnych ---
    drawWaterPlants(ctx, layer, cameraX, waterOscillationY) {
        if (!this.waterPlantsLoaded) {
            return;
        }

        const visibleWorldLeft = cameraX;
        const visibleWorldRight = cameraX + this.worldWidth;

        for (const plant of this.placedWaterPlants) {
            if (plant.definition.layer !== layer) continue;

            const plantWidth = plant.definition.width * plant.scale;
            const plantHeight = plant.definition.height * plant.scale;

            // Używamy zdefiniowanego poziomu Y dla wszystkich roślin
            // Rośliny "rosną" od tego poziomu w górę
            const basePlantY_world = this.WATER_PLANT_BASE_Y_LEVEL; 
            const adjustedPlantY_world = basePlantY_world + waterOscillationY; 

            // Pozioma pozycja rośliny, uwzględniająca lustrzane odbicie dla obliczeń widoczności
            let plantX_world = plant.x;
            if (plant.isMirrored) {
                // Jeśli roślina jest lustrzana, jej "początek" jest w miejscu normalnego końca
                plantX_world = plant.x - plantWidth; 
            }

            if (plantX_world + plantWidth < visibleWorldLeft || plantX_world > visibleWorldRight) {
                continue;
            }

            ctx.save();
            
            // Punkt obrotu dla animacji (środek podstawy rośliny)
            const pivotX = plant.x + plantWidth / 2;
            // Pozycja Y, od której roślina "wyrasta" - tu jest podstawa
            const pivotY = adjustedPlantY_world; 

            ctx.translate(pivotX, pivotY);

            // Zastosuj lustrzane odbicie, jeśli jest potrzebne
            if (plant.isMirrored) {
                ctx.scale(-1, 1);
            }

            const rotation = Math.sin(plant.animationTime) * plant.rotationAmplitude * Math.sin(plant.animationTime / 2) * 2;
            ctx.rotate(rotation);

            // Rysowanie obrazu rośliny.
            // Ważne: drawImage rysuje od lewego górnego rogu.
            // Jeśli pivot jest na podstawie i roślina rośnie w górę, Y rysowania powinien być ujemny (do góry od pivotY).
            // -plantHeight oznacza, że dół rośliny jest na pivotY, a góra na pivotY - plantHeight.
            // Jeśli jest lustrzane odbicie, ctx.scale(-1, 1) już to załatwia, więc rysujemy tak samo.
            ctx.drawImage(
                this.waterPlantsImage,
                plant.definition.x, plant.definition.y, plant.definition.width, plant.definition.height,
                -plantWidth / 2, // X jest wyśrodkowany wokół pivotX
                -plantHeight,    // Y jest tak, aby dół rośliny był na pivotY
                plantWidth, plantHeight
            );

            ctx.restore();
        }
    }
    // --- KONIEC NOWYCH: Metoda do rysowania roślin wodnych ---


    // Ładowanie obrazów biomów
    loadBiomeImages(onImageLoadedCallback) { // Nowy parametr: onImageLoadedCallback
        const biomeImageCount = Object.keys(this.biomeDefinitions).length;
        // --- NOWE: Dodaj obraz waterplants do licznika ---
        let totalImagesToLoadInBiomeManager = biomeImageCount + 1; // +1 dla waterplants.png
        // --- KONIEC NOWYCH ---

        if (totalImagesToLoadInBiomeManager === 0) {
            onImageLoadedCallback(); 
            return;
        }

        let loadedBiomeImages = 0;

        // Ładowanie obrazów biomów
        for (const biomeName in this.biomeDefinitions) {
            const biomeDef = this.biomeDefinitions[biomeName];
            const img = new Image();
            img.src = biomeDef.imgPath;
            img.onload = () => {
                this.biomeTiles[biomeName] = img;
                loadedBiomeImages++;
                onImageLoadedCallback(); 
            };
            img.onerror = () => {
                console.error(`Błąd ładowania obrazu biomu: ${biomeDef.imgPath}`);
                loadedBiomeImages++;
                onImageLoadedCallback(); 
            };
        }

        // --- NOWE: Załaduj waterplants.png ---
        this.waterPlantsImage.onload = () => {
            this.waterPlantsLoaded = true;
            loadedBiomeImages++;
            onImageLoadedCallback();
        };
        this.waterPlantsImage.onerror = () => {
            console.error('Błąd ładowania obrazu waterplants.png');
            loadedBiomeImages++;
            onImageLoadedCallback();
        };
        // --- KONIEC NOWYCH ---
    }

    // Funkcja do rysowania terenu dla danego biomu
       drawBiomeGround(ctx, biomeName, groundLevel, cameraX, cameraY, zoomLevel) {
        const biomeImage = this.biomeTiles[biomeName];
        if (!biomeImage) {
            console.warn(`Obraz biomu ${biomeName} nie został załadowany.`);
            ctx.fillStyle = 'brown';
            // Pamiętaj, że tutaj rysujemy w przestrzeni świata, która jest już przetransformowana przez kamerę i zoom.
            // ctx.fillRect(0, this.gameHeight - groundLevel, this.worldWidth, groundLevel);
            // Lepiej rysować w transformowanej przestrzeni, aby fallback też był zgodny.
            ctx.fillRect(0, this.gameHeight - groundLevel, this.worldWidth, groundLevel);
            return;
        }

        const biomeDef = this.biomeDefinitions[biomeName];
        if (!biomeDef) {
            console.warn(`Definicja biomu ${biomeName} nie została znaleziona.`);
            return;
        }

        // --- Zaktualizowana logika rysowania terenu ---
        const numTilesX = Math.ceil(this.worldWidth / this.scaledTileSize);
        const worldGroundTopY = this.gameHeight - groundLevel;

        // Określ kolejność rysowania warstw
        const layerOrder = ['grass', 'ground1', 'ground2', 'ground3', 'ground_repeat'];
        
        let currentDrawingY = worldGroundTopY;

        for (const layerKey of layerOrder) {
            const layerConfig = biomeDef.tileMap[layerKey];
            const layerHeightCount = biomeDef.layerHeights[layerKey];
            const tileToDraw = layerConfig;

            if (layerKey === 'ground_repeat') {
                for (let y = currentDrawingY; y < this.gameHeight; y += this.scaledTileSize) {
                    if (y >= this.gameHeight - groundLevel) { 
                        for (let x = 0; x < numTilesX; x++) {
                            const drawX = x * this.scaledTileSize;
                            ctx.drawImage(
                                biomeImage,
                                tileToDraw.x, tileToDraw.y, tileToDraw.width, tileToDraw.height,
                                drawX, y, this.scaledTileSize, this.scaledTileSize
                            );
                        }
                    }
                }
            } else {
                for (let i = 0; i < layerHeightCount; i++) {
                    const y = currentDrawingY + (i * this.scaledTileSize);
                    if (y >= this.gameHeight - groundLevel) {
                        for (let x = 0; x < numTilesX; x++) {
                            const drawX = x * this.scaledTileSize;
                            ctx.drawImage(
                                biomeImage,
                                tileToDraw.x, tileToDraw.y, tileToDraw.width, tileToDraw.height,
                                drawX, y, this.scaledTileSize, this.scaledTileSize
                            );
                        }
                    }
                }
                currentDrawingY += layerHeightCount * this.scaledTileSize;
            }
        }
    }
}