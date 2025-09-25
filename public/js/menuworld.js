'use strict';

console.log("[MenuWorld] Skrypt załadowany.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("[MenuWorld] DOM gotowy. Inicjalizuję tło menu...");

    const menuCanvas = document.getElementById('menuCanvas');
    if (!menuCanvas) {
        console.error("[MenuWorld] Krytyczny błąd: Nie znaleziono elementu #menuCanvas na stronie!");
        return;
    }
    const menuCtx = menuCanvas.getContext('2d');

    // --- Definitywne wyłączenie wygładzania i rozmycia ---
    menuCtx.imageSmoothingEnabled = false;
    menuCtx.webkitImageSmoothingEnabled = false;
    menuCtx.mozImageSmoothingEnabled = false;
    menuCtx.msImageSmoothingEnabled = false;
    menuCanvas.style.imageRendering = 'pixelated';

    function resizeCanvas() {
        menuCanvas.width = window.innerWidth;
        menuCanvas.height = window.innerHeight;
        // Ponowne ustawienie po każdej zmianie rozmiaru
        menuCtx.imageSmoothingEnabled = false;
        menuCtx.webkitImageSmoothingEnabled = false;
        menuCtx.mozImageSmoothingEnabled = false;
        menuCtx.msImageSmoothingEnabled = false;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ====================================================================
    // === SEKCJA 1: STAŁE I ZMIENNE ŚWIATA MENU ===
    // ====================================================================

    // --- Stałe przeniesione z host.js do generowania świata ---
    const DEDICATED_GAME_HEIGHT = 680; // Używamy stałej wysokości do obliczeń
    const GRASS_DENSITY_FACTOR = 0.075;
    const GRASS_SWAY_DURATION_MS = 1800;
    const GRASS_SPRITE_WIDTH = 32 * 3.8;
    const TREE_DENSITY_BASE_FACTOR = 0.015;
    const TREE_DENSITY_VARIATION_FACTOR = 0.55;
    const TREE_FOREGROUND_CHANCE = 0.15;
    const TREE_MIN_HORIZONTAL_GAP = 64;
    const INSECT_DENSITY_FACTOR = 0.0009;
    const INSECT_SCALE_FACTOR = 2.6;

    // --- Konfiguracja świata menu ---
    const currentWorldWidth = 6000;
    const groundLevel = 256;
    const AVAILABLE_BIOMES = ['jurassic', 'grassland'];
    const chosenBiome = AVAILABLE_BIOMES[Math.floor(Math.random() * AVAILABLE_BIOMES.length)];
    const ZOOM_LEVEL = 1.6;

    // --- Inicjalizacja BiomeManagera ---
    const biomeManager = new BiomeManager(currentWorldWidth, DEDICATED_GAME_HEIGHT);
    let insectsInRoom = [];

    // --- Zmienne kamery ---
    let cameraX = 0;
    let cameraY = 0;
    const CAMERA_SMOOTHING_FACTOR = 0.08;

    // --- Stałe gracza (zgodne z oryginalnym menuworld.js i script.js) ---
    const playerSize = 128;
    const animationCycleLength = 30;
    const armRotationDegrees = 45, legRotationDegrees = 45;
    const bodyHeadPulseAmount = Math.round(2 * (playerSize / 36));
    const armRotationAngle = armRotationDegrees * (Math.PI / 180), legRotationAngle = legRotationDegrees * (Math.PI / 180);
    const originalArmPivotInImageX = Math.round(14 * (playerSize / 36)), originalArmPivotInImageY = Math.round(15 * (playerSize / 36));
    const legPivotInImageX = Math.round(14 * (playerSize / 36)), legPivotInImageY = Math.round(27 * (playerSize / 36));
    const headPivotInImageX = Math.round(16 * (playerSize / 32)), headPivotInImageY = Math.round(16 * (playerSize / 32));
    const headRotationAngleAmount = (Math.PI / 180 * 2);
    const headOscillationAmplitudeFactor = 0.5;
    const headInitialOffsetY = 0;
    const backArmOffsetX = Math.round(8 * (playerSize / 36)), backLegOffsetX = Math.round(9 * (playerSize / 36));
    const PLAYER_WALK_SPEED = 8;
    const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.5;
    const DECELERATION_FACTOR = 0.8;
    const IDLE_ANIM_CYCLE_LENGTH = 60, IDLE_ARM_ROTATION_DEGREES = 8, IDLE_BODY_HEAD_PULSE_AMOUNT = Math.round(1.5 * (playerSize / 36)), IDLE_HEAD_ROTATION_DEGREES = 1, IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR = 0.4, IDLE_ARM_ROTATION_ANGLE = IDLE_ARM_ROTATION_DEGREES * (Math.PI / 180), IDLE_HEAD_ROTATION_ANGLE_AMOUNT = IDLE_HEAD_ROTATION_DEGREES * (Math.PI / 180);
    const eyeSpriteSize = Math.round(32 * (playerSize / 32));
    const eyePivotInImage = eyeSpriteSize / 2;
    const eyeMaxMovementRadius = Math.round(0.4 * (playerSize / 32));
    const LEFT_EYE_BASE_X_REL_HEAD_TL = Math.round(0 * (playerSize / 32));
    const RIGHT_EYE_BASE_X_REL_HEAD_TL = Math.round(4.5 * (playerSize / 32));
    const EYE_BASE_Y_REL_HEAD_TL = Math.round(0.5 * (playerSize / 32));

    let menuPlayer = {
        x: currentWorldWidth / 2 - playerSize / 2,
        y: DEDICATED_GAME_HEIGHT - groundLevel - playerSize,
        isWalking: false, animationFrame: 0,
        direction: 1, velocityX: 0,
        isIdle: true, idleAnimationFrame: 0,
        currentMouseX: 0, currentMouseY: 0
    };

    const characterImagePaths = { leg: 'img/character/leg.png', body: 'img/character/body.png', arm: 'img/character/arm.png', head: 'img/character/head.png', eye: 'img/character/eye.png' };
    const characterImages = {};
    let areAllImagesReady = false;
    let lastTime = 0;

    // ====================================================================
    // === SEKCJA 2: LOKALNE FUNKCJE GENEROWANIA ŚWIATA (z host.js) ===
    // ====================================================================

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
        const biomeDetails = biomeManager.biomeDefinitions[biomeName];

        if (!biomeDetails || !biomeDetails.treeDefinitions) return trees;
        const treeDefinitionCount = biomeDetails.treeDefinitions.length;
        if (treeDefinitionCount === 0) return trees;

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
                        typeIndex: Math.floor(seededRandom() * treeDefinitionCount),
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

    // ====================================================================
    // === SEKCJA 3: ŁADOWANIE OBRAZÓW I INICJALIZACJA ===
    // ====================================================================

    // ZMODYFIKOWANA FUNKCJA
    function loadAllImages(progressCallback, completionCallback) {
        let completed = false;
        let characterImagesLoaded = false;
        let biomeImagesLoaded = false;
        const totalCharacterImages = Object.keys(characterImagePaths).length;
        let loadedCharacterImages = 0;
    
        const checkAllDone = () => {
            if (characterImagesLoaded && biomeImagesLoaded && !completed) {
                completed = true;
                completionCallback();
            }
        };
    
        const updateProgress = () => {
            let progress = 0;
            // Obrazy postaci stanowią 50% postępu
            if (totalCharacterImages > 0) {
                progress += (loadedCharacterImages / totalCharacterImages) * 50;
            } else {
                progress += 50;
            }
            // Obrazy biomu stanowią drugie 50%
            if (biomeImagesLoaded) {
                progress += 50;
            }
            progressCallback(progress);
        };
    
        // 1. Ładuj obrazy postaci
        if (totalCharacterImages === 0) {
            characterImagesLoaded = true;
            updateProgress();
        } else {
            for (const key in characterImagePaths) {
                const img = new Image();
                img.src = characterImagePaths[key];
                const onImageDone = () => {
                    loadedCharacterImages++;
                    updateProgress();
                    if (loadedCharacterImages === totalCharacterImages) {
                        characterImagesLoaded = true;
                        checkAllDone();
                    }
                };
                img.onload = onImageDone;
                img.onerror = () => {
                    console.error(`[MenuWorld] BŁĄD ładowania: ${img.src}`);
                    onImageDone(); // Traktuj błąd jak sukces, aby nie zablokować ładowania
                };
                characterImages[key] = img;
            }
        }
    
        // 2. Ładuj obrazy biomu
        biomeManager.loadBiomeImages(() => {
            biomeImagesLoaded = true;
            updateProgress();
            checkAllDone();
        });
    }

    // --- Inicjalizacja świata (przed ładowaniem obrazów) ---
    biomeManager.setBiome(chosenBiome);
    const roomId = "localMenuWorld";
    const groundPlants = generateGroundPlants(roomId, groundLevel, currentWorldWidth);
    const trees = generateTrees(roomId, groundLevel, currentWorldWidth, chosenBiome);
    insectsInRoom = generateInsects(roomId, groundLevel, currentWorldWidth);
    biomeManager.initializeGroundPlants(groundPlants);
    biomeManager.initializeTrees(trees);


    // ====================================================================
    // === SEKCJA 4: FUNKCJE RYSUJĄCE I AKTUALIZUJĄCE ===
    // ====================================================================
    
    function drawMenuPlayer(p) {
        menuCtx.save();
        let bodyPulseY = 0, arm1Rotation = 0, arm2Rotation = 0, leg1Rotation = 0, leg2Rotation = 0, headRotation = 0, headPulseY = 0;
        
        if (p.isWalking) {
            const a = (p.animationFrame % animationCycleLength) / animationCycleLength, b = Math.sin(2 * a * Math.PI);
            bodyPulseY = -bodyHeadPulseAmount * Math.abs(b);
            arm1Rotation = b * armRotationAngle;
            arm2Rotation = -arm1Rotation;
            leg1Rotation = b * legRotationAngle;
            leg2Rotation = -leg1Rotation;
            headRotation = b * headRotationAngleAmount;
            headPulseY = Math.sin(4 * a * Math.PI) * bodyHeadPulseAmount * headOscillationAmplitudeFactor;
        } else if (p.isIdle) {
            const c = (p.idleAnimationFrame % IDLE_ANIM_CYCLE_LENGTH) / IDLE_ANIM_CYCLE_LENGTH, d = Math.sin(2 * c * Math.PI);
            bodyPulseY = -IDLE_BODY_HEAD_PULSE_AMOUNT * Math.abs(d);
            arm1Rotation = d * IDLE_ARM_ROTATION_ANGLE;
            arm2Rotation = -arm1Rotation;
            leg1Rotation = 0;
            leg2Rotation = 0;
            headRotation = d * IDLE_HEAD_ROTATION_ANGLE_AMOUNT;
            headPulseY = Math.sin(4 * c * Math.PI) * IDLE_BODY_HEAD_PULSE_AMOUNT * IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR;
        }
        
        const headOffsetY = headInitialOffsetY + bodyPulseY + headPulseY;

        let eyeOffsetX = 0, eyeOffsetY = 0;
        if (p.currentMouseX !== undefined) {
            const headWorldX = p.x + headPivotInImageX;
            const headWorldY = p.y + headOffsetY + headPivotInImageY;
            const dx = p.currentMouseX - headWorldX;
            const dy = p.currentMouseY - headWorldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const normX = dx / distance;
                const normY = dy / distance;
                eyeOffsetX = normX * Math.min(distance, eyeMaxMovementRadius);
                eyeOffsetY = normY * Math.min(distance, eyeMaxMovementRadius);
            }
        }
        
        menuCtx.translate(p.x + playerSize / 2, p.y + playerSize / 2);
        menuCtx.scale(p.direction, 1);
        menuCtx.translate(-(p.x + playerSize / 2), -(p.y + playerSize / 2));

        const drawPart = (img, x, y, pivotX, pivotY, rotation, w = playerSize, h = playerSize) => {
            if (!img || !img.complete) return;
            menuCtx.save();
            menuCtx.translate(p.x + x + pivotX, p.y + y + pivotY);
            menuCtx.rotate(rotation);
            menuCtx.drawImage(img, -pivotX, -pivotY, w, h);
            menuCtx.restore();
        };

        drawPart(characterImages.leg, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg2Rotation);
        drawPart(characterImages.arm, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm2Rotation);
        drawPart(characterImages.leg, 0, 0, legPivotInImageX, legPivotInImageY, leg1Rotation);
        if (characterImages.body && characterImages.body.complete) {
             menuCtx.drawImage(characterImages.body, p.x, p.y + bodyPulseY, playerSize, playerSize);
        }
        drawPart(characterImages.head, 0, headOffsetY, headPivotInImageX, headPivotInImageY, headRotation);
        drawPart(characterImages.eye, LEFT_EYE_BASE_X_REL_HEAD_TL + eyeOffsetX, headOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeOffsetY, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);
        drawPart(characterImages.eye, RIGHT_EYE_BASE_X_REL_HEAD_TL + eyeOffsetX, headOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeOffsetY, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);
        drawPart(characterImages.arm, 0, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm1Rotation);
        
        menuCtx.restore();
    }

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
            menuCtx.save();
            menuCtx.translate(insect.x + renderedSize / 2, insect.y + renderedSize / 2);
            menuCtx.rotate(angleInRadians);
            if (typeof insect.hue === 'number') {
                menuCtx.filter = `hue-rotate(${insect.hue}deg)`;
            }
            menuCtx.drawImage(insectImage, sourceX, sourceY, INSECT_TILE_SIZE, INSECT_TILE_SIZE, -renderedSize / 2, -renderedSize / 2, renderedSize, renderedSize);
            menuCtx.restore();
        }
    }
    
    function updateCamera() {
        const playerWorldCenterX = menuPlayer.x + playerSize / 2;
        const visibleWorldWidth = menuCanvas.width / ZOOM_LEVEL;

        let targetCameraX = playerWorldCenterX - visibleWorldWidth / 2;
        if (targetCameraX < 0) targetCameraX = 0;
        if (targetCameraX > currentWorldWidth - visibleWorldWidth) {
            targetCameraX = currentWorldWidth - visibleWorldWidth;
        }

        cameraX = (1 - CAMERA_SMOOTHING_FACTOR) * cameraX + CAMERA_SMOOTHING_FACTOR * targetCameraX;
        cameraY = 120; 
    }

    function update(deltaTime) {
        const lobbyDiv = document.getElementById('lobby');
        if (!lobbyDiv || lobbyDiv.style.display === 'none' || !areAllImagesReady) return;
        
        let targetVelocityX = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) {
            targetVelocityX = -PLAYER_WALK_SPEED;
            menuPlayer.direction = -1;
        } else if (keys['ArrowRight'] || keys['KeyD']) {
            targetVelocityX = PLAYER_WALK_SPEED;
            menuPlayer.direction = 1;
        }
        
        menuPlayer.velocityX = targetVelocityX !== 0 ? targetVelocityX : menuPlayer.velocityX * DECELERATION_FACTOR;
        if (Math.abs(menuPlayer.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) {
             menuPlayer.velocityX = 0;
        }
        menuPlayer.x += menuPlayer.velocityX;
        menuPlayer.x = Math.max(0, Math.min(currentWorldWidth - playerSize, menuPlayer.x));

        menuPlayer.isWalking = Math.abs(menuPlayer.velocityX) > MIN_VELOCITY_FOR_WALK_ANIMATION;
        menuPlayer.isIdle = !menuPlayer.isWalking;

        if (menuPlayer.isWalking) {
            const speedFactor = Math.abs(menuPlayer.velocityX / PLAYER_WALK_SPEED);
            menuPlayer.animationFrame = (menuPlayer.animationFrame + (1 * speedFactor)) % animationCycleLength;
            menuPlayer.idleAnimationFrame = 0;
        } else {
            menuPlayer.animationFrame = 0;
            menuPlayer.idleAnimationFrame = (menuPlayer.idleAnimationFrame + 1) % IDLE_ANIM_CYCLE_LENGTH;
        }

        insectsInRoom.forEach(insect => {
             const time = (Date.now() / 1000) + (insect.timeOffset || 0);
             insect.anchorX += (insect.drift || 0);
             if (insect.anchorX < 0 || insect.anchorX > currentWorldWidth) insect.drift *= -1;
             insect.x = (insect.anchorX || 0) + Math.sin(time * (insect.hSpeed || 1)) * (insect.hAmp || 100);
             insect.y = (insect.baseY || 500) + Math.cos(time * (insect.vSpeed || 1)) * (insect.vAmp || 80);
             insect.angle = Math.cos(time * (insect.hSpeed || 1)) * (insect.hAmp || 100) * (insect.hSpeed || 1) * 0.5;
             insect.animationFrame = ((insect.animationFrame || 0) + 1) % 16;
        });
        
        const playerHitbox = { x: menuPlayer.x + playerSize * 0.25, y: menuPlayer.y + playerSize * 0.8, width: playerSize * 0.5, height: playerSize * 0.2 };
        const allPlants = [...biomeManager.backgroundGroundPlants, ...biomeManager.foregroundGroundPlants];
        allPlants.forEach(grass => {
            if (grass.swaying && Date.now() - grass.swayStartTime > GRASS_SWAY_DURATION_MS) grass.swaying = false;
            if (!grass.swaying && menuPlayer.velocityX !== 0) {
                const grassHitbox = { x: grass.x, y: grass.y - 20, width: GRASS_SPRITE_WIDTH / 2, height: 20 };
                if (playerHitbox.x < grassHitbox.x + grassHitbox.width && playerHitbox.x + playerHitbox.width > grassHitbox.x) {
                    biomeManager.startSwayAnimation(grass.id, menuPlayer.direction);
                    grass.swayStartTime = Date.now();
                }
            }
        });
        
        updateCamera();
        biomeManager.updateAnimations(deltaTime);
    }
    
    function draw() {
        const lobbyDiv = document.getElementById('lobby');
        if (!lobbyDiv || lobbyDiv.style.display === 'none' || !areAllImagesReady) return;
        
        menuCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
        
        menuCtx.save();
        menuCtx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
        menuCtx.translate(-cameraX, -cameraY);
        
        biomeManager.drawParallaxBackground(menuCtx, cameraX, cameraY, menuCanvas.width / ZOOM_LEVEL);
        biomeManager.drawBackgroundBiomeGround(menuCtx, chosenBiome, groundLevel);
        biomeManager.drawBackgroundTrees(menuCtx);
        biomeManager.drawBackgroundPlants(menuCtx);
        drawMenuPlayer(menuPlayer);
        drawInsects();
        biomeManager.drawForegroundPlants(menuCtx);
        biomeManager.drawForegroundTrees(menuCtx);
        biomeManager.drawForegroundBiomeGround(menuCtx, chosenBiome, groundLevel);

        menuCtx.restore();
    }
    
    // ====================================================================
    // === SEKCJA 5: PĘTLA GŁÓWNA I OBSŁUGA ZDARZEŃ ===
    // ====================================================================

    function menuLoop(currentTime) {
        if (!lastTime) lastTime = currentTime;
        const deltaTime = (currentTime - lastTime) / 1000;
        update(deltaTime);
        draw();
        lastTime = currentTime;
        requestAnimationFrame(menuLoop);
    }

    let keys = {};
    document.addEventListener('keydown', (event) => { keys[event.code] = true; });
    document.addEventListener('keyup', (event) => { delete keys[event.code]; });
    
    menuCanvas.addEventListener('mousemove', (event) => {
        const rect = menuCanvas.getBoundingClientRect();
        const mouseX_on_canvas = (event.clientX - rect.left) * (menuCanvas.width / rect.width);
        const mouseY_on_canvas = (event.clientY - rect.top) * (menuCanvas.height / rect.height);
        menuPlayer.currentMouseX = mouseX_on_canvas / ZOOM_LEVEL + cameraX;
        menuPlayer.currentMouseY = mouseY_on_canvas / ZOOM_LEVEL + cameraY;
    });

    // --- NOWY BLOK URUCHOMIENIOWY ---
    console.log("[MenuWorld] Przekazuję proces ładowania do menedżera...");

    // Sprawdzamy, czy loadingManager istnieje (załadowany z loading.js)
    if (typeof loadingManager !== 'undefined' && loadingManager.manageLoadingProcess) {
        loadingManager.manageLoadingProcess(
            // 1. Funkcja, która ładuje zasoby i raportuje postęp
            (progressCallback, completionCallback) => {
                loadAllImages(progressCallback, completionCallback);
            },
            // 2. Funkcja, która ma się wykonać po zakończeniu ładowania
            () => {
                console.log("[MenuWorld] Wszystkie zasoby załadowane. Uruchamiam pętlę animacji tła.");
                areAllImagesReady = true;
                // Pokaż lobby (jeśli było ukryte) i uruchom pętlę gry
                const lobbyDiv = document.getElementById('lobby');
                if(lobbyDiv) lobbyDiv.style.opacity = 1; // Płynne pojawienie się, jeśli masz CSS
                
                requestAnimationFrame(menuLoop);
            }
        );
    } else {
        // Awaryjne uruchomienie, jeśli loading.js nie został załadowany
        console.error("[MenuWorld] Menedżer ładowania (loadingManager) nie został znaleziony! Uruchamiam awaryjnie.");
        const dummyCompletion = () => {
            console.log("[MenuWorld] Wszystkie zasoby załadowane. Uruchamiam pętlę animacji tła.");
            areAllImagesReady = true;
            requestAnimationFrame(menuLoop);
        };
        const dummyProgress = (p) => { console.log(`Postęp ładowania: ${Math.round(p)}%`); };
        loadAllImages(dummyProgress, dummyCompletion);
    }
});