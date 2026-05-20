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
    // === SEKCJA 0: DEFINICJA KLASY DYMKÓW (PRZENIESIONA) ===
    // ====================================================================

    class WalkingParticleManager {
        constructor() {
            this.particles = [];
            this.particleImages = {};
        }
    
        spawn(x, y, isSmall = false) {
            const image = isSmall ? this.particleImages['16x16'] : this.particleImages['8x8'];
            if (!image || !image.complete) return;
    
            const isFront = Math.random() < 0.3;
    
            this.particles.push({
                img: image,
                x: x + (Math.random() - 0.5) * 15,
                y: y,
                alpha: 1.0,
                scale: (isSmall ? 1.0 : 2.0) * 2,
                rotation: Math.random() * Math.PI * 2,
                life: isFront ? 0.8 : 1.0,
                rotationSpeed: (Math.random() - 0.5) * 4,
                growthSpeed: Math.random() * 2 + 1,
                fadeSpeed: Math.random() * 0.5 + 1.0,
                velocityY: -(Math.random() * 15 + (isFront ? 20 : 10)),
                layer: isFront ? 'front' : 'behind'
            });
        }
    
        update(deltaTime) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life -= p.fadeSpeed * deltaTime;
                p.alpha = p.life;
                p.scale += p.growthSpeed * deltaTime;
                p.rotation += p.rotationSpeed * deltaTime;
                p.y += p.velocityY * deltaTime;
                if (p.life <= 0) {
                    this.particles.splice(i, 1);
                }
            }
        }
    
        draw(ctx, layerToDraw) {
            if (this.particles.length === 0) return;
            this.particles.forEach(p => {
                if (p.layer === layerToDraw) {
                    const size = p.img.width * p.scale;
                    ctx.save();
                    ctx.globalAlpha = p.alpha;
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation);
                    ctx.drawImage(p.img, -size / 2, -size / 2, size, size);
                    ctx.restore();
                }
            });
        }
    }

    // ====================================================================
    // === SEKCJA 1: NOWE MANAGERY I KONFIGURACJA ŚWIATA ===
    // ====================================================================

    const cycleManager = new CycleManager();
    const starManager = new StarManager();
    const cloudManager = new CloudManager();
    const fishingManager = new FishingManager();
    const walkingparticles = new WalkingParticleManager();

    const currentWorldWidth = 6000;
    const DEDICATED_GAME_HEIGHT = 1080;
    const groundLevel = 256;
    const AVAILABLE_BIOMES = ['jurassic', 'grassland'];
    const chosenBiome = AVAILABLE_BIOMES[Math.floor(Math.random() * AVAILABLE_BIOMES.length)];

    const ZOOM_LEVEL = 1.1;
    
    let cameraX = 0;
    let cameraY = 0;
    const CAMERA_SMOOTHING_FACTOR = 0.08;
    
    const biomeManager = new BiomeManager(currentWorldWidth, DEDICATED_GAME_HEIGHT);
    let insectsInRoom = [];
    let allItemImages = {};
    
    let availableUsernames = [];
    const flagImageCache = {};
    let bobberAnimationTime = 0; 
    
    let walkParticleTimer = 0;
    let wasPlayerOnGround = true;

    // ====================================================================
    // === SEKCJA 1A: ZMIENNE I KONSTANTY DO RYSOWANIA POSTACI (PRZENIESIONE Z SCRIPT.JS) ===
    // ====================================================================

    const playerSize = 128;
    const animationCycleLength = 60;
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
    const frontArmOffsetX = 0;
    const frontLegOffsetX = 0;
    const PLAYER_WALK_SPEED = 8;
    const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.5;
    const DECELERATION_FACTOR = 0.8;
    
    const PIXEL_FONT = 'Segoe UI, monospace';
    const DEFAULT_FONT_SIZE_USERNAME = 16;

    const IDLE_ANIM_CYCLE_LENGTH = 60, IDLE_ARM_ROTATION_DEGREES = 8, IDLE_BODY_HEAD_PULSE_AMOUNT = Math.round(1.5 * (playerSize / 36)), IDLE_HEAD_ROTATION_DEGREES = 1, IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR = 0.4, IDLE_ARM_ROTATION_ANGLE = IDLE_ARM_ROTATION_DEGREES * (Math.PI / 180), IDLE_HEAD_ROTATION_ANGLE_AMOUNT = IDLE_HEAD_ROTATION_DEGREES * (Math.PI / 180);
    const JUMP_BODY_TILT_DEGREES = -20, JUMP_LEG_OPPOSITE_ROTATION_DEGREES = -120, JUMP_LEG_WAVE_DEGREES = 120, JUMP_ARM_WAVE_DEGREES = 180;
    const JUMP_BODY_TILT_ANGLE = JUMP_BODY_TILT_DEGREES * (Math.PI / 180), JUMP_LEG_OPPOSITE_ROTATION_ANGLE = JUMP_LEG_OPPOSITE_ROTATION_DEGREES * (Math.PI / 180), JUMP_LEG_WAVE_ANGLE = JUMP_LEG_WAVE_DEGREES * (Math.PI / 180), JUMP_ARM_WAVE_ANGLE = JUMP_ARM_WAVE_DEGREES * (Math.PI / 180);
    const eyeSpriteSize = Math.round(32 * (playerSize / 32)), eyePivotInImage = eyeSpriteSize / 2, eyeMaxMovementRadius = 0, LEFT_EYE_BASE_X_REL_HEAD_TL = Math.round(0 * (playerSize / 32)), RIGHT_EYE_BASE_X_REL_HEAD_TL = Math.round(4.5 * (playerSize / 32)), EYE_BASE_Y_REL_HEAD_TL = Math.round(0.5 * (playerSize / 32));
    const HAIR_SATURATION_MIN = 0, HAIR_SATURATION_MAX = 200, HAIR_BRIGHTNESS_MIN = 40, HAIR_BRIGHTNESS_MAX = 200, HAIR_HUE_MIN = 0, HAIR_HUE_MAX = 360;
    const BEARD_SATURATION_MIN = 0, BEARD_SATURATION_MAX = 200, BEARD_BRIGHTNESS_MIN = 40, BEARD_BRIGHTNESS_MAX = 200, BEARD_HUE_MIN = 0, BEARD_HUE_MAX = 360;
    const HAIR_VERTICAL_OFFSET = -Math.round(10 * (playerSize / 32)), BEARD_VERTICAL_OFFSET = -Math.round(10 * (playerSize / 32));
    const ITEM_NONE = 'none', ITEM_ROD = 'rod';
    const FLOAT_SIZE = 32;
    const BOBBER_VERTICAL_OSCILLATION = 4;
    const BOBBER_ANIMATION_SPEED = 0.05;

    let menuPlayer = {
        x: currentWorldWidth / 2 - playerSize / 2,
        y: DEDICATED_GAME_HEIGHT - groundLevel - playerSize,
        isWalking: false, isJumping: false, isIdle: true,
        animationFrame: 0, idleAnimationFrame: 0,
        direction: 1, velocityX: 0, velocityY: 0,
        currentMouseX: 0, currentMouseY: 0
    };

    // ====================================================================
    // === SEKCJA 1B: DEFINICJE ASSETÓW I CUSTOMIZACJI (PRZENIESIONE Z SCRIPT.JS) ===
    // ====================================================================
    
    const SKIN_TONES = [
        { name: 'white fair tone', suffix: '', images: {}, paths: { leg: 'img/character/leg.png', body: 'img/character/body.png', arm: 'img/character/arm.png', head: 'img/character/head.png', eye: 'img/character/eye.png' } },
        { name: 'medium fair tone', suffix: '2', images: {}, paths: {} },
        { name: 'olive tone', suffix: '3', images: {}, paths: {} },
        { name: 'dark brown tone', suffix: '4', images: {}, paths: {} },
        { name: 'black tone', suffix: '5', images: {}, paths: {} },
        { name: 'warm tone', suffix: '6', images: {}, paths: {} },
        { name: 'pale white', suffix: '7', images: {}, paths: {} },
    ];
    SKIN_TONES.forEach(tone => {
        if (tone.suffix) {
            tone.paths = {
                leg: `img/character/leg${tone.suffix}.png`,
                body: `img/character/body${tone.suffix}.png`,
                arm: `img/character/arm${tone.suffix}.png`,
                head: `img/character/head${tone.suffix}.png`,
                eye: 'img/character/eye.png'
            };
        }
    });
    const characterImagePaths = SKIN_TONES[0].paths;
    const characterImages = SKIN_TONES[0].images;

    const starImagePaths = { star1: 'img/world/star.png', star2: 'img/world/star2.png' };
    const starImages = {};
    const characterCustomImages = { hat: {}, hair: {}, accessories: {}, beard: {}, clothes: {}, clothes_arm: {}, pants: {}, pants_leg: {}, shoes: {}, items: {} };

    const walkingParticleImagePaths = {
        '8x8': 'img/world/particles8x8.png',
        '16x16': 'img/world/particles16x16.png'
    };

    const customizationOptions = { 
        hat: ['none', 'red cap', 'blue cap', 'special', 'street cap', 'pink cap', 'black cap', 'oldschool cap', 'blue straight cap', 'green straight cap', 'kiddo cap', 'red seasonal', 'green seasonal', 'flat cap','cowboy hat', 'adventure hat', 'straw hat', 'lake hat', 'fedora'], 
        hair: ['none', 'Curly', 'Curly Short', 'Short', 'Plodder', '"Cool Kid"', 'inmate', 'maniac', 'alopecia', 'Mrs. Robinson', 'Bob', 'Mod', 'U.S Army', 'Afro', 'Tuber Afro', 'Greasy Grunge', 'Mohawk', 'Messy Bun', 'Juliet', 'I`m a Star', 'Short Twist', '"Emo"', "Dandere", "Smart Bangs", 'Ponytail','Richie', 'Pigtails', 'Rambo'], 
        accessories: ['none', 'librarian glasses', 'mole glasses', 'square glasses', 'black glasses', 'red glasses', '"cool" glasses', 'sunglasses', 'windsor glasses', 'eye patch'], 
        beard: ['none', 'goatee', 'overgrown goatee', 'mustache', 'overgrown mustache', 'charlie?', 'unshaven', 'sailor'], 
        clothes: ['none', 'white t-shirt', 'black t-shirt', 'hawaii shirt', 'red hoodie', 'blue hoodie', 'skull t-shirt', 'red plaid vest', 'dark blue soccer shirt', 'green soccer shirt', 'light soccer shirt', 'denim vest', 'coquette dress', 'elegant shirt', 'employee shirt', '60s motorcyclist', '80s motorcyclist', 'hippie diy', 'pink nylon', 'orange nylon', 'pink shirt', 'green shirt', 'raincoat', 'purple sweater', 'aqua sweater', 'plaid suit', 'suit', 'black top', 'white top'], 
        pants: ['none', 'blue jeans', 'ripped jeans', 'black jeans', 'black skirt', 'black bell bottom jeans', 'blue bell bottom jeans', 'red shorts', 'black shorts', 'adventure pants', 'camo pants', 'camo shorts', 'fishnet stockings', 'punk pants', 'pink nylon', 'orange nylon', 'classic sweatpants', 'sweatpants', 'sweat shorts'], 
        shoes: ['none', 'classic sneakers', 'heavy boots', 'red sneakers', 'sandals'],
        skin: ['white fair tone', 'medium fair tone', 'olive tone', 'dark brown tone', 'black tone', 'pale white', 'warm tone']
    };

    const exampleCustomItemPaths = {
        hat: { 'red cap': 'img/character/custom/hat/type1.png', 'blue cap': 'img/character/custom/hat/type2.png', 'special': 'img/character/custom/hat/type3.png', 'street cap': 'img/character/custom/hat/type4.png', 'pink cap': 'img/character/custom/hat/type5.png', 'black cap': 'img/character/custom/hat/type6.png', 'oldschool cap': 'img/character/custom/hat/type7.png', 'blue straight cap': 'img/character/custom/hat/type8.png', 'green straight cap': 'img/character/custom/hat/type9.png', 'kiddo cap': 'img/character/custom/hat/type10.png', 'red seasonal': 'img/character/custom/hat/type11.png', 'green seasonal': 'img/character/custom/hat/type12.png', 'flat cap': 'img/character/custom/hat/type13.png', 'cowboy hat': 'img/character/custom/hat/type14.png', 'adventure hat': 'img/character/custom/hat/type15.png', 'straw hat': 'img/character/custom/hat/type16.png', 'lake hat': 'img/character/custom/hat/type17.png', 'fedora': 'img/character/custom/hat/type18.png' },
        hair: { 'Curly': 'img/character/custom/hair/type1.png', 'Curly Short': 'img/character/custom/hair/type2.png', 'Short': 'img/character/custom/hair/type3.png', 'Plodder': 'img/character/custom/hair/type4.png', '"Cool Kid"': 'img/character/custom/hair/type5.png', 'inmate': 'img/character/custom/hair/type6.png', 'maniac': 'img/character/custom/hair/type7.png', 'alopecia': 'img/character/custom/hair/type8.png', 'Mrs. Robinson': 'img/character/custom/hair/type9.png', 'Bob': 'img/character/custom/hair/type10.png', 'Mod': 'img/character/custom/hair/type11.png', 'U.S Army': 'img/character/custom/hair/type12.png', 'Afro': 'img/character/custom/hair/type13.png', 'Tuber Afro': 'img/character/custom/hair/type14.png', 'Greasy Grunge': 'img/character/custom/hair/type15.png', 'Mohawk': 'img/character/custom/hair/type16.png', 'Messy Bun': 'img/character/custom/hair/type17.png', 'Juliet': 'img/character/custom/hair/type18.png', 'I`m a Star': 'img/character/custom/hair/type19.png', 'Short Twist': 'img/character/custom/hair/type20.png', '"Emo"': 'img/character/custom/hair/type21.png', 'Dandere': 'img/character/custom/hair/type22.png', 'Smart Bangs': 'img/character/custom/hair/type23.png', 'Ponytail': 'img/character/custom/hair/type25.png', 'Pigtails': 'img/character/custom/hair/type24.png', 'Richie': 'img/character/custom/hair/type26.png', 'Rambo': 'img/character/custom/hair/type27.png' },
        accessories: { 'librarian glasses': 'img/character/custom/accessories/type1.png', 'mole glasses': 'img/character/custom/accessories/type2.png', 'square glasses': 'img/character/custom/accessories/type3.png', 'black glasses': 'img/character/custom/accessories/type4.png', 'red glasses': 'img/character/custom/accessories/type5.png', '"cool" glasses': 'img/character/custom/accessories/type6.png', 'sunglasses': 'img/character/custom/accessories/type7.png', 'windsor glasses': 'img/character/custom/accessories/type8.png', 'eye patch': 'img/character/custom/accessories/type9.png' },
        beard: { 'goatee': 'img/character/custom/beard/type1.png', 'overgrown goatee': 'img/character/custom/beard/type2.png', 'mustache': 'img/character/custom/beard/type3.png', 'overgrown mustache': 'img/character/custom/beard/type4.png', 'charlie?': 'img/character/custom/beard/type5.png', 'unshaven': 'img/character/custom/beard/type6.png', 'sailor': 'img/character/custom/beard/type7.png' },
        clothes: { 'white t-shirt': 'img/character/custom/clothes/type1.png', 'black t-shirt': 'img/character/custom/clothes/type2.png', 'hawaii shirt': 'img/character/custom/clothes/type3.png', 'red hoodie': 'img/character/custom/clothes/type4.png', 'blue hoodie': 'img/character/custom/clothes/type5.png', 'skull t-shirt': 'img/character/custom/clothes/type6.png', 'red plaid vest': 'img/character/custom/clothes/type7.png', 'dark blue soccer shirt': 'img/character/custom/clothes/type8.png', 'green soccer shirt': 'img/character/custom/clothes/type9.png', 'light soccer shirt': 'img/character/custom/clothes/type10.png', 'denim vest': 'img/character/custom/clothes/type11.png', 'coquette dress': 'img/character/custom/clothes/type12.png', 'elegant shirt': 'img/character/custom/clothes/type13.png', 'employee shirt': 'img/character/custom/clothes/type14.png', '60s motorcyclist': 'img/character/custom/clothes/type15.png', '80s motorcyclist': 'img/character/custom/clothes/type16.png', 'hippie diy': 'img/character/custom/clothes/type17.png', 'pink nylon': 'img/character/custom/clothes/type18.png', 'orange nylon': 'img/character/custom/clothes/type19.png', 'pink shirt': 'img/character/custom/clothes/type20.png', 'green shirt': 'img/character/custom/clothes/type21.png', 'raincoat': 'img/character/custom/clothes/type22.png', 'plaid suit': 'img/character/custom/clothes/type23.png', 'suit': 'img/character/custom/clothes/type24.png', 'purple sweater': 'img/character/custom/clothes/type25.png', 'aqua sweater': 'img/character/custom/clothes/type26.png', 'black top': 'img/character/custom/clothes/type27.png', 'white top': 'img/character/custom/clothes/type28.png' },
        clothes_arm: { 'white t-shirt': 'img/character/custom/clothes/arm/type1.png', 'black t-shirt': 'img/character/custom/clothes/arm/type2.png', 'hawaii shirt': 'img/character/custom/clothes/arm/type3.png', 'red hoodie': 'img/character/custom/clothes/arm/type4.png', 'blue hoodie': 'img/character/custom/clothes/arm/type5.png', 'skull t-shirt': 'img/character/custom/clothes/arm/type6.png', 'red plaid vest': 'img/character/custom/clothes/arm/type7.png', 'dark blue soccer shirt': 'img/character/custom/clothes/arm/type8.png', 'green soccer shirt': 'img/character/custom/clothes/arm/type9.png', 'light soccer shirt': 'img/character/custom/clothes/arm/type10.png', 'denim vest': 'img/character/custom/clothes/arm/type11.png', 'coquette dress': 'img/character/custom/clothes/arm/type12.png', 'elegant shirt': 'img/character/custom/clothes/arm/type13.png', 'employee shirt': 'img/character/custom/clothes/arm/type14.png', '60s motorcyclist': 'img/character/custom/clothes/arm/type15.png', '80s motorcyclist': 'img/character/custom/clothes/arm/type16.png', 'hippie diy': 'img/character/custom/clothes/arm/type17.png', 'pink nylon': 'img/character/custom/clothes/arm/type18.png', 'orange nylon': 'img/character/custom/clothes/arm/type19.png', 'pink shirt': 'img/character/custom/clothes/arm/type20.png', 'green shirt': 'img/character/custom/clothes/arm/type21.png', 'raincoat': 'img/character/custom/clothes/arm/type22.png', 'plaid suit': 'img/character/custom/clothes/arm/type23.png', 'suit': 'img/character/custom/clothes/arm/type24.png', 'purple sweater': 'img/character/custom/clothes/arm/type25.png', 'aqua sweater': 'img/character/custom/clothes/arm/type26.png', 'black top': 'img/character/custom/clothes/arm/type27.png', 'white top': 'img/character/custom/clothes/arm/type28.png' },
        pants: { 'blue jeans': 'img/character/custom/pants/type1.png', 'ripped jeans': 'img/character/custom/pants/type2.png', 'black jeans': 'img/character/custom/pants/type3.png', 'black skirt': 'img/character/custom/pants/type4.png', 'black bell bottom jeans': 'img/character/custom/pants/type5.png', 'blue bell bottom jeans': 'img/character/custom/pants/type6.png', 'red shorts': 'img/character/custom/pants/type7.png', 'black shorts': 'img/character/custom/pants/type8.png', 'adventure pants': 'img/character/custom/pants/type9.png', 'camo pants': 'img/character/custom/pants/type10.png', 'camo shorts': 'img/character/custom/pants/type11.png', 'fishnet stockings': 'img/character/custom/pants/type12.png', 'punk pants': 'img/character/custom/pants/type13.png', 'pink nylon': 'img/character/custom/pants/type14.png', 'orange nylon': 'img/character/custom/pants/type15.png', 'classic sweatpants': 'img/character/custom/pants/type16.png', 'sweatpants': 'img/character/custom/pants/type17.png', 'sweat shorts': 'img/character/custom/pants/type18.png' },
        pants_leg: { 'blue jeans': 'img/character/custom/pants/leg/type1.png', 'ripped jeans': 'img/character/custom/pants/leg/type2.png', 'black jeans': 'img/character/custom/pants/leg/type3.png', 'black skirt': 'img/character/custom/pants/leg/type4.png', 'black bell bottom jeans': 'img/character/custom/pants/leg/type5.png', 'blue bell bottom jeans': 'img/character/custom/pants/leg/type6.png', 'red shorts': 'img/character/custom/pants/leg/type7.png', 'black shorts': 'img/character/custom/pants/leg/type8.png', 'adventure pants': 'img/character/custom/pants/leg/type9.png', 'camo pants': 'img/character/custom/pants/leg/type10.png', 'camo shorts': 'img/character/custom/pants/leg/type11.png', 'fishnet stockings': 'img/character/custom/pants/leg/type12.png', 'punk pants': 'img/character/custom/pants/leg/type13.png', 'pink nylon': 'img/character/custom/pants/leg/type14.png', 'orange nylon': 'img/character/custom/pants/leg/type15.png', 'classic sweatpants': 'img/character/custom/pants/leg/type16.png', 'sweatpants': 'img/character/custom/pants/leg/type17.png', 'sweat shorts': 'img/character/custom/pants/leg/type18.png' },
        shoes: { 'classic sneakers': 'img/character/custom/shoes/type1.png', 'heavy boots': 'img/character/custom/shoes/type2.png', 'red sneakers': 'img/character/custom/shoes/type3.png', 'sandals': 'img/character/custom/shoes/type4.png' },
        items: {'rod':{path:'img/item/rod.png',width:playerSize*2,height:playerSize,pivotX_in_img:Math.round(20*(playerSize/128)),pivotY_in_round:(20*(playerSize/128))}, 'float':{path:'img/item/float.png',width:32,height:62}}
    };

    let areAllImagesReady = false;
    let lastTime = 0;
    
    // ====================================================================
    // === SEKCJA 1C: KLASA DO ZARZĄDZANIA MARIONETKAMI W MENU ===
    // ====================================================================

    class MenuPuppetManager {
        constructor() {
            this.puppets = [];
            this.PUPPET_COUNT = 7;
            this.countryCodes = COUNTRIES.map(c => c.code);
        }

        createPuppets() {
            if (availableUsernames.length === 0) {
                console.warn("[MenuWorld] Brak wczytanych nicków z tags.txt. Marionetki nie będą miały nazw.");
            }

            this.puppets = [];
            const shuffledUsernames = [...availableUsernames].sort(() => 0.5 - Math.random());

            for (let i = 0; i < this.PUPPET_COUNT; i++) {
                const zoneWidth = currentWorldWidth / this.PUPPET_COUNT;
                const zoneStartX = i * zoneWidth;
                const padding = playerSize * 2;
                const randomXInZone = zoneStartX + padding + (Math.random() * (zoneWidth - (padding * 2)));

                const poseType = Math.random();
                let puppet = {
                    username: shuffledUsernames[i] || `Puppet_${i+1}`,
                    selectedFlag: this.countryCodes[Math.floor(Math.random() * this.countryCodes.length)],
                    x: randomXInZone,
                    y: DEDICATED_GAME_HEIGHT - groundLevel - playerSize,
                    isWalking: false, isJumping: false, isIdle: false,
                    animationFrame: 0, idleAnimationFrame: 0,
                    direction: Math.random() < 0.5 ? 1 : -1, 
                    velocityX: 0, velocityY: 0,
                    customizations: this.getRandomCustomizations()
                };

                if (poseType < 0.05) {
                    puppet.isJumping = true;
                    puppet.y -= 40 + Math.random() * 50; 
                    puppet.velocityY = (Math.random() - 0.5) * 40;
                } else if (poseType < 0.30) {
                    puppet.isWalking = true;
                    puppet.animationFrame = Math.random() * animationCycleLength;
                } else {
                    puppet.isIdle = true;
                    puppet.idleAnimationFrame = Math.random() * IDLE_ANIM_CYCLE_LENGTH;
                    if (Math.random() < 0.8) {
                        puppet.customizations.rightHandItem = ITEM_ROD;
                        puppet.hasLineCast = true;
                        puppet.floatWorldX = puppet.x + puppet.direction * (150 + Math.random() * 200);
                        puppet.floatWorldY = biomeManager.WATER_TOP_Y_WORLD;
                    }
                }
                
                const c = puppet.customizations;
                if (c.hair && c.hair !== 'none') {
                    const hairImage = characterCustomImages.hair[c.hair];
                    if (hairImage) c.tintedHair = createTintedSprite(hairImage, c.hairSaturation, c.hairHue, c.hairBrightness);
                }
                if (c.beard && c.beard !== 'none') {
                    const beardImage = characterCustomImages.beard[c.beard];
                    if (beardImage) c.tintedBeard = createTintedSprite(beardImage, c.beardSaturation, c.beardHue, c.beardBrightness);
                }

                this.puppets.push(puppet);
            }
            this.puppets.push(menuPlayer);
        }

        getRandomCustomizations() {
            const randomChoice = (category) => {
                const options = customizationOptions[category];
                return options[Math.floor(Math.random() * options.length)];
            };
            const randomValue = (min, max) => min + Math.random() * (max - min);

            const customizations = {
                hat: randomChoice('hat'),
                hair: randomChoice('hair'),
                accessories: randomChoice('accessories'),
                beard: randomChoice('beard'),
                clothes: randomChoice('clothes'),
                pants: randomChoice('pants'),
                shoes: randomChoice('shoes'),
                skin: randomChoice('skin'),
                rightHandItem: ITEM_NONE,
                hairSaturation: randomValue(HAIR_SATURATION_MIN, HAIR_SATURATION_MAX),
                hairHue: randomValue(HAIR_HUE_MIN, HAIR_HUE_MAX),
                hairBrightness: randomValue(HAIR_BRIGHTNESS_MIN, HAIR_BRIGHTNESS_MAX),
                beardSaturation: randomValue(BEARD_SATURATION_MIN, BEARD_SATURATION_MAX),
                beardHue: randomValue(BEARD_HUE_MIN, BEARD_HUE_MAX),
                beardBrightness: randomValue(BEARD_BRIGHTNESS_MIN, BEARD_BRIGHTNESS_MAX),
            };

            if (customizations.hat !== 'none' && customizations.hair !== 'none') {
                if (Math.random() < 0.5) {
                    customizations.hair = 'none';
                } else {
                    customizations.hat = 'none';
                }
            }

            return customizations;
        }

        draw(ctx) {
            const sortedCharacters = [...this.puppets].sort((a, b) => (a.y + playerSize) - (b.y + playerSize));
            sortedCharacters.forEach(p => {
                drawCharacter(ctx, p);
            });
        }
    }

    const puppetManager = new MenuPuppetManager();

    function createSeededRandom(seedStr) { let seed = 0; for (let i = 0; i < seedStr.length; i++) { seed = (seed * 31 + seedStr.charCodeAt(i)) | 0; } if (seed === 0) seed = 1; const MAX_UINT32 = 4294967295; return function() { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 0) / MAX_UINT32; }; }
    function generateGroundPlants(roomId, groundLevel, worldWidth) { const plants = []; const seededRandom = createSeededRandom(roomId + '-plants'); const groundY = DEDICATED_GAME_HEIGHT - groundLevel; const numPlants = Math.floor(worldWidth * 0.075); for (let i = 0; i < numPlants; i++) { plants.push({ id: `grass_${i}`, x: seededRandom() * worldWidth, y: groundY, typeIndex: Math.floor(seededRandom() * 12), isMirrored: seededRandom() < 0.5, swaying: false, swayStartTime: 0, zIndex: (seededRandom() < 0.7) ? -1 : 1, }); } return plants; }
    function generateTrees(roomId, groundLevel, worldWidth, biomeName) { const trees = []; const seededRandom = createSeededRandom(roomId + '-trees'); const groundY = DEDICATED_GAME_HEIGHT - groundLevel; const biomeDetails = biomeManager.biomeDefinitions[biomeName]; if (!biomeDetails || !biomeDetails.treeDefinitions) return trees; const treeDefinitionCount = biomeDetails.treeDefinitions.length; if (treeDefinitionCount === 0) return trees; const roomDensityModifier = 1 + (seededRandom() * 2 - 1) * 0.55; const numTrees = Math.floor(worldWidth * 0.015 * roomDensityModifier); for (let i = 0; i < numTrees; i++) { let attempts = 0; while (attempts < 50) { const potentialX = seededRandom() * worldWidth; if (!trees.some(tree => Math.abs(potentialX - tree.x) < 64)) { trees.push({ id: `tree_${i}`, x: potentialX, y: groundY, typeIndex: Math.floor(seededRandom() * treeDefinitionCount), isMirrored: seededRandom() < 0.5, zIndex: (seededRandom() < (1 - 0.15)) ? -1 : 1, }); break; } attempts++; } } return trees; }
    function generateInsects(roomId, groundLevel, worldWidth) { const insects = []; const seededRandom = createSeededRandom(roomId + '-insects'); const numInsects = Math.floor(worldWidth * 0.0009); const minY = DEDICATED_GAME_HEIGHT * 0.1; const maxY = DEDICATED_GAME_HEIGHT * 0.3; for (let i = 0; i < numInsects; i++) { const startX = seededRandom() * worldWidth; const startY = minY + seededRandom() * (maxY - minY); insects.push({ id: `insect_${i}`, x: startX, y: startY, hue: seededRandom() * 360, angle: 0, animationFrame: 0, timeOffset: seededRandom() * 1000, anchorX: startX, baseY: startY, drift: (seededRandom() - 0.5) * 2.5, hSpeed: 0.6 + seededRandom() * 0.3, vSpeed: 0.5 + seededRandom() * 0.2, hAmp: 50 + seededRandom() * 130, vAmp: 30 + seededRandom() * 140, }); } return insects; }

    // ====================================================================
    // === SEKCJA 2: ŁADOWANIE OBRAZÓW I DANYCH ===
    // ====================================================================

    function loadDataAndImages(progressCallback, completionCallback) {
        fetch('tags.txt')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(text => {
                availableUsernames = text.split('\n').map(name => name.trim()).filter(name => name.length > 0);
                console.log(`[MenuWorld] Wczytano ${availableUsernames.length} nicków.`);
                loadAllImages(progressCallback, completionCallback);
            })
            .catch(error => {
                console.error('[MenuWorld] Błąd wczytywania pliku tags.txt:', error);
                loadAllImages(progressCallback, completionCallback);
            });
    }

    function loadAllImages(progressCallback, completionCallback) {
        const pathsToLoad = { ...starImagePaths, ...walkingParticleImagePaths };

        SKIN_TONES.forEach(tone => {
            Object.keys(tone.paths).forEach(key => {
                pathsToLoad[`skin___${tone.suffix || 'default'}___${key}`] = tone.paths[key];
            });
        });

        for (const category in exampleCustomItemPaths) {
            for(const itemName in exampleCustomItemPaths[category]) {
                const pathData = exampleCustomItemPaths[category][itemName];
                const path = typeof pathData === 'string' ? pathData : pathData.path;
                pathsToLoad[`${category}___${itemName}`] = path; 
            }
        }
        
        const fishNames = new Set();
        const allFishData = fishingManager.getFishData();
        for (const biome in allFishData) {
            for (const fishName in allFishData[biome]) {
                fishNames.add(fishName);
            }
        }
        fishNames.forEach(name => {
            pathsToLoad[`fish___${name}`] = `img/fish/${name}.png`;
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
                
                if (walkingParticleImagePaths[key]) {
                    walkingparticles.particleImages[key] = img;
                } else if (starImagePaths[key]) {
                    starImages[key] = img;
                } else if (key.startsWith('skin___')) {
                    const [, suffix, partKey] = key.split('___');
                    const tone = SKIN_TONES.find(t => (t.suffix || 'default') === suffix);
                    if (tone) {
                        tone.images[partKey] = img;
                    }
                } else if (key.includes('___')) {
                    const [category, itemName] = key.split('___');
                    if (category === 'fish') {
                        allItemImages[itemName] = img;
                    } else if (characterCustomImages[category]) {
                        characterCustomImages[category][itemName] = img;
                    }
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
    
    function createTintedSprite(image, saturation = 100, hue = 0, brightness = 100) {
        if (!image || !image.complete) return null;
        if (saturation === 100 && hue === 0 && brightness === 100) return image;

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const filters = [];
        if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
        if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
        if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
        if (filters.length > 0) ctx.filter = filters.join(' ');
        
        ctx.drawImage(image, 0, 0);
        return canvas;
    }

    function drawCharacter(ctx, p) {
        const customizations = p.customizations || {};
        
        let imageSet = SKIN_TONES[0].images; 
        if (customizations.skin) {
            const selectedSkin = SKIN_TONES.find(tone => tone.name === customizations.skin);
            if (selectedSkin && selectedSkin.images.body) {
                imageSet = selectedSkin.images;
            }
        }

        if (!imageSet.body || !imageSet.body.complete) return;
        
        ctx.save();
        
        let bodyPulseY = 0, arm1Rotation = 0, arm2Rotation = 0, leg1Rotation = 0, leg2Rotation = 0, headRotation = 0, headPulseY = 0, bodyTilt = 0;
        
        if (p.isWalking) {
            const animRatio = (Number(p.animationFrame || 0) % animationCycleLength) / animationCycleLength;
            const sinWave = Math.sin(2 * animRatio * Math.PI);
            bodyPulseY = -bodyHeadPulseAmount * Math.abs(sinWave);
            arm1Rotation = sinWave * armRotationAngle;
            arm2Rotation = -arm1Rotation;
            leg1Rotation = sinWave * legRotationAngle;
            leg2Rotation = -leg1Rotation;
            headRotation = sinWave * headRotationAngleAmount;
            headPulseY = Math.sin(4 * animRatio * Math.PI) * bodyHeadPulseAmount * headOscillationAmplitudeFactor;
        } else if (p.isIdle) {
            const animRatio = (Number(p.idleAnimationFrame || 0) % IDLE_ANIM_CYCLE_LENGTH) / IDLE_ANIM_CYCLE_LENGTH;
            const sinWave = Math.sin(2 * animRatio * Math.PI);
            bodyPulseY = -IDLE_BODY_HEAD_PULSE_AMOUNT * Math.abs(sinWave);
            arm1Rotation = sinWave * IDLE_ARM_ROTATION_ANGLE;
            arm2Rotation = -arm1Rotation;
            headRotation = sinWave * IDLE_HEAD_ROTATION_ANGLE_AMOUNT;
            headPulseY = Math.sin(4 * animRatio * Math.PI) * IDLE_BODY_HEAD_PULSE_AMOUNT * IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR;
        } else if (p.isJumping) {
            const maxVelocity = 54;
            const progress = 1 - Math.min(1, Math.max(0, Math.abs(p.velocityY) / maxVelocity));
            bodyTilt = JUMP_BODY_TILT_ANGLE * progress;
            leg2Rotation = -progress * JUMP_LEG_OPPOSITE_ROTATION_ANGLE;
            leg1Rotation = progress * JUMP_LEG_WAVE_ANGLE;
            arm1Rotation = progress * JUMP_ARM_WAVE_ANGLE;
            arm2Rotation = -0.7 * arm1Rotation;
            headRotation = 0.5 * bodyTilt;
        }

        ctx.translate(p.x + playerSize / 2, p.y + playerSize / 2);
        ctx.scale(p.direction, 1);
        if (p.isJumping) ctx.rotate(bodyTilt * p.direction);
        ctx.translate(-(p.x + playerSize / 2), -(p.y + playerSize / 2));
        
        const drawPart = (img, x, y, pivotX, pivotY, rotation, w = playerSize, h = playerSize) => {
            if (!img) return;
            ctx.save();
            ctx.translate(p.x + x + pivotX, p.y + y + pivotY);
            ctx.rotate(rotation);
            ctx.drawImage(img, -pivotX, -pivotY, w, h);
            ctx.restore();
        };

        const rightHandItem = customizations.rightHandItem;
        if (rightHandItem === ITEM_ROD) {
            const ROD_TIP_OFFSET_X = playerSize * 1.07;
            const ROD_TIP_OFFSET_Y = -playerSize * 0.32;
            p.rodTipWorldX = p.x + playerSize / 2 + (frontArmOffsetX + originalArmPivotInImageX - playerSize / 2) * p.direction + (ROD_TIP_OFFSET_X * Math.cos(arm1Rotation) - ROD_TIP_OFFSET_Y * Math.sin(arm1Rotation)) * p.direction;
            p.rodTipWorldY = p.y + playerSize / 2 + (originalArmPivotInImageY - playerSize / 2) + (ROD_TIP_OFFSET_X * Math.sin(arm1Rotation) + ROD_TIP_OFFSET_Y * Math.cos(arm1Rotation));
        }

        drawPart(imageSet.leg, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg2Rotation);
        if (customizations.shoes && customizations.shoes !== 'none') drawPart(characterCustomImages.shoes[customizations.shoes], backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg2Rotation);
        if (customizations.pants && customizations.pants !== 'none') drawPart(characterCustomImages.pants_leg[customizations.pants], backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg2Rotation);
        
        drawPart(imageSet.arm, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm2Rotation);
        if (customizations.clothes && customizations.clothes !== 'none') drawPart(characterCustomImages.clothes_arm[customizations.clothes], backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm2Rotation);

        drawPart(imageSet.leg, frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg1Rotation);
        if (customizations.shoes && customizations.shoes !== 'none') drawPart(characterCustomImages.shoes[customizations.shoes], frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg1Rotation);
        if (customizations.pants && customizations.pants !== 'none') drawPart(characterCustomImages.pants_leg[customizations.pants], frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, leg1Rotation);

        ctx.drawImage(imageSet.body, p.x, p.y + bodyPulseY, playerSize, playerSize);
        if (customizations.pants && customizations.pants !== 'none') ctx.drawImage(characterCustomImages.pants[customizations.pants], p.x, p.y + bodyPulseY, playerSize, playerSize);
        if (customizations.clothes && customizations.clothes !== 'none') ctx.drawImage(characterCustomImages.clothes[customizations.clothes], p.x, p.y + bodyPulseY, playerSize, playerSize);
        
        const headOffsetY = headInitialOffsetY + bodyPulseY + headPulseY;
        drawPart(imageSet.head, 0, headOffsetY, headPivotInImageX, headPivotInImageY, headRotation);
        drawPart(imageSet.eye, LEFT_EYE_BASE_X_REL_HEAD_TL, headOffsetY + EYE_BASE_Y_REL_HEAD_TL, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);
        drawPart(imageSet.eye, RIGHT_EYE_BASE_X_REL_HEAD_TL, headOffsetY + EYE_BASE_Y_REL_HEAD_TL, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);

        if (customizations.accessories && customizations.accessories !== 'none') {
             ctx.save();
             ctx.translate(p.x + headPivotInImageX, p.y + headOffsetY + headPivotInImageY);
             ctx.rotate(headRotation);
             ctx.drawImage(characterCustomImages.accessories[customizations.accessories], -headPivotInImageX, -headPivotInImageY, playerSize, playerSize);
             ctx.restore();
        }
        
        if (customizations.beard && customizations.beard !== 'none' && customizations.tintedBeard) {
             ctx.save();
             ctx.translate(p.x + headPivotInImageX, p.y + headOffsetY + headPivotInImageY);
             ctx.rotate(headRotation);
             ctx.drawImage(customizations.tintedBeard, -headPivotInImageX, -(headPivotInImageY - BEARD_VERTICAL_OFFSET), playerSize, playerSize);
             ctx.restore();
        }
        if (customizations.hair && customizations.hair !== 'none' && customizations.tintedHair) {
            ctx.save();
            ctx.translate(p.x + headPivotInImageX, p.y + headOffsetY + headPivotInImageY);
            ctx.rotate(headRotation);
            ctx.drawImage(customizations.tintedHair, -headPivotInImageX, -(headPivotInImageY - HAIR_VERTICAL_OFFSET), playerSize, playerSize);
            ctx.restore();
        }

        if (customizations.hat && customizations.hat !== 'none') {
             drawPart(characterCustomImages.hat[customizations.hat], 0, headOffsetY - Math.round(20 * (playerSize / 32)) + 44, headPivotInImageX, headPivotInImageY - 44 - -Math.round(20 * (playerSize / 32)), headRotation, playerSize, playerSize)
        }
        
        if (rightHandItem && rightHandItem !== ITEM_NONE) {
            const itemData = exampleCustomItemPaths.items[rightHandItem];
            const itemImage = characterCustomImages.items[rightHandItem];
            if (itemData && itemImage) drawPart(itemImage, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm1Rotation, itemData.width, itemData.height);
        }
        drawPart(imageSet.arm, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm1Rotation);
        if (customizations.clothes && customizations.clothes !== 'none') drawPart(characterCustomImages.clothes_arm[customizations.clothes], frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, arm1Rotation);

        ctx.restore();

        if (p.username && p !== menuPlayer) {
            ctx.font = `${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`;
            const usernameText = p.username;
            const usernameMetrics = ctx.measureText(usernameText);
            const usernameWidth = usernameMetrics.width;
            
            const flagWidth = 24;
            const flagHeight = 18;
            const flagPadding = 5;
            
            const totalWidth = usernameWidth + flagPadding + flagWidth;
            const playerCenterX = p.x + playerSize / 2;
            
            const startX = playerCenterX - totalWidth / 2;
            const usernameY = p.y - 14 + bodyPulseY;

            if (p.selectedFlag) {
                let flagImg = flagImageCache[p.selectedFlag];
                if (!flagImg) {
                    flagImg = new Image();
                    flagImg.src = `https://flagcdn.com/160x120/${p.selectedFlag.toLowerCase()}.png`;
                    flagImageCache[p.selectedFlag] = flagImg;
                }
                if (flagImg.complete && flagImg.naturalWidth > 0) {
                    const flagY = usernameY - flagHeight / 2 - 5;
                    ctx.drawImage(flagImg, startX, flagY, flagWidth, flagHeight);
                }
            }
            
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3; 
            ctx.fillStyle = "white";
            ctx.textAlign = "left";
            const textX = startX + flagWidth + flagPadding;
            ctx.strokeText(usernameText, textX, usernameY); 
            ctx.fillText(usernameText, textX, usernameY);
        }
    }
    
    function drawMenuFishingLine(ctx, p) {
        if (!p.hasLineCast || !p.rodTipWorldX || !p.floatWorldX) return;

        const floatImage = characterCustomImages.items.float;
        if (!floatImage || !floatImage.complete) return;

        const verticalOffset = Math.sin(bobberAnimationTime + p.x) * BOBBER_VERTICAL_OSCILLATION;
        const bobberAnimatedY = p.floatWorldY + verticalOffset;

        ctx.strokeStyle = '#ffffff77';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
        ctx.lineTo(p.floatWorldX, bobberAnimatedY);
        ctx.stroke();

        ctx.drawImage(floatImage, p.floatWorldX - FLOAT_SIZE / 2, bobberAnimatedY - FLOAT_SIZE - 8, FLOAT_SIZE, FLOAT_SIZE * 2);
    }

    function drawMenuFishingLines(ctx) {
        puppetManager.puppets.forEach(p => {
            if (p.hasLineCast) {
                drawMenuFishingLine(ctx, p);
            }
        });
    }

    function drawInsects() { const insectImage = biomeManager.getCurrentInsectImage(); if (!insectImage || !insectImage.complete) return; const renderedSize = 32 * 2.6; for (const insect of insectsInRoom) { const currentFrame = Math.floor((insect.animationFrame || 0) / 8); const sourceX = currentFrame * 32; const sourceY = (insect.typeIndex || 0) * 32; const angleInRadians = (insect.angle || 0) * (Math.PI / 180); menuCtx.save(); menuCtx.translate(insect.x + renderedSize / 2, insect.y + renderedSize / 2); menuCtx.rotate(angleInRadians); if (typeof insect.hue === 'number') { menuCtx.filter = `hue-rotate(${insect.hue}deg)`; } menuCtx.drawImage(insectImage, sourceX, sourceY, 32, 32, -renderedSize / 2, -renderedSize / 2, renderedSize, renderedSize); menuCtx.restore(); } }
    
    function update(deltaTime) {
        if (!areAllImagesReady) return;
        
        const lobbyDiv = document.getElementById('lobby');
        if (!lobbyDiv || lobbyDiv.style.display === 'none') return;

        let targetVelocityX = 0; if (keys['ArrowLeft'] || keys['KeyA']) { targetVelocityX = -PLAYER_WALK_SPEED; menuPlayer.direction = -1; } else if (keys['ArrowRight'] || keys['KeyD']) { targetVelocityX = PLAYER_WALK_SPEED; menuPlayer.direction = 1; }
        menuPlayer.velocityX = targetVelocityX !== 0 ? targetVelocityX : menuPlayer.velocityX * DECELERATION_FACTOR; if (Math.abs(menuPlayer.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) { menuPlayer.velocityX = 0; }
        menuPlayer.x += menuPlayer.velocityX; menuPlayer.x = Math.max(0, Math.min(currentWorldWidth - playerSize, menuPlayer.x));
        
        const groundY = DEDICATED_GAME_HEIGHT - groundLevel;
        const isPlayerCurrentlyOnGround = menuPlayer.y + playerSize >= groundY - 1;
        
        menuPlayer.isWalking = Math.abs(menuPlayer.velocityX) > MIN_VELOCITY_FOR_WALK_ANIMATION && isPlayerCurrentlyOnGround; 
        menuPlayer.isIdle = !menuPlayer.isWalking && isPlayerCurrentlyOnGround;

        if (isPlayerCurrentlyOnGround && !wasPlayerOnGround) {
            const playerFeetX = menuPlayer.x + playerSize / 2;
            const playerFeetY = menuPlayer.y + playerSize;
            for (let i = 0; i < 8; i++) {
                walkingparticles.spawn(playerFeetX, playerFeetY, Math.random() > 0.5);
            }
        }
        if (menuPlayer.isWalking) {
            walkParticleTimer -= deltaTime;
            if (walkParticleTimer <= 0) {
                walkParticleTimer = 0.06;
                const playerFeetX = menuPlayer.x + playerSize / 2;
                const playerFeetY = menuPlayer.y + playerSize;
                walkingparticles.spawn(playerFeetX, playerFeetY, Math.random() > 0.7);
            }
        }
        wasPlayerOnGround = isPlayerCurrentlyOnGround;
        
        if (menuPlayer.isWalking) { const speedFactor = Math.abs(menuPlayer.velocityX / PLAYER_WALK_SPEED); menuPlayer.animationFrame = (menuPlayer.animationFrame + (1.6 * speedFactor)) % animationCycleLength; menuPlayer.idleAnimationFrame = 0; } else { menuPlayer.animationFrame = 0; menuPlayer.idleAnimationFrame = (menuPlayer.idleAnimationFrame + 1) % IDLE_ANIM_CYCLE_LENGTH; }
        
        insectsInRoom.forEach(insect => { const time = (Date.now() / 1000) + (insect.timeOffset || 0); insect.anchorX += (insect.drift || 0); if (insect.anchorX < 0 || insect.anchorX > currentWorldWidth) insect.drift *= -1; insect.x = (insect.anchorX || 0) + Math.sin(time * (insect.hSpeed || 1)) * (insect.hAmp || 100); insect.y = (insect.baseY || 500) + Math.cos(time * (insect.vSpeed || 1)) * (insect.vAmp || 80); insect.angle = Math.cos(time * (insect.hSpeed || 1)) * (insect.hAmp || 100) * (insect.hSpeed || 1) * 0.5; insect.animationFrame = ((insect.animationFrame || 0) + 1) % 16; });
        const playerHitbox = { x: menuPlayer.x + playerSize * 0.25, y: menuPlayer.y + playerSize * 0.8, width: playerSize * 0.5, height: playerSize * 0.2 }; const allPlants = [...biomeManager.backgroundGroundPlants, ...biomeManager.foregroundGroundPlants]; allPlants.forEach(grass => { if (grass.swaying && Date.now() - grass.swayStartTime > 1800) grass.swaying = false; if (!grass.swaying && menuPlayer.velocityX !== 0) { const grassHitbox = { x: grass.x, y: grass.y - 20, width: (32*3.8) / 2, height: 20 }; if (playerHitbox.x < grassHitbox.x + grassHitbox.width && playerHitbox.x + playerHitbox.width > grassHitbox.x) { biomeManager.startSwayAnimation(grass.id, menuPlayer.direction); grass.swayStartTime = Date.now(); } } });

        const playerWorldCenterX = menuPlayer.x + playerSize / 2;
        const visibleWorldWidth = menuCanvas.width / ZOOM_LEVEL;
        let targetCameraX = playerWorldCenterX - visibleWorldWidth / 2;
        targetCameraX = Math.max(0, Math.min(currentWorldWidth - visibleWorldWidth, targetCameraX));
        cameraX = (1 - CAMERA_SMOOTHING_FACTOR) * cameraX + CAMERA_SMOOTHING_FACTOR * targetCameraX;

        const visibleWorldHeight = menuCanvas.height / ZOOM_LEVEL;
        const WATER_VIEW_DEPTH = 40;
        const viewBottomEdgeY = biomeManager.WATER_TOP_Y_WORLD + WATER_VIEW_DEPTH;
        cameraY = viewBottomEdgeY - visibleWorldHeight;

        cycleManager.update(deltaTime);
        starManager.update(deltaTime);
        cloudManager.update(deltaTime);
        biomeManager.updateAnimations(deltaTime, menuPlayer, groundLevel, cameraX, menuCanvas.width);
        walkingparticles.update(deltaTime);
        
        bobberAnimationTime += BOBBER_ANIMATION_SPEED;
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
        
        menuCtx.translate(-cameraX, -cameraY);
        
        cloudManager.draw(menuCtx);
        biomeManager.drawParallaxBackground(menuCtx, cameraX, 0, menuCanvas.width / ZOOM_LEVEL);
        biomeManager.drawBackgroundBiomeGround(menuCtx, chosenBiome, groundLevel);
        biomeManager.drawBackgroundTrees(menuCtx);
        biomeManager.drawBackgroundPlants(menuCtx);
        
        walkingparticles.draw(menuCtx, 'behind');
        
        puppetManager.draw(menuCtx);
        
        walkingparticles.draw(menuCtx, 'front');

        biomeManager.drawForegroundPlants(menuCtx);
        biomeManager.drawForegroundTrees(menuCtx);
        
        drawInsects();
                
        biomeManager.drawForegroundBiomeGround(menuCtx, chosenBiome, groundLevel);
        
        biomeManager.drawSwimmingFish(menuCtx);
        
        biomeManager.drawWater(menuCtx, chosenBiome, cameraX);

        drawMenuFishingLines(menuCtx);
        
        menuCtx.restore();
        
        biomeManager.drawFrontLayer(menuCtx, cameraX, menuCanvas.width, ZOOM_LEVEL, ZOOM_LEVEL, ZOOM_LEVEL);
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
    document.addEventListener('keydown', (event) => { 
        if(document.getElementById('lobby').style.display !== 'none') {
            keys[event.code] = true; 
        }
    });
    document.addEventListener('keyup', (event) => { 
        if(document.getElementById('lobby').style.display !== 'none') {
            delete keys[event.code]; 
        }
    });
    menuCanvas.addEventListener('mousemove', (event) => {
        const rect = menuCanvas.getBoundingClientRect();
        const mouseX_on_canvas = (event.clientX - rect.left) * (menuCanvas.width / rect.width);
        const mouseY_on_canvas = (event.clientY - rect.top) * (menuCanvas.height / rect.height);
        menuPlayer.currentMouseX = mouseX_on_canvas / ZOOM_LEVEL + cameraX;
        menuPlayer.currentMouseY = mouseY_on_canvas / ZOOM_LEVEL + cameraY;
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
                loadDataAndImages(progressCallback, completionCallback);
            },
            () => {
                console.log("[MenuWorld] Wszystkie zasoby załadowane. Finalizuję setup.");
                areAllImagesReady = true;

                puppetManager.createPuppets();

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