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

    menuCtx.imageSmoothingEnabled = false;
    menuCtx.webkitImageSmoothingEnabled = false;
    menuCtx.mozImageSmoothingEnabled = false;
    menuCtx.msImageSmoothingEnabled = false;
    menuCanvas.style.imageRendering = 'pixelated';

    function resizeCanvas() {
        menuCanvas.width = window.innerWidth;
        menuCanvas.height = window.innerHeight;
        menuCtx.imageSmoothingEnabled = false;
        menuCtx.webkitImageSmoothingEnabled = false;
        menuCtx.mozImageSmoothingEnabled = false;
        menuCtx.msImageSmoothingEnabled = false;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ====================================================================
    // === SEKCJA 1: NOWE MANAGERY I KONFIGURACJA ŚWIATA ===
    // ====================================================================

    const cycleManager = new CycleManager();
    const starManager = new StarManager();
    const cloudManager = new CloudManager();
    const fishingManager = new FishingManager();

    const currentWorldWidth = 6000;
    const DEDICATED_GAME_HEIGHT = 1080;
    const groundLevel = 256;
    const AVAILABLE_BIOMES = ['jurassic', 'grassland'];
    const chosenBiome = AVAILABLE_BIOMES[Math.floor(Math.random() * AVAILABLE_BIOMES.length)];

    const ZOOM_LEVEL = 1.1; // <-- ZMIANA: Lekkie oddalenie kamery
    const CAMERA_Y_POSITION = 450; // <-- ZMIANA: Stała pozycja pionowa kamery
    
    const biomeManager = new BiomeManager(currentWorldWidth, DEDICATED_GAME_HEIGHT);
    let insectsInRoom = [];
    let allItemImages = {};

    let cameraX = 0;
    const CAMERA_SMOOTHING_FACTOR = 0.08;
    
    // Konfiguracja gracza (bez zmian)
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
    const starImagePaths = { star1: 'img/world/star.png', star2: 'img/world/star2.png' };
    const characterImages = {};
    const starImages = {};
    let areAllImagesReady = false;
    let lastTime = 0;

    // Lokalne funkcje generowania świata (bez zmian)
    function createSeededRandom(seedStr) { let seed = 0; for (let i = 0; i < seedStr.length; i++) { seed = (seed * 31 + seedStr.charCodeAt(i)) | 0; } if (seed === 0) seed = 1; const MAX_UINT32 = 4294967295; return function() { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 0) / MAX_UINT32; }; }
    function generateGroundPlants(roomId, groundLevel, worldWidth) { const plants = []; const seededRandom = createSeededRandom(roomId + '-plants'); const groundY = DEDICATED_GAME_HEIGHT - groundLevel; const numPlants = Math.floor(worldWidth * 0.075); for (let i = 0; i < numPlants; i++) { plants.push({ id: `grass_${i}`, x: seededRandom() * worldWidth, y: groundY, typeIndex: Math.floor(seededRandom() * 12), isMirrored: seededRandom() < 0.5, swaying: false, swayStartTime: 0, zIndex: (seededRandom() < 0.7) ? -1 : 1, }); } return plants; }
    function generateTrees(roomId, groundLevel, worldWidth, biomeName) { const trees = []; const seededRandom = createSeededRandom(roomId + '-trees'); const groundY = DEDICATED_GAME_HEIGHT - groundLevel; const biomeDetails = biomeManager.biomeDefinitions[biomeName]; if (!biomeDetails || !biomeDetails.treeDefinitions) return trees; const treeDefinitionCount = biomeDetails.treeDefinitions.length; if (treeDefinitionCount === 0) return trees; const roomDensityModifier = 1 + (seededRandom() * 2 - 1) * 0.55; const numTrees = Math.floor(worldWidth * 0.015 * roomDensityModifier); for (let i = 0; i < numTrees; i++) { let attempts = 0; while (attempts < 50) { const potentialX = seededRandom() * worldWidth; if (!trees.some(tree => Math.abs(potentialX - tree.x) < 64)) { trees.push({ id: `tree_${i}`, x: potentialX, y: groundY, typeIndex: Math.floor(seededRandom() * treeDefinitionCount), isMirrored: seededRandom() < 0.5, zIndex: (seededRandom() < (1 - 0.15)) ? -1 : 1, }); break; } attempts++; } } return trees; }
    function generateInsects(roomId, groundLevel, worldWidth) { const insects = []; const seededRandom = createSeededRandom(roomId + '-insects'); const numInsects = Math.floor(worldWidth * 0.0009); const minY = DEDICATED_GAME_HEIGHT * 0.1; const maxY = DEDICATED_GAME_HEIGHT * 0.3; for (let i = 0; i < numInsects; i++) { const startX = seededRandom() * worldWidth; const startY = minY + seededRandom() * (maxY - minY); insects.push({ id: `insect_${i}`, x: startX, y: startY, hue: seededRandom() * 360, angle: 0, animationFrame: 0, timeOffset: seededRandom() * 1000, anchorX: startX, baseY: startY, drift: (seededRandom() - 0.5) * 2.5, hSpeed: 0.6 + seededRandom() * 0.3, vSpeed: 0.5 + seededRandom() * 0.2, hAmp: 50 + seededRandom() * 130, vAmp: 30 + seededRandom() * 140, }); } return insects; }

    // ====================================================================
    // === SEKCJA 2: ŁADOWANIE OBRAZÓW ===
    // ====================================================================

    function loadAllImages(progressCallback, completionCallback) {
        const pathsToLoad = { ...characterImagePaths, ...starImagePaths };
        
        const fishNames = new Set();
        const allFishData = fishingManager.getFishData();
        for (const biome in allFishData) {
            for (const fishName in allFishData[biome]) {
                fishNames.add(fishName);
            }
        }
        fishNames.forEach(name => {
            pathsToLoad[`fish_${name}`] = `img/fish/${name}.png`;
        });

        const imageKeys = Object.keys(pathsToLoad);
        const totalImages = imageKeys.length;
        let loadedCount = 0;

        const checkCompletion = () => {
            if (loadedCount === totalImages) {
                biomeManager.loadBiomeImages(() => {
                    progressCallback(100);
                    completionCallback();
                });
            }
        };

        if (totalImages === 0) {
            checkCompletion();
            return;
        }

        imageKeys.forEach(key => {
            const img = new Image();
            img.src = pathsToLoad[key];
            const onImageDone = () => {
                loadedCount++;
                progressCallback((loadedCount / totalImages) * 90);
                
                if (key.startsWith('fish_')) {
                    allItemImages[key.substring(5)] = img;
                } else if (characterImagePaths[key]) {
                    characterImages[key] = img;
                } else if (starImagePaths[key]) {
                    starImages[key] = img;
                }
                
                if (loadedCount === totalImages) {
                    checkCompletion();
                }
            };
            img.onload = onImageDone;
            img.onerror = () => { console.error(`[MenuWorld] BŁĄD ładowania: ${img.src}`); onImageDone(); };
        });
    }

    // ====================================================================
    // === SEKCJA 3: FUNKCJE RYSUJĄCE I PĘTLA GRY ===
    // ====================================================================
    
    // Funkcja drawMenuPlayer (bez zmian)
    function drawMenuPlayer(p) { menuCtx.save(); let bodyPulseY = 0, arm1Rotation = 0, arm2Rotation = 0, leg1Rotation = 0, leg2Rotation = 0, headRotation = 0, headPulseY = 0; if (p.isWalking) { const a = (p.animationFrame % animationCycleLength) / animationCycleLength, b = Math.sin(2 * a * Math.PI); bodyPulseY = -bodyHeadPulseAmount * Math.abs(b); arm1Rotation = b * armRotationAngle; arm2Rotation = -arm1Rotation; leg1Rotation = b * legRotationAngle; leg2Rotation = -leg1Rotation; headRotation = b * headRotationAngleAmount; headPulseY = Math.sin(4 * a * Math.PI) * bodyHeadPulseAmount * headOscillationAmplitudeFactor; } else if (p.isIdle) { const c = (p.idleAnimationFrame % IDLE_ANIM_CYCLE_LENGTH) / IDLE_ANIM_CYCLE_LENGTH, d = Math.sin(2 * c * Math.PI); bodyPulseY = -IDLE_BODY_HEAD_PULSE_AMOUNT * Math.abs(d); arm1Rotation = d * IDLE_ARM_ROTATION_ANGLE; arm2Rotation = -arm1Rotation; leg1Rotation = 0; leg2Rotation = 0; headRotation = d * IDLE_HEAD_ROTATION_ANGLE_AMOUNT; headPulseY = Math.sin(4 * c * Math.PI) * IDLE_BODY_HEAD_PULSE_AMOUNT * IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR; } const headOffsetY = headInitialOffsetY + bodyPulseY + headPulseY; let eyeOffsetX = 0, eyeOffsetY = 0; if (p.currentMouseX !== undefined) { const headWorldX = p.x + headPivotInImageX; const headWorldY = p.y + headOffsetY + headPivotInImageY; const dx = p.currentMouseX - headWorldX; const dy = p.currentMouseY - headWorldY; const distance = Math.sqrt(dx * dx + dy * dy); if (distance > 0) { const normX = dx / distance; const normY = dy / distance; eyeOffsetX = normX * Math.min(distance, eyeMaxMovementRadius); eyeOffsetY = normY * Math.min(distance, eyeMaxMovementRadius); } } menuCtx.translate(p.x + playerSize / 2, p.y + playerSize / 2); menuCtx.scale(p.direction, 1); menuCtx.translate(-(p.x + playerSize / 2), -(p.y + playerSize / 2)); const drawPart = (img, x, y, pivotX, pivotY, rotation, w = playerSize, h = playerSize) => { if (!img || !img.complete) return; menuCtx.save(); menuCtx.translate(p.x + x + pivotX, p.y + y + pivotY); menuCtx.rotate(rotation); menuCtx.drawImage(img, -pivotX, -pivotY, w, h); menuCtx.restore(); }; drawPart(characterImages.leg, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg2Rotation); drawPart(characterImages.arm, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm2Rotation); drawPart(characterImages.leg, 0, 0, legPivotInImageX, legPivotInImageY, leg1Rotation); if (characterImages.body && characterImages.body.complete) { menuCtx.drawImage(characterImages.body, p.x, p.y + bodyPulseY, playerSize, playerSize); } drawPart(characterImages.head, 0, headOffsetY, headPivotInImageX, headPivotInImageY, headRotation); drawPart(characterImages.eye, LEFT_EYE_BASE_X_REL_HEAD_TL + eyeOffsetX, headOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeOffsetY, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize); drawPart(characterImages.eye, RIGHT_EYE_BASE_X_REL_HEAD_TL + eyeOffsetX, headOffsetY + EYE_BASE_Y_REL_HEAD_TL + eyeOffsetY, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize); drawPart(characterImages.arm, 0, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm1Rotation); menuCtx.restore(); }
    // Funkcja drawInsects (bez zmian)
    function drawInsects() { const insectImage = biomeManager.getCurrentInsectImage(); if (!insectImage || !insectImage.complete) return; const renderedSize = 32 * 2.6; for (const insect of insectsInRoom) { const currentFrame = Math.floor((insect.animationFrame || 0) / 8); const sourceX = currentFrame * 32; const sourceY = (insect.typeIndex || 0) * 32; const angleInRadians = (insect.angle || 0) * (Math.PI / 180); menuCtx.save(); menuCtx.translate(insect.x + renderedSize / 2, insect.y + renderedSize / 2); menuCtx.rotate(angleInRadians); if (typeof insect.hue === 'number') { menuCtx.filter = `hue-rotate(${insect.hue}deg)`; } menuCtx.drawImage(insectImage, sourceX, sourceY, 32, 32, -renderedSize / 2, -renderedSize / 2, renderedSize, renderedSize); menuCtx.restore(); } }
    
    function update(deltaTime) {
        if (!areAllImagesReady) return;
        
        const lobbyDiv = document.getElementById('lobby');
        if (!lobbyDiv || lobbyDiv.style.display === 'none') return;

        // --- Logika ruchu gracza i owadów ---
        let targetVelocityX = 0; if (keys['ArrowLeft'] || keys['KeyA']) { targetVelocityX = -PLAYER_WALK_SPEED; menuPlayer.direction = -1; } else if (keys['ArrowRight'] || keys['KeyD']) { targetVelocityX = PLAYER_WALK_SPEED; menuPlayer.direction = 1; }
        menuPlayer.velocityX = targetVelocityX !== 0 ? targetVelocityX : menuPlayer.velocityX * DECELERATION_FACTOR; if (Math.abs(menuPlayer.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) { menuPlayer.velocityX = 0; }
        menuPlayer.x += menuPlayer.velocityX; menuPlayer.x = Math.max(0, Math.min(currentWorldWidth - playerSize, menuPlayer.x));
        menuPlayer.isWalking = Math.abs(menuPlayer.velocityX) > MIN_VELOCITY_FOR_WALK_ANIMATION; menuPlayer.isIdle = !menuPlayer.isWalking;
        if (menuPlayer.isWalking) { const speedFactor = Math.abs(menuPlayer.velocityX / PLAYER_WALK_SPEED); menuPlayer.animationFrame = (menuPlayer.animationFrame + (1 * speedFactor)) % animationCycleLength; menuPlayer.idleAnimationFrame = 0; } else { menuPlayer.animationFrame = 0; menuPlayer.idleAnimationFrame = (menuPlayer.idleAnimationFrame + 1) % IDLE_ANIM_CYCLE_LENGTH; }
        insectsInRoom.forEach(insect => { const time = (Date.now() / 1000) + (insect.timeOffset || 0); insect.anchorX += (insect.drift || 0); if (insect.anchorX < 0 || insect.anchorX > currentWorldWidth) insect.drift *= -1; insect.x = (insect.anchorX || 0) + Math.sin(time * (insect.hSpeed || 1)) * (insect.hAmp || 100); insect.y = (insect.baseY || 500) + Math.cos(time * (insect.vSpeed || 1)) * (insect.vAmp || 80); insect.angle = Math.cos(time * (insect.hSpeed || 1)) * (insect.hAmp || 100) * (insect.hSpeed || 1) * 0.5; insect.animationFrame = ((insect.animationFrame || 0) + 1) % 16; });
        const playerHitbox = { x: menuPlayer.x + playerSize * 0.25, y: menuPlayer.y + playerSize * 0.8, width: playerSize * 0.5, height: playerSize * 0.2 }; const allPlants = [...biomeManager.backgroundGroundPlants, ...biomeManager.foregroundGroundPlants]; allPlants.forEach(grass => { if (grass.swaying && Date.now() - grass.swayStartTime > 1800) grass.swaying = false; if (!grass.swaying && menuPlayer.velocityX !== 0) { const grassHitbox = { x: grass.x, y: grass.y - 20, width: (32*3.8) / 2, height: 20 }; if (playerHitbox.x < grassHitbox.x + grassHitbox.width && playerHitbox.x + playerHitbox.width > grassHitbox.x) { biomeManager.startSwayAnimation(grass.id, menuPlayer.direction); grass.swayStartTime = Date.now(); } } });

        // --- Aktualizacja kamery i managerów ---
        const playerWorldCenterX = menuPlayer.x + playerSize / 2;
        const visibleWorldWidth = menuCanvas.width / ZOOM_LEVEL;
        let targetCameraX = playerWorldCenterX - visibleWorldWidth / 2;
        targetCameraX = Math.max(0, Math.min(currentWorldWidth - visibleWorldWidth, targetCameraX));
        cameraX = (1 - CAMERA_SMOOTHING_FACTOR) * cameraX + CAMERA_SMOOTHING_FACTOR * targetCameraX;

        cycleManager.update(deltaTime);
        starManager.update(deltaTime);
        cloudManager.update(deltaTime);
        biomeManager.updateAnimations(deltaTime, menuPlayer, groundLevel, cameraX, menuCanvas.width);
    }
    
    function draw() {
        const lobbyDiv = document.getElementById('lobby');
        if (!lobbyDiv || lobbyDiv.style.display === 'none' || !areAllImagesReady) return;

        menuCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
        
        const centerX = menuCanvas.width / 2;
        const centerY = menuCanvas.height / 2;
        
        menuCtx.save();
        menuCtx.translate(centerX, centerY + 2150);
        menuCtx.rotate(cycleManager.rotation);
        cycleManager.drawBackground(menuCtx);
        menuCtx.restore();

        starManager.draw(menuCtx, cycleManager);
        
        menuCtx.save();
        menuCtx.translate(centerX, centerY + 2150);
        menuCtx.rotate(cycleManager.rotation);
        cycleManager.drawMoon(menuCtx);
        menuCtx.restore();

        menuCtx.save();
        menuCtx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
        menuCtx.translate(-cameraX, -CAMERA_Y_POSITION); // <-- ZMIANA: Zastosowanie nowej pozycji Y
        
        cloudManager.draw(menuCtx);
        biomeManager.drawParallaxBackground(menuCtx, cameraX, 0, menuCanvas.width / ZOOM_LEVEL);
        biomeManager.drawBackgroundBiomeGround(menuCtx, chosenBiome, groundLevel);
        biomeManager.drawBackgroundTrees(menuCtx);
        biomeManager.drawBackgroundPlants(menuCtx);
        
        drawMenuPlayer(menuPlayer);
        
        biomeManager.drawForegroundPlants(menuCtx);
        biomeManager.drawForegroundTrees(menuCtx);
        
        drawInsects();
                
        biomeManager.drawForegroundBiomeGround(menuCtx, chosenBiome, groundLevel);
        
        biomeManager.drawSwimmingFish(menuCtx);
        biomeManager.drawWater(menuCtx, chosenBiome, cameraX);
        
        menuCtx.restore();
    }
    
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
        menuPlayer.currentMouseY = mouseY_on_canvas / ZOOM_LEVEL + CAMERA_Y_POSITION; // <-- ZMIANA
    });

    // --- Inicjalizacja końcowa ---
    console.log("[MenuWorld] Inicjalizuję świat menu...");
    
    biomeManager.setBiome(chosenBiome);
    const roomId = "localMenuWorld";
    biomeManager.initializeGroundPlants(generateGroundPlants(roomId, groundLevel, currentWorldWidth));
    biomeManager.initializeTrees(generateTrees(roomId, groundLevel, currentWorldWidth, chosenBiome));
    insectsInRoom = generateInsects(roomId, groundLevel, currentWorldWidth);
    
    if (typeof loadingManager !== 'undefined' && loadingManager.manageLoadingProcess) {
        loadingManager.manageLoadingProcess(
            (progressCallback, completionCallback) => {
                loadAllImages(progressCallback, completionCallback);
            },
            () => {
                console.log("[MenuWorld] Wszystkie zasoby załadowane. Finalizuję setup.");
                areAllImagesReady = true;

                biomeManager.setFishAssets(fishingManager.getFishData(), allItemImages);
                starManager.areAssetsLoaded = true;
                starManager.initialize(currentWorldWidth, DEDICATED_GAME_HEIGHT);
                cycleManager.load();
                
                const lobbyDiv = document.getElementById('lobby');
                if(lobbyDiv) lobbyDiv.style.opacity = 1;
                
                requestAnimationFrame(menuLoop);
            }
        );
    } else {
        console.error("[MenuWorld] Menedżer ładowania (loadingManager) nie został znaleziony!");
    }
});