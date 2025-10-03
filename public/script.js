'use strict';

// ====================================================================
// === SEKCJA 0: NOWY SYSTEM POWIADOMIEŃ ===
// ====================================================================

/**
 * Konfiguruje kontener na powiadomienia i dodaje niezbędne style CSS.
 * Ta funkcja jest wywoływana raz, na dole skryptu.
 */
function setupNotificationArea() {
    // Stwórz kontener na powiadomienia
    const container = document.createElement('div');
    container.id = 'notification-container';
    document.body.appendChild(container);

    // Dodaj style CSS do head
    const style = document.createElement('style');
    style.innerHTML = `
        #notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px; /* Zmniejszony odstęp między powiadomieniami */
        }
        .notification {
            padding: 6px 8px; /* Zmniejszony padding */
            border-radius: 3px; /* Lekko zmniejszone zaokrąglenie */
            color: #fff;
            font-family: 'Segoe UI', sans-serif;
            font-size: 10px; /* Zmniejszony rozmiar czcionki */
            opacity: 0;
            transform: translateX(100%);
            animation: slideIn 0.5s forwards, fadeOut 0.5s 4.5s forwards;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15); /* Subtelniejszy cień */
        }
        .notification.success { background-color: #28a745; }
        .notification.warning { background-color: #ffc107; color: #333; }
        .notification.error { background-color: #dc3545; }

        @keyframes slideIn {
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        @keyframes fadeOut {
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Wyświetla powiadomienie w prawym górnym rogu.
 * @param {string} message - Wiadomość do wyświetlenia.
 * @param {'success'|'warning'|'error'} type - Typ powiadomienia (success, warning, error).
 * @param {number} [duration=5000] - Czas wyświetlania w milisekundach.
 */
function showNotification(message, type = 'warning', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        // Pozwól animacji fadeOut się zakończyć przed usunięciem
        setTimeout(() => notification.remove(), 500);
    }, duration - 500);
}


// ====================================================================
// === SEKCJA 1: ZMIENNE SIECIOWE P2P i STANU GRY ===
// ====================================================================

let signalingSocket;
let peer;
let isHost = false;
let hostConnection;

let hostPingTimeout = null; // Interwał sprawdzający, czy host żyje
const HOST_TIMEOUT_LIMIT = 15000; // 15 sekund - limit dla gościa
let lastPingTime = 0; // Czas ostatniego pingu od hosta
let isPlayerInCampZone = false;
let showCampPrompt = false;
let timedTutorialsQueue = []; // <-- DODAJ TĘ LINIĘ

let gameHostWorker = null;
let hostPeerConnections = {};

let availableRooms = {};
let worldItems = [];
let hostRoomConfiguration = null;
let invX = 0, invY = 0;
let splashCreatedForPlayers = new Set();
let closestNpc = null; // <--- DODAJ TĘ LINIĘ

const tutorial = {
    state: 1, 
    activeImage: { key: 'info1', alpha: 1, yOffset: 0, startTime: Date.now() },
    fadingOutImage: null,
};

const TUTORIAL_IMAGE_SCALE = 2.4;
const TUTORIAL_Y_OFFSET = -28;
const TUTORIAL_ROCKING_ANGLE_DEGREES = 10;
const TUTORIAL_ROCKING_SPEED = 4;
const TUTORIAL_FADE_DURATION_MS = 600; 
const TUTORIAL_FADE_UP_DISTANCE = 250;

const tutorialImagePaths = {
    info1: 'img/ui/info1.png',
    info2: 'img/ui/info2.png',
    info3: 'img/ui/info3.png',
    info4: 'img/ui/info4.png',
    info5: 'img/ui/info5.png',
    info6: 'img/ui/info6.png',
    info7: 'img/ui/info7.png', // <-- DODANA LINIA
    info8: 'img/ui/info8.png'  // <-- DODANA LINIA
};
const tutorialImages = {};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cycleOverlay = document.getElementById('cycleOverlay');

const DEDICATED_GAME_WIDTH = 1920;
const DEDICATED_GAME_HEIGHT = 1080;


let currentWorldWidth = DEDICATED_GAME_WIDTH * 2;

canvas.width = DEDICATED_GAME_WIDTH;
canvas.height = DEDICATED_GAME_HEIGHT;
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.imageSmoothingEnabled = false;

const biomeManager = new BiomeManager(currentWorldWidth, DEDICATED_GAME_HEIGHT);
const cycleManager = new CycleManager();

// ====================================================================
// === SEKCJA GWIAZD: Nowa klasa do zarządzania gwiazdami na nocnym niebie ===
// ====================================================================

const starImagePaths = {
    star1: 'img/world/star.png',
    star2: 'img/world/star2.png',
    common_star: 'img/ui/common_star.png',
    uncommon_star: 'img/ui/uncommon_star.png',
    rare_star: 'img/ui/rare_star.png',
    epic_star: 'img/ui/epic_star.png',
    legendary_star: 'img/ui/legendary_star.png'
};
const starImages = {};

class StarManager {
    constructor() {
        this.stars = [];
        this.areAssetsLoaded = false;
    }

    initialize(width, height) {
        this.stars = [];
        if (!this.areAssetsLoaded) return;
        const STAR_COUNT = 1350;
        const skyHeight = height * 0.65;

        for (let i = 0; i < STAR_COUNT; i++) {
            const starTypeKey = Math.random() < 0.7 ? 'star1' : 'star2';
            const starImg = starImages[starTypeKey];
            const pulses = Math.random() < 0.3;

            this.stars.push({
                img: starImg,
                x: Math.random() * width,
                y: Math.random() * skyHeight,
                size: Math.random() * 6.5 + 2.5,
                baseAlpha: Math.random() * 0.5 + 0.3,
                currentAlpha: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.7) * 0.01,
                pulses: pulses,
                pulseTimer: Math.random() * 2 + 0.4,
            });
        }
        this.stars.forEach(s => s.currentAlpha = s.baseAlpha);
        console.log(`Initialized ${this.stars.length} stars.`);
    }

    update(deltaTime) {
        if (!this.areAssetsLoaded) return;
        this.stars.forEach(star => {
            star.rotation += star.rotationSpeed;
            if (star.currentAlpha > star.baseAlpha) {
                star.currentAlpha -= 0.05;
                if (star.currentAlpha < star.baseAlpha) {
                    star.currentAlpha = star.baseAlpha;
                }
            }
            if (star.pulses) {
                star.pulseTimer -= deltaTime;
                if (star.pulseTimer <= 0) {
                    star.pulseTimer = 0.2 + Math.random() * 2;
                    star.currentAlpha = star.baseAlpha + 0.5;
                }
            }
        });
    }

    draw(ctx, cycleManager) {
        if (!this.areAssetsLoaded || this.stars.length === 0) return;
        const rotationDegrees = (cycleManager.rotation * (180 / Math.PI)) % 360;
        const angle = rotationDegrees < 0 ? rotationDegrees + 360 : rotationDegrees;
        let nightAlpha = 0;
        const FADE_IN_START = 85, FADE_IN_END = 135, FADE_OUT_START = 240, FADE_OUT_END = 270;
        if (angle > FADE_IN_START && angle < FADE_IN_END) {
            nightAlpha = (angle - FADE_IN_START) / (FADE_IN_END - FADE_IN_START);
        } else if (angle >= FADE_IN_END && angle <= FADE_OUT_START) {
            nightAlpha = 1;
        } else if (angle > FADE_OUT_START && angle < FADE_OUT_END) {
            nightAlpha = 1 - ((angle - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START));
        }
        if (nightAlpha <= 0.01) return;
        this.stars.forEach(star => {
            if (!star.img || !star.img.complete) return;
            ctx.save();
            ctx.globalAlpha = star.currentAlpha * nightAlpha;
            ctx.translate(star.x + star.size / 2, star.y + star.size / 2);
            ctx.rotate(star.rotation);
            ctx.drawImage(star.img, -star.size / 2, -star.size / 2, star.size, star.size);
            ctx.restore();
        });
    }
}

const starManager = new StarManager();
const flagImageCache = {}; // <-- NOWA ZMIENNA
let isFlagListOpen = false; // <-- NOWA ZMIENNA

// UWAGA: To jest skrócona lista dla przykładu. Możesz ją rozszerzyć o wszystkie 254 kody krajów.
const COUNTRIES = [
    { code: 'af', name: 'Afghanistan' },
    { code: 'ax', name: 'Åland Islands' },
    { code: 'al', name: 'Albania' },
    { code: 'dz', name: 'Algeria' },
    { code: 'as', name: 'American Samoa' },
    { code: 'ad', name: 'Andorra' },
    { code: 'ao', name: 'Angola' },
    { code: 'ai', name: 'Anguilla' },
    { code: 'ag', name: 'Antigua and Barbuda' },
    { code: 'ar', name: 'Argentina' },
    { code: 'am', name: 'Armenia' },
    { code: 'aw', name: 'Aruba' },
    { code: 'au', name: 'Australia' },
    { code: 'at', name: 'Austria' },
    { code: 'az', name: 'Azerbaijan' },
    { code: 'bs', name: 'Bahamas' },
    { code: 'bh', name: 'Bahrain' },
    { code: 'bd', name: 'Bangladesh' },
    { code: 'bb', name: 'Barbados' },
    { code: 'by', name: 'Belarus' },
    { code: 'be', name: 'Belgium' },
    { code: 'bz', name: 'Belize' },
    { code: 'bj', name: 'Benin' },
    { code: 'bm', name: 'Bermuda' },
    { code: 'bt', name: 'Bhutan' },
    { code: 'bo', name: 'Bolivia' },
    { code: 'bq', name: 'Bonaire' },
    { code: 'ba', name: 'Bosnia and Herzegovina' },
    { code: 'bw', name: 'Botswana' },
    { code: 'br', name: 'Brazil' },
    { code: 'bn', name: 'Brunei Darussalam' },
    { code: 'bg', name: 'Bulgaria' },
    { code: 'bf', name: 'Burkina Faso' },
    { code: 'bi', name: 'Burundi' },
    { code: 'cv', name: 'Cabo Verde' },
    { code: 'kh', name: 'Cambodia' },
    { code: 'cm', name: 'Cameroon' },
    { code: 'ca', name: 'Canada' },
    { code: 'ky', name: 'Cayman Islands' },
    { code: 'cf', name: 'Central African Republic' },
    { code: 'td', name: 'Chad' },
    { code: 'cl', name: 'Chile' },
    { code: 'cn', name: 'China' },
    { code: 'cx', name: 'Christmas Island' },
    { code: 'cc', name: 'Cocos (Keeling) Islands' },
    { code: 'co', name: 'Colombia' },
    { code: 'km', name: 'Comoros' },
    { code: 'cg', name: 'Congo' },
    { code: 'cd', name: 'Congo (DRC)' },
    { code: 'ck', name: 'Cook Islands' },
    { code: 'cr', name: 'Costa Rica' },
    { code: 'ci', name: 'Côte d\'Ivoire' },
    { code: 'hr', name: 'Croatia' },
    { code: 'cu', name: 'Cuba' },
    { code: 'cw', name: 'Curaçao' },
    { code: 'cy', name: 'Cyprus' },
    { code: 'cz', name: 'Czechia' },
    { code: 'dk', name: 'Denmark' },
    { code: 'dj', name: 'Djibouti' },
    { code: 'dm', name: 'Dominica' },
    { code: 'do', name: 'Dominican Republic' },
    { code: 'ec', name: 'Ecuador' },
    { code: 'eg', name: 'Egypt' },
    { code: 'sv', name: 'El Salvador' },
    { code: 'gq', name: 'Equatorial Guinea' },
    { code: 'er', name: 'Eritrea' },
    { code: 'ee', name: 'Estonia' },
    { code: 'sz', name: 'Eswatini' },
    { code: 'et', name: 'Ethiopia' },
    { code: 'fk', name: 'Falkland Islands' },
    { code: 'fo', name: 'Faroe Islands' },
    { code: 'fj', name: 'Fiji' },
    { code: 'fi', name: 'Finland' },
    { code: 'fr', name: 'France' },
    { code: 'gf', name: 'French Guiana' },
    { code: 'pf', name: 'French Polynesia' },
    { code: 'ga', name: 'Gabon' },
    { code: 'gm', name: 'Gambia' },
    { code: 'ge', name: 'Georgia' },
    { code: 'de', name: 'Germany' },
    { code: 'gh', name: 'Ghana' },
    { code: 'gi', name: 'Gibraltar' },
    { code: 'gr', name: 'Greece' },
    { code: 'gl', name: 'Greenland' },
    { code: 'gd', name: 'Grenada' },
    { code: 'gp', name: 'Guadeloupe' },
    { code: 'gu', name: 'Guam' },
    { code: 'gt', name: 'Guatemala' },
    { code: 'gg', name: 'Guernsey' },
    { code: 'gn', name: 'Guinea' },
    { code: 'gw', name: 'Guinea-Bissau' },
    { code: 'gy', name: 'Guyana' },
    { code: 'ht', name: 'Haiti' },
    { code: 'va', name: 'Holy See' },
    { code: 'hn', name: 'Honduras' },
    { code: 'hk', name: 'Hong Kong' },
    { code: 'hu', name: 'Hungary' },
    { code: 'is', name: 'Iceland' },
    { code: 'in', name: 'India' },
    { code: 'id', name: 'Indonesia' },
    { code: 'ir', name: 'Iran' },
    { code: 'iq', name: 'Iraq' },
    { code: 'ie', name: 'Ireland' },
    { code: 'im', name: 'Isle of Man' },
    { code: 'il', name: 'Israel' },
    { code: 'it', name: 'Italy' },
    { code: 'jm', name: 'Jamaica' },
    { code: 'jp', name: 'Japan' },
    { code: 'je', name: 'Jersey' },
    { code: 'jo', name: 'Jordan' },
    { code: 'kz', name: 'Kazakhstan' },
    { code: 'ke', name: 'Kenya' },
    { code: 'ki', name: 'Kiribati' },
    { code: 'kp', name: 'North Korea' },
    { code: 'kr', name: 'South Korea' },
    { code: 'kw', name: 'Kuwait' },
    { code: 'kg', name: 'Kyrgyzstan' },
    { code: 'la', name: 'Laos' },
    { code: 'lv', name: 'Latvia' },
    { code: 'lb', name: 'Lebanon' },
    { code: 'ls', name: 'Lesotho' },
    { code: 'lr', name: 'Liberia' },
    { code: 'ly', name: 'Libya' },
    { code: 'li', name: 'Liechtenstein' },
    { code: 'lt', name: 'Lithuania' },
    { code: 'lu', name: 'Luxembourg' },
    { code: 'mo', name: 'Macao' },
    { code: 'mg', name: 'Madagascar' },
    { code: 'mw', name: 'Malawi' },
    { code: 'my', name: 'Malaysia' },
    { code: 'mv', name: 'Maldives' },
    { code: 'ml', name: 'Mali' },
    { code: 'mt', name: 'Malta' },
    { code: 'mh', name: 'Marshall Islands' },
    { code: 'mq', name: 'Martinique' },
    { code: 'mr', name: 'Mauritania' },
    { code: 'mu', name: 'Mauritius' },
    { code: 'yt', name: 'Mayotte' },
    { code: 'mx', name: 'Mexico' },
    { code: 'fm', name: 'Micronesia' },
    { code: 'md', name: 'Moldova' },
    { code: 'mc', name: 'Monaco' },
    { code: 'mn', name: 'Mongolia' },
    { code: 'me', name: 'Montenegro' },
    { code: 'ms', name: 'Montserrat' },
    { code: 'ma', name: 'Morocco' },
    { code: 'mz', name: 'Mozambique' },
    { code: 'mm', name: 'Myanmar' },
    { code: 'na', name: 'Namibia' },
    { code: 'nr', name: 'Nauru' },
    { code: 'np', name: 'Nepal' },
    { code: 'nl', name: 'Netherlands' },
    { code: 'nc', name: 'New Caledonia' },
    { code: 'nz', name: 'New Zealand' },
    { code: 'ni', name: 'Nicaragua' },
    { code: 'ne', name: 'Niger' },
    { code: 'ng', name: 'Nigeria' },
    { code: 'nu', name: 'Niue' },
    { code: 'nf', name: 'Norfolk Island' },
    { code: 'mk', name: 'North Macedonia' },
    { code: 'mp', name: 'Northern Mariana Islands' },
    { code: 'no', name: 'Norway' },
    { code: 'om', name: 'Oman' },
    { code: 'pk', name: 'Pakistan' },
    { code: 'pw', name: 'Palau' },
    { code: 'ps', name: 'Palestine' },
    { code: 'pa', name: 'Panama' },
    { code: 'pg', name: 'Papua New Guinea' },
    { code: 'py', name: 'Paraguay' },
    { code: 'pe', name: 'Peru' },
    { code: 'ph', name: 'Philippines' },
    { code: 'pl', name: 'Poland' },
    { code: 'pt', name: 'Portugal' },
    { code: 'pr', name: 'Puerto Rico' },
    { code: 'qa', name: 'Qatar' },
    { code: 're', name: 'Réunion' },
    { code: 'ro', name: 'Romania' },
    { code: 'ru', name: 'Russia' },
    { code: 'rw', name: 'Rwanda' },
    { code: 'bl', name: 'Saint Barthélemy' },
    { code: 'sh', name: 'Saint Helena' },
    { code: 'kn', name: 'Saint Kitts and Nevis' },
    { code: 'lc', name: 'Saint Lucia' },
    { code: 'mf', name: 'Saint Martin' },
    { code: 'pm', name: 'Saint Pierre and Miquelon' },
    { code: 'vc', name: 'Saint Vincent and the Grenadines' },
    { code: 'ws', name: 'Samoa' },
    { code: 'sm', name: 'San Marino' },
    { code: 'st', name: 'Sao Tome and Principe' },
    { code: 'sa', name: 'Saudi Arabia' },
    { code: 'sn', name: 'Senegal' },
    { code: 'rs', name: 'Serbia' },
    { code: 'sc', name: 'Seychelles' },
    { code: 'sl', name: 'Sierra Leone' },
    { code: 'sg', name: 'Singapore' },
    { code: 'sx', name: 'Sint Maarten' },
    { code: 'sk', name: 'Slovakia' },
    { code: 'si', name: 'Slovenia' },
    { code: 'sb', name: 'Solomon Islands' },
    { code: 'so', name: 'Somalia' },
    { code: 'za', name: 'South Africa' },
    { code: 'ss', name: 'South Sudan' },
    { code: 'es', name: 'Spain' },
    { code: 'lk', name: 'Sri Lanka' },
    { code: 'sd', name: 'Sudan' },
    { code: 'sr', name: 'Suriname' },
    { code: 'se', name: 'Sweden' },
    { code: 'ch', name: 'Switzerland' },
    { code: 'sy', name: 'Syria' },
    { code: 'tw', name: 'Taiwan' },
    { code: 'tj', name: 'Tajikistan' },
    { code: 'tz', name: 'Tanzania' },
    { code: 'th', name: 'Thailand' },
    { code: 'tl', name: 'Timor-Leste' },
    { code: 'tg', name: 'Togo' },
    { code: 'tk', name: 'Tokelau' },
    { code: 'to', name: 'Tonga' },
    { code: 'tt', name: 'Trinidad and Tobago' },
    { code: 'tn', name: 'Tunisia' },
    { code: 'tr', name: 'Turkey' },
    { code: 'tm', name: 'Turkmenistan' },
    { code: 'tc', name: 'Turks and Caicos Islands' },
    { code: 'tv', name: 'Tuvalu' },
    { code: 'ug', name: 'Uganda' },
    { code: 'ua', name: 'Ukraine' },
    { code: 'ae', name: 'United Arab Emirates' },
    { code: 'gb', name: 'United Kingdom' },
    { code: 'us', name: 'United States' },
    { code: 'uy', name: 'Uruguay' },
    { code: 'uz', name: 'Uzbekistan' },
    { code: 'vu', name: 'Vanuatu' },
    { code: 've', name: 'Venezuela' },
    { code: 'vn', name: 'Viet Nam' },
    { code: 'vg', name: 'Virgin Islands (British)' },
    { code: 'vi', name: 'Virgin Islands (U.S.)' },
    { code: 'wf', name: 'Wallis and Futuna' },
    { code: 'eh', name: 'Western Sahara' },
    { code: 'ye', name: 'Yemen' },
    { code: 'zm', name: 'Zambia' },
    { code: 'zw', name: 'Zimbabwe' },
];

// ====================================================================
// === SEKCJA NPC: Nowa klasa do zarządzania NPC ===
// ====================================================================

class NPCManager {
    constructor(drawPlayerFunc) {
        this.npcs = [];
        this.npcAssets = {};
        this.areAssetsLoaded = false;
        this.currentBiome = null;
        this.drawPlayer = drawPlayerFunc;
        this.villageBounds = { minX: 0, maxX: 0 };
        this.INTERACTION_RADIUS = 150; // <--- NOWOŚĆ: Promień interakcji
    }

    loadCurrentBiomeAssets(biomeName, callback) {
        if (this.currentBiome === biomeName && this.areAssetsLoaded) {
            if (callback) callback();
            return;
        }
        this.currentBiome = biomeName;
        this.areAssetsLoaded = false;
        const basePath = `img/world/biome/${biomeName}/npc/`;
        const assetKeys = ['leg', 'body', 'arm', 'head', 'eye'];
        const promises = [];
        this.npcAssets = {};
        for (const key of assetKeys) {
            const promise = new Promise((resolve) => {
                const img = new Image();
                img.src = `${basePath}${key}.png`;
                img.onload = () => {
                    this.npcAssets[key] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load NPC asset: ${img.src}`);
                    resolve();
                };
            });
            promises.push(promise);
        }
        Promise.all(promises).then(() => {
            console.log(`All NPC assets for biome '${biomeName}' loaded.`);
            this.areAssetsLoaded = true;
            if (callback) callback();
        });
    }

    spawnNPCs(gameData) {
        this.clear();
        if (!gameData || gameData.villageType === 'none' || !gameData.placedBuildings || gameData.placedBuildings.length === 0) return;
        
        const MAX_NPCS = 4;
        const groundY = DEDICATED_GAME_HEIGHT - gameData.groundLevel - playerSize;
        const buildings = gameData.placedBuildings;
        const xCoords = buildings.map(b => b.x);
        const widths = buildings.map(b => b.width);
        this.villageBounds.minX = Math.min(...xCoords) - 150;
        this.villageBounds.maxX = Math.max(...xCoords.map((x, i) => x + widths[i])) + 150;
        
        for (const building of buildings) {
            if (this.npcs.length >= MAX_NPCS) {
                break;
            }
            const npcCount = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < npcCount; i++) {
                 if (this.npcs.length >= MAX_NPCS) {
                    break;
                }
                const availableHairs = customizationOptions.hair;
                const randomIndex = Math.floor(Math.random() * 4);
                const randomHair = availableHairs[randomIndex];
                const randomBrightness = Math.floor(Math.random() * (HAIR_BRIGHTNESS_MAX - HAIR_BRIGHTNESS_MIN + 1)) + HAIR_BRIGHTNESS_MIN;
                const npc = {
                    id: `npc_${this.npcs.length}`,
                    x: building.x + (building.width / 2) + (Math.random() * 200 - 100),
                    y: groundY,
                    direction: Math.random() < 0.5 ? 1 : -1,
                    isWalking: false,
                    isIdle: true,
                    isJumping: false,
                    animationFrame: 0,
                    idleAnimationFrame: 0,
                    velocityX: 0,
                    velocityY: 0,
                    state: 'idle',
                    stateTimer: Math.random() * 7 + 2,
                    isInteracting: false, // <--- NOWOŚĆ: Stan interakcji
                    customizations: { hat: 'none', hair: randomHair, accessories: 'none', beard: 'none', clothes: 'none', pants: 'none', shoes: 'none', rightHandItem: ITEM_NONE, hairHue: 150, hairBrightness: randomBrightness, hairSaturation: 100, beardHue: 0, beardBrightness: 100, beardSaturation: 100 }
                };
                this.npcs.push(npc);
            }
        }
        console.log(`Spawned ${this.npcs.length} NPCs for the village.`);
    }

    update(deltaTime) {
        if (!this.areAssetsLoaded || this.npcs.length === 0) return;
        const PLAYER_WALK_SPEED = 5;

        this.npcs.forEach(npc => {
            // Jeśli gracz jest w interakcji, NPC stoi w miejscu w trybie idle.
            if (npc.isInteracting) {
                npc.isWalking = false;
                npc.isIdle = true;
                npc.velocityX = 0;
                npc.idleAnimationFrame = (npc.idleAnimationFrame + 1) % IDLE_ANIM_CYCLE_LENGTH;
                return; // Przerwij dalsze przetwarzanie dla tego NPC
            }

            // Normalna logika ruchu, gdy nie ma interakcji
            npc.stateTimer -= deltaTime;
            if (npc.stateTimer <= 0) {
                if (npc.state === 'idle') {
                    npc.state = 'walking';
                    npc.stateTimer = Math.random() * 6 + 4;
                    npc.direction = Math.random() < 0.5 ? 1 : -1;
                } else {
                    npc.state = 'idle';
                    npc.stateTimer = Math.random() * 4 + 2;
                }
            }
            if (npc.state === 'walking') {
                npc.isWalking = true;
                npc.isIdle = false;
                npc.velocityX = 5 * npc.direction;
                npc.x += npc.velocityX;
                if (npc.x < this.villageBounds.minX) {
                    npc.x = this.villageBounds.minX;
                    npc.direction = 1;
                } else if (npc.x > this.villageBounds.maxX - playerSize) {
                    npc.x = this.villageBounds.maxX - playerSize;
                    npc.direction = -1;
                }
                const speedFactor = Math.abs(npc.velocityX / PLAYER_WALK_SPEED);
                npc.animationFrame = (npc.animationFrame + speedFactor * 2.1);
            } else {
                npc.isWalking = false;
                npc.isIdle = true;
                npc.velocityX = 0;
                npc.idleAnimationFrame = (npc.idleAnimationFrame + 1) % IDLE_ANIM_CYCLE_LENGTH;
            }
        });
    }

    draw(ctx) {
        if (!this.areAssetsLoaded || this.npcs.length === 0) return;
        const sortedNPCs = [...this.npcs].sort((a, b) => (a.y + playerSize) - (b.y + playerSize));
        sortedNPCs.forEach(npc => {
            this.drawPlayer(npc, this.npcAssets);
        });
    }

    clear() {
        this.npcs = [];
    }
}

// ====================================================================

const lobbyDiv = document.getElementById('lobby');
const gameContainerDiv = document.getElementById('gameContainer');
const usernameInput = document.getElementById('usernameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const newRoomNameInput = document.getElementById('newRoomName');
const roomListUl = document.getElementById('roomList');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

const playerSize = 128;
const animationCycleLength = 60;
const armRotationDegrees = 45;
const legRotationDegrees = 45;
const bodyHeadPulseAmount = Math.round(2 * (playerSize / 36));
const armRotationAngle = armRotationDegrees * (Math.PI / 180);
const legRotationAngle = legRotationDegrees * (Math.PI / 180);
const originalArmPivotInImageX = Math.round(14 * (playerSize / 36));
const originalArmPivotInImageY = Math.round(15 * (playerSize / 36));
const legPivotInImageX = Math.round(14 * (playerSize / 36));
const legPivotInImageY = Math.round(27 * (playerSize / 36));
const headPivotInImageX = Math.round(16 * (playerSize / 32));
const headPivotInImageY = Math.round(16 * (playerSize / 32));
const headRotationAngleAmount = (Math.PI / 180 * 2);
const headOscillationAmplitudeFactor = 0.5;
const headInitialOffsetY = 0;
const HAIR_VERTICAL_OFFSET = -Math.round(10 * (playerSize / 32));
const BEARD_VERTICAL_OFFSET = -Math.round(10 * (playerSize / 32));
const backArmOffsetX = Math.round(8 * (playerSize / 36));
const backLegOffsetX = Math.round(9 * (playerSize / 36));
const frontArmOffsetX = 0;
const frontLegOffsetX = 0;
const eyeSpriteSize = Math.round(32 * (playerSize / 32));
const eyePivotInImage = eyeSpriteSize / 2;
const eyeMaxMovementRadius = Math.round(0.4 * (playerSize / 32));
const LEFT_EYE_BASE_X_REL_HEAD_TL = Math.round(0 * (playerSize / 32));
const RIGHT_EYE_BASE_X_REL_HEAD_TL = Math.round(4.5 * (playerSize / 32));
const EYE_BASE_Y_REL_HEAD_TL = Math.round(0.5 * (playerSize / 32));
const IDLE_ANIM_CYCLE_LENGTH = 60;
const IDLE_ARM_ROTATION_DEGREES = 8;
const IDLE_BODY_HEAD_PULSE_AMOUNT = Math.round(1.5 * (playerSize / 36));
const IDLE_HEAD_ROTATION_DEGREES = 1;
const IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR = 0.4;
const IDLE_ARM_ROTATION_ANGLE = IDLE_ARM_ROTATION_DEGREES * (Math.PI / 180);
const IDLE_HEAD_ROTATION_ANGLE_AMOUNT = IDLE_HEAD_ROTATION_DEGREES * (Math.PI / 180);
const JUMP_BODY_TILT_DEGREES = -20;
const JUMP_LEG_OPPOSITE_ROTATION_DEGREES = -120;
const JUMP_LEG_WAVE_DEGREES = 120;
const FLOAT_SIZE = 32;
const JUMP_ARM_WAVE_DEGREES = 180;
const INSECT_SCALE_FACTOR = 2.6;
const JUMP_BODY_TILT_ANGLE = JUMP_BODY_TILT_DEGREES * (Math.PI / 180);
const JUMP_LEG_OPPOSITE_ROTATION_ANGLE = JUMP_LEG_OPPOSITE_ROTATION_DEGREES * (Math.PI / 180);
const JUMP_LEG_WAVE_ANGLE = JUMP_LEG_WAVE_DEGREES * (Math.PI / 180);
const JUMP_ARM_WAVE_ANGLE = JUMP_ARM_WAVE_DEGREES * (Math.PI / 180);
let currentZoomLevel = 1.0;
const MIN_ZOOM = 0.76;
const MAX_ZOOM = 1.9;
const ZOOM_SENSITIVITY = 0.1;
const ITEM_NONE = 'none';
const ITEM_ROD = 'rod';
const ITEM_SHOVEL = 'shovel';
const FISHING_BAR_WIDTH = 192;
const FISHING_BAR_HEIGHT = 30;
const FISHING_SLIDER_SPEED = 0.05;
const FISHING_LINE_SEGMENT_WIDTH = 4;
const BOBBER_VERTICAL_OSCILLATION = 4;
const BOBBER_ROTATION_OSCILLATION = 10 * (Math.PI / 180);
const BOBBER_ANIMATION_SPEED = 0.05;

// === POCZĄTEK NOWYCH STAŁYCH ===
const BOBBER_MAX_SINK_DEPTH = 70; // Maksymalna głębokość tonięcia w pikselach przy pełnej mocy
const BOBBER_SINK_SPEED = 5.0;      // Prędkość z jaką spławik tonie
const BOBBER_RISE_SPEED = 2.5;      // Prędkość z jaką spławik jest wypychany na powierzchnię (wolniejsza dla efektu)
const BOBBER_MAX_SPLASHDOWN_ROTATION = 0.6; // Maksymalna rotacja w radianach (~35 stopni)
const BOBBER_ROTATION_DAMPING = 4.0; // Jak szybko rotacja wraca do zera

const characterImagePaths = { leg: 'img/character/leg.png', body: 'img/character/body.png', arm: 'img/character/arm.png', head: 'img/character/head.png', eye: 'img/character/eye.png' };
const customizationUIPaths = { frame: 'img/ui/frame.png' };
const fishingUIPaths = { strike: 'img/ui/strike.png', fishframe: 'img/ui/fishframe.png' };
const baitImagePaths = {
    //robaki
    'worm': 'img/bait/worm.png',
    'beetle larvae': 'img/bait/beetle larvae.png',
    'dung worm': 'img/bait/dung worm.png',
    'maggots': 'img/bait/maggots.png',
    'bloodworm': 'img/bait/bloodworm.png',
    
    //lure i wobbler
    'handmade jig': 'img/bait/handmade jig.png',
    'red chubby wobbler': 'img/bait/red chubby wobbler.png',
    'wooden two-jointed wobbler': 'img/bait/wooden two-jointed wobbler.png',
    'green kavasaki wobbler': 'img/bait/green kavasaki wobbler.png',
    'high contrast wobbler': 'img/bait/high contrast wobbler.png',
    'walker': 'img/bait/walker.png',
    'spoon': 'img/bait/spoon.png',
    'soft lure painted with oil': 'img/bait/soft lure painted with oil.png',
    'buzzbait': 'img/bait/buzzbait.png',

};
// ======================= POCZĄTEK ZMIAN =======================
const hookImagePaths = {
    'weedless': 'img/hook/weedless.png',
    'beaked': 'img/hook/beaked.png',
    'double': 'img/hook/double.png',
    'treble': 'img/hook/treble.png',
};


// ======================== KONIEC ZMIAN =========================

const characterImages = {};
const customizationUIImages = {};
const fishingUIImages = {};
const allItemImages = {}; 
const baitImages = {};
const characterCustomImages = { hat: {}, hair: {}, accessories: {}, beard: {}, clothes: {}, clothes_arm: {}, pants: {}, pants_leg: {}, shoes: {}, items: {} };
const exampleCustomItemPaths = {
hat: {
    'red cap': 'img/character/custom/hat/type1.png',
    'blue cap': 'img/character/custom/hat/type2.png',
    'special': 'img/character/custom/hat/type3.png',
    'street cap': 'img/character/custom/hat/type4.png',
    'pink cap': 'img/character/custom/hat/type5.png',
    'black cap': 'img/character/custom/hat/type6.png',
    'oldschool cap': 'img/character/custom/hat/type7.png',
    'blue straight cap': 'img/character/custom/hat/type8.png',
    'green straight cap': 'img/character/custom/hat/type9.png',
    'kiddo cap': 'img/character/custom/hat/type10.png',
    'red seasonal': 'img/character/custom/hat/type11.png',
    'green seasonal': 'img/character/custom/hat/type12.png',
    'flat cap': 'img/character/custom/hat/type13.png',
    'cowboy hat': 'img/character/custom/hat/type14.png',
    'adventure hat': 'img/character/custom/hat/type15.png',
    'straw hat': 'img/character/custom/hat/type16.png',
    'lake hat': 'img/character/custom/hat/type17.png',
    'fedora': 'img/character/custom/hat/type18.png',
},
hair: {
    'Curly': 'img/character/custom/hair/type1.png',
    'Curly Short': 'img/character/custom/hair/type2.png',
    'Short': 'img/character/custom/hair/type3.png',
    'Plodder': 'img/character/custom/hair/type4.png',
    '"Cool Kid"': 'img/character/custom/hair/type5.png',
    'inmate': 'img/character/custom/hair/type6.png',
    'maniac': 'img/character/custom/hair/type7.png',
    'alopecia': 'img/character/custom/hair/type8.png',
    'Mrs. Robinson': 'img/character/custom/hair/type9.png',
    'Bob': 'img/character/custom/hair/type10.png',
    'Mod': 'img/character/custom/hair/type11.png',
    'U.S Army': 'img/character/custom/hair/type12.png',
    'Afro': 'img/character/custom/hair/type13.png',
    'Tuber Afro': 'img/character/custom/hair/type14.png',
    'Greasy Grunge': 'img/character/custom/hair/type15.png',
    'Mohawk': 'img/character/custom/hair/type16.png',
    'Messy Bun': 'img/character/custom/hair/type17.png',
    'Juliet': 'img/character/custom/hair/type18.png',
    'I`m a Star': 'img/character/custom/hair/type19.png',
    'Short Twist': 'img/character/custom/hair/type20.png',
    '"Emo"': 'img/character/custom/hair/type21.png',
    'Dandere': 'img/character/custom/hair/type22.png',
    'Smart Bangs': 'img/character/custom/hair/type23.png',
    'Ponytail': 'img/character/custom/hair/type25.png',
    'Pigtails': 'img/character/custom/hair/type24.png',
    'Richie': 'img/character/custom/hair/type26.png',
},
accessories: {
    'librarian glasses': 'img/character/custom/accessories/type1.png',
    'mole glasses': 'img/character/custom/accessories/type2.png',
    'square glasses': 'img/character/custom/accessories/type3.png',
    'black glasses': 'img/character/custom/accessories/type4.png',
    'red glasses': 'img/character/custom/accessories/type5.png',
    '"cool" glasses': 'img/character/custom/accessories/type6.png',
    'sunglasses': 'img/character/custom/accessories/type7.png',
    'windsor glasses': 'img/character/custom/accessories/type8.png',
    'eye patch': 'img/character/custom/accessories/type9.png'
},
beard: {
    'goatee': 'img/character/custom/beard/type1.png',
    'overgrown goatee': 'img/character/custom/beard/type2.png',
    'mustache': 'img/character/custom/beard/type3.png',
    'overgrown mustache': 'img/character/custom/beard/type4.png',
    'charlie?': 'img/character/custom/beard/type5.png',
    'unshaven': 'img/character/custom/beard/type6.png',
    'sailor': 'img/character/custom/beard/type7.png'
},
clothes: {
    'white t-shirt': 'img/character/custom/clothes/type1.png',
    'black t-shirt': 'img/character/custom/clothes/type2.png',
    'hawaii shirt': 'img/character/custom/clothes/type3.png',
    'red hoodie': 'img/character/custom/clothes/type4.png',
    'blue hoodie': 'img/character/custom/clothes/type5.png',
    'skull t-shirt': 'img/character/custom/clothes/type6.png',
    'red plaid vest': 'img/character/custom/clothes/type7.png',
    'dark blue soccer shirt': 'img/character/custom/clothes/type8.png',
    'green soccer shirt': 'img/character/custom/clothes/type9.png',
    'light soccer shirt': 'img/character/custom/clothes/type10.png',
    'denim vest': 'img/character/custom/clothes/type11.png',
    'coquette dress': 'img/character/custom/clothes/type12.png',
},
clothes_arm: {
    'white t-shirt': 'img/character/custom/clothes/arm/type1.png',
    'black t-shirt': 'img/character/custom/clothes/arm/type2.png',
    'hawaii shirt': 'img/character/custom/clothes/arm/type3.png',
    'red hoodie': 'img/character/custom/clothes/arm/type4.png',
    'blue hoodie': 'img/character/custom/clothes/arm/type5.png',
    'skull t-shirt': 'img/character/custom/clothes/arm/type6.png',
    'red plaid vest': 'img/character/custom/clothes/arm/type7.png',
    'dark blue soccer shirt': 'img/character/custom/clothes/arm/type8.png',
    'green soccer shirt': 'img/character/custom/clothes/arm/type9.png',
    'light soccer shirt': 'img/character/custom/clothes/arm/type10.png',
    'denim vest': 'img/character/custom/clothes/arm/type11.png',
    'coquette dress': 'img/character/custom/clothes/arm/type12.png',
},
pants: {
    'blue jeans': 'img/character/custom/pants/type1.png',
    'ripped jeans': 'img/character/custom/pants/type2.png',
    'black jeans': 'img/character/custom/pants/type3.png',
    'black skirt': 'img/character/custom/pants/type4.png',
    'black bell bottom jeans': 'img/character/custom/pants/type5.png',
    'blue bell bottom jeans': 'img/character/custom/pants/type6.png',
},
pants_leg: {
    'blue jeans': 'img/character/custom/pants/leg/type1.png',
    'ripped jeans': 'img/character/custom/pants/leg/type2.png',
    'black jeans': 'img/character/custom/pants/leg/type3.png',
    'black skirt': 'img/character/custom/pants/leg/type4.png',
    'black bell bottom jeans': 'img/character/custom/pants/leg/type5.png',
    'blue bell bottom jeans': 'img/character/custom/pants/leg/type6.png',
},
shoes: {
    'shoes1': 'img/character/custom/shoes/type1.png'
},
    items: {'rod':{path:'img/item/rod.png',width:playerSize*2,height:playerSize,pivotX_in_img:Math.round(20*(playerSize/128)),pivotY_in_round:(20*(playerSize/128))},'shovel':{path:'img/item/shovel.png',width:playerSize,height:playerSize,pivotX_in_img:playerSize/2,pivotY_in_img:playerSize/2},'float':{path:'img/item/float.png',width:32,height:62,pivotX_in_img:FLOAT_SIZE/2,pivotY_in_img:FLOAT_SIZE/2}}
};
let localPlayer = { 
    id: null, 
    username: 'Player' + Math.floor(Math.random()*1000), 
    selectedFlag: 'pl', // <-- DODANA WŁAŚCIWOŚĆ Z DOMYŚLNĄ FLAGĄ
    danglingBobber: { x: 0, y: 0, oldX: 0, oldY: 0, initialized: false }, 
    color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'), 
    x: 50, 
    y: DEDICATED_GAME_HEIGHT-50-playerSize, 
    isJumping: false, 
    velocityY: 0, 
    isWalking: false, 
    isIdle: false, 
    animationFrame: 0, 
    idleAnimationFrame: 0, 
    direction: 1, 
    velocityX: 0, 
    currentMouseX: undefined, 
    currentMouseY: undefined, 
    chatMessageText: null, 
    chatMessageExpiry: null ,

    // --- POCZĄTEK POPRAWKI ---
    customizations: { 
        hat: 'none', 
        hair: 'none', 
        accessories: 'none', 
        beard: 'none', 
        clothes: 'none', 
        pants: 'none', 
        shoes: 'none', 
        rightHandItem: ITEM_NONE, 
        hairSaturation: 100, 
        hairHue: 160, 
        hairBrightness: 100, 
        beardSaturation: 100, 
        beardHue: 160, 
        beardBrightness: 100 
    }, 
    // --- KONIEC POPRAWKI ---
    isCasting:false, 
    castingPower:0, 
    fishingBarSliderPosition:0, 
    fishingBarTime:0, 
    castingDirectionAngle:0, 
    hasLineCast:false, 
    floatWorldX:null, 
    floatWorldY:null, 
    rodTipWorldX:null, 
    rodTipWorldY:null, 
    lineAnchorWorldY:null,
    meActionText: null,
    meActionExpiry: null
};

usernameInput.value = localPlayer.username;

// Dodajemy event listener, który aktualizuje nick gracza przy każdej zmianie w polu
usernameInput.addEventListener('input', () => {
    const newUsername = usernameInput.value.trim(); // Pobieramy wartość i usuwamy białe znaki z początku/końca
    
    if (newUsername) {
        localPlayer.username = newUsername;
    } else {
        // Jeśli użytkownik usunie cały tekst, możemy ustawić domyślną nazwę
        localPlayer.username = 'Player';
    }
}); 

let playersInRoom = {};
let insectsInRoom = [];
let currentRoom = null;
let keys = {};
let bobberAnimationTime = 0;
let cameraX = 0;
let cameraY = 0;
let cameraTargetX = 0;
let cameraTargetY = 0;
const CAMERA_SMOOTHING_FACTOR = 0.08;

const CAMERA_VERTICAL_BIAS = 0.4;
let isCustomizationMenuOpen = false;
const customizationCategories = [ 'hat', 'hair', 'accessories', 'beard', 'clothes', 'pants', 'shoes' ];
let selectedCategoryIndex = 0;
let localPlayerCustomizations = { hat: 'none', hair: 'none', accessories: 'none', beard: 'none', clothes: 'none', pants: 'none', shoes: 'none', rightHandItem: ITEM_NONE, hairSaturation: 100, hairHue: 0, hairBrightness: 100, beardSaturation: 100, beardHue: 0, beardBrightness: 100 };
const customizationOptions = { hat: ['none', 'red cap', 'blue cap', 'special', 'street cap', 'pink cap', 'black cap', 'oldschool cap', 'blue straight cap', 'green straight cap', 'kiddo cap', 'red seasonal', 'green seasonal', 'flat cap','cowboy hat', 'adventure hat', 'straw hat', 'lake hat', 'fedora'], hair: ['none', 'Curly', 'Curly Short', 'Short', 'Plodder', '"Cool Kid"', 'inmate', 'maniac', 'alopecia', 'Mrs. Robinson', 'Bob', 'Mod', 'U.S Army', 'Afro', 'Tuber Afro', 'Greasy Grunge', 'Mohawk', 'Messy Bun', 'Juliet', 'I`m a Star', 'Short Twist', '"Emo"', "Dandere", "Smart Bangs", 'Ponytail','Richie', 'Pigtails'], accessories: ['none', 'librarian glasses', 'mole glasses', 'square glasses', 'black glasses', 'red glasses', '"cool" glasses', 'sunglasses', 'windsor glasses', 'eye patch'], beard: ['none', 'goatee', 'overgrown goatee', 'mustache', 'overgrown mustache', 'charlie?', 'unshaven', 'sailor'], clothes: ['none', 'white t-shirt', 'black t-shirt', 'hawaii shirt', 'red hoodie', 'blue hoodie', 'skull t-shirt', 'red plaid vest', 'dark blue soccer shirt', 'green soccer shirt', 'light soccer shirt', 'denim vest', 'coquette dress'], pants: ['none', 'blue jeans', 'ripped jeans', 'black jeans', 'black skirt', 'black bell bottom jeans', 'blue bell bottom jeans'], shoes: ['none', 'shoes1'] };
let currentCustomizationOptionIndices = { hat: 0, hair: 0, accessories: 0, beard: 0, clothes: 0, pants: 0, shoes: 0 };

const MENU_WIDTH=150,MENU_TEXT_COLOR='white',MENU_HIGHLIGHT_COLOR='yellow',MENU_ITEM_HEIGHT=40,MENU_X_OFFSET_FROM_PLAYER=0,MENU_Y_OFFSET_FROM_PLAYER_TOP_CENTER_SELECTED=-40,ROLLER_VISIBLE_COUNT=3,ROLLER_ITEM_VERTICAL_SPACING=1.2*MENU_ITEM_HEIGHT,ROLLER_DIMMED_SCALE=.7,ROLLER_DIMMED_ALPHA=.3,FRAME_SIZE=186,FRAME_OFFSET_X_FROM_MENU_TEXT=30,FRAME_OSCILLATION_SPEED=.05,FRAME_ROTATION_DEGREES=5;let frameOscillationTime=0;const PIXEL_FONT='Segoe UI, monospace',DEFAULT_FONT_SIZE_USERNAME=16,DEFAULT_FONT_SIZE_MENU=24,HAIR_SATURATION_MIN=0,HAIR_SATURATION_MAX=200,HAIR_BRIGHTNESS_MIN=40,HAIR_BRIGHTNESS_MAX=200,HAIR_HUE_MIN=0,HAIR_HUE_MAX=360,BEARD_SATURATION_MIN=0,BEARD_SATURATION_MAX=200,BEARD_BRIGHTNESS_MIN=40,BEARD_BRIGHTNESS_MAX=200,BEARD_HUE_MIN=0,BEARD_HUE_MAX=360;
let customizationMenuState = 'category';
let selectedColorPropertyIndex = 0;
const colorProperties = ['brightness', 'saturation', 'hue'];
let lastTime = 0;
let campPromptAlpha = 0;
let npcPromptAlpha = 0; // <--- DODAJ TĘ LINIĘ
const PROMPT_FADE_SPEED = 4;
let wasPlayerOnGround = true; // <-- NOWA ZMIENNA

// ======================= WKLEJ TUTAJ =======================
const FISH_TIER_CONFIG = {
    0: { color: 'rgba(221, 221, 221, 1)', font: `16px ${PIXEL_FONT}`, imageKey: null },
    1: { color: 'rgba(14, 168, 40, 1)', font: `16px ${PIXEL_FONT}`, imageKey: 'common_star' },
    2: { color: 'rgba(46, 123, 216, 1)', font: `16px ${PIXEL_FONT}`, imageKey: 'uncommon_star' },
    3: { color: 'rgba(255, 184, 94, 1)',  font: `16px ${PIXEL_FONT}`, imageKey: 'rare_star' },
    4: { color: 'rgba(152, 65, 199, 1)', font: `16px ${PIXEL_FONT}`, imageKey: 'epic_star' },
    5: { color: 'rgba(185, 6, 117, 1)', font: `bold 16px ${PIXEL_FONT}`, imageKey: 'legendary_star' }
};
// =============================================================

// ======================= POCZĄTEK ZMIAN =======================
const TIER_NAMES = {
    0: 'basic',
    1: 'common',
    2: 'uncommon',
    3: 'rare',
    4: 'epic',
    5: 'legendary'
};
// =============================================================

const inventoryManager = new InventoryManager();
const fishingManager = new FishingManager();
// ======================= POCZĄTEK ZMIANY =======================
const tradingManager = new TradingManager(inventoryManager, fishingManager);
const soundManager = new SoundManager(); // <-- NOWA LINIA
// ======================== KONIEC ZMIANY =========================

// Teraz, gdy oba managery istnieją, możemy je ze sobą połączyć
inventoryManager.linkTradingManager(tradingManager);
// ======================= POCZĄTEK ZMIAN =======================
// Przekaż potrzebne obiekty konfiguracyjne do obu managerów
fishingManager.tierConfig = FISH_TIER_CONFIG;
fishingManager.starImages = starImages;
inventoryManager.tierConfig = FISH_TIER_CONFIG;
inventoryManager.starImages = starImages;
inventoryManager.tierNames = TIER_NAMES; // <-- DODAJ TĘ LINIĘ
// ======================== KONIEC ZMIAN =========================

let previousHasLineCast = false;
const pierSpanImages = {};
let pierSupportData = [];

const caughtFishAnimations = [];
const FISH_ANIMATION_DURATION = 1200;
const FISH_DISPLAY_DURATION = 4000;



// ====================================================================
// === SEKCJA 2: FUNKCJE RYSOWANIA (z modyfikacjami) ===
// ====================================================================

function drawTimedTutorials() {
    if (timedTutorialsQueue.length === 0 || !localPlayer.hasLineCast) return;

    const now = Date.now();
    const bobberScreenX = (localPlayer.floatWorldX - cameraX) * currentZoomLevel;
    const bobberScreenY = (localPlayer.floatWorldY - cameraY) * currentZoomLevel;

    // Usuń przestarzałe samouczki z kolejki
    timedTutorialsQueue = timedTutorialsQueue.filter(tut => now < tut.endTime);

    timedTutorialsQueue.forEach(tut => {
        const image = tutorialImages[tut.key];
        if (!image || !image.complete) return;

        const elapsed = now - tut.startTime;
        if (elapsed < 0) return; // Jeszcze nie czas na wyświetlenie

        let alpha = 0;
        const FADE_DURATION = 500; // Czas trwania fade-in i fade-out

        if (elapsed < FADE_DURATION) {
            alpha = elapsed / FADE_DURATION; // Fade in
        } else if (elapsed > tut.duration - FADE_DURATION) {
            const fadeOutElapsed = elapsed - (tut.duration - FADE_DURATION);
            alpha = 1 - (fadeOutElapsed / FADE_DURATION); // Fade out
        } else {
            alpha = 1; // W pełni widoczny
        }

        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha <= 0) return;

        const drawWidth = image.width * TUTORIAL_IMAGE_SCALE;
        const drawHeight = image.height * TUTORIAL_IMAGE_SCALE;
        
        // Pozycja: nieco nad i na lewo od spławika
        const x = bobberScreenX - drawWidth;
        const y = bobberScreenY - drawHeight;

        const rockingAngle = Math.sin(Date.now() / 1000 * TUTORIAL_ROCKING_SPEED) * (TUTORIAL_ROCKING_ANGLE_DEGREES * Math.PI / 180);
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.translate(x + drawWidth / 2 -22, y + drawHeight / 2 +65);
        ctx.rotate(rockingAngle);
        ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
    });
}

function drawCampPrompt() {
    // Optymalizacja: jeśli komunikat jest w pełni przezroczysty, nie wykonuj reszty funkcji
    if (campPromptAlpha <= 0) return;

    const image = tutorialImages['info6'];
    if (!image || !image.complete) return;

    // --- Definicje stylów i treści ---
    const textBefore = "Press ";
    const textAfter = " to go to the next location";
    const PROMPT_FONT_SIZE = 16;
    const PROMPT_FONT_FAMILY = `'Segoe UI', sans-serif`;
    const PROMPT_TEXT_COLOR = 'white';
    const PROMPT_OUTLINE_COLOR = 'black';
    const PROMPT_OUTLINE_WIDTH = 4;
    const SPACING = -24;

    // --- Obliczenia wymiarów i pozycji ---
    const playerScreenX = (localPlayer.x - cameraX + playerSize / 2) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;
    const drawHeight = PROMPT_FONT_SIZE * 6.5;
    const drawWidth = (image.width / image.height) * drawHeight;
    ctx.font = `bold ${PROMPT_FONT_SIZE}px ${PROMPT_FONT_FAMILY}`;
    const textBeforeWidth = ctx.measureText(textBefore).width;
    const textAfterWidth = ctx.measureText(textAfter).width;
    const totalWidth = textBeforeWidth + drawWidth + textAfterWidth + SPACING * 2;
    const promptY = playerScreenY + TUTORIAL_Y_OFFSET - drawHeight;
    
    // --- Animacje bujania ---
    const time = Date.now() / 1000;
    const mainRockingAngle = Math.sin(time * (TUTORIAL_ROCKING_SPEED * 0.5)) * ((TUTORIAL_ROCKING_ANGLE_DEGREES * 0.4) * Math.PI / 180);
    const imageRockingAngle = Math.sin(time * (TUTORIAL_ROCKING_SPEED * 1.2)) * ((TUTORIAL_ROCKING_ANGLE_DEGREES * 0.8) * Math.PI / 180);
    
    // --- Rysowanie ---
    ctx.save();
    
    // === GŁÓWNA ZMIANA: Zastosowanie efektu fade-in/out ===
    ctx.globalAlpha = campPromptAlpha;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(playerScreenX, promptY + drawHeight / 2);
    ctx.rotate(mainRockingAngle);

    // Ustawienia tekstu
    ctx.font = `bold ${PROMPT_FONT_SIZE}px ${PROMPT_FONT_FAMILY}`;
    ctx.strokeStyle = PROMPT_OUTLINE_COLOR;
    ctx.lineWidth = PROMPT_OUTLINE_WIDTH;
    ctx.fillStyle = PROMPT_TEXT_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let currentX = -totalWidth / 2;

    // Rysowanie tekstu przed obrazkiem
    ctx.strokeText(textBefore, currentX, 0);
    ctx.fillText(textBefore, currentX, 0);
    currentX += textBeforeWidth + SPACING;

    // Rysowanie obrazka z jego osobnym bujaniem
    ctx.save();
    ctx.translate(currentX + drawWidth / 2, 0); 
    ctx.rotate(imageRockingAngle);
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore(); 

    currentX += drawWidth + SPACING;

    // Rysowanie tekstu po obrazku
    ctx.strokeText(textAfter, currentX, 0);
    ctx.fillText(textAfter, currentX, 0);

    ctx.restore();
}

function drawNpcTradePrompt() {
    if (npcPromptAlpha <= 0) return;

    const image = tutorialImages['info6'];
    if (!image || !image.complete) return;

    const textBefore = "press ";
    const textAfter = " to trade"; // <--- ZMIENIONY TEKST
    const PROMPT_FONT_SIZE = 16;
    const PROMPT_FONT_FAMILY = `'Segoe UI', sans-serif`;
    const PROMPT_TEXT_COLOR = 'white';
    const PROMPT_OUTLINE_COLOR = 'black';
    const PROMPT_OUTLINE_WIDTH = 4;
    const SPACING = -24;

    const playerScreenX = (localPlayer.x - cameraX + playerSize / 2) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;
    const drawHeight = PROMPT_FONT_SIZE * 6.5;
    const drawWidth = (image.width / image.height) * drawHeight;
    ctx.font = `bold ${PROMPT_FONT_SIZE}px ${PROMPT_FONT_FAMILY}`;
    const textBeforeWidth = ctx.measureText(textBefore).width;
    const textAfterWidth = ctx.measureText(textAfter).width;
    const totalWidth = textBeforeWidth + drawWidth + textAfterWidth + SPACING * 2;
    const promptY = playerScreenY + TUTORIAL_Y_OFFSET - drawHeight;
    
    const time = Date.now() / 1000;
    const mainRockingAngle = Math.sin(time * (TUTORIAL_ROCKING_SPEED * 0.5)) * ((TUTORIAL_ROCKING_ANGLE_DEGREES * 0.4) * Math.PI / 180);
    const imageRockingAngle = Math.sin(time * (TUTORIAL_ROCKING_SPEED * 1.2)) * ((TUTORIAL_ROCKING_ANGLE_DEGREES * 0.8) * Math.PI / 180);
    
    ctx.save();
    ctx.globalAlpha = npcPromptAlpha; // <--- UŻYWA NOWEJ ZMIENNEJ
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(playerScreenX, promptY + drawHeight / 2);
    ctx.rotate(mainRockingAngle);

    ctx.font = `bold ${PROMPT_FONT_SIZE}px ${PROMPT_FONT_FAMILY}`;
    ctx.strokeStyle = PROMPT_OUTLINE_COLOR;
    ctx.lineWidth = PROMPT_OUTLINE_WIDTH;
    ctx.fillStyle = PROMPT_TEXT_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let currentX = -totalWidth / 2;

    ctx.strokeText(textBefore, currentX, 0);
    ctx.fillText(textBefore, currentX, 0);
    currentX += textBeforeWidth + SPACING;

    ctx.save();
    ctx.translate(currentX + drawWidth / 2, 0); 
    ctx.rotate(imageRockingAngle);
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore(); 

    currentX += drawWidth + SPACING;

    ctx.strokeText(textAfter, currentX, 0);
    ctx.fillText(textAfter, currentX, 0);

    ctx.restore();
}



const npcManager = new NPCManager(drawPlayer);

function loadImages(callback) {
    // ======================= POCZĄTEK ZMIAN =======================
    const allPaths = { ...characterImagePaths, ...customizationUIPaths, ...tutorialImagePaths, ...fishingUIPaths, ...baitImagePaths, ...hookImagePaths };
    // ======================== KONIEC ZMIAN =========================
    
    const fishNames = new Set();
    const allFishData = fishingManager.getFishData();
    for (const biome in allFishData) {
        for (const fishName in allFishData[biome]) {
            fishNames.add(fishName);
        }
    }
    
    fishNames.forEach(name => {
        allPaths[`fish_${name}`] = `img/fish/${name}.png`;
    });

    let a = Object.keys(allPaths).length;
    for (const b in exampleCustomItemPaths.items) a++;
    for (const c in exampleCustomItemPaths) { if (c === "items") continue; for (const d in exampleCustomItemPaths[c]) a++; }
    
    const biomeDefsForPierSpans = {
        jurassic: 'img/world/biome/jurassic/pierspan.png',
        grassland: 'img/world/biome/grassland/pierspan.png'
    };
    for (const biome in biomeDefsForPierSpans) a++;
    
    a += Object.keys(starImagePaths).length;

    if (a === 0) {
        if (callback) callback();
        return;
    }
    let e = 0;
    const f = () => {
        e++;
        if (e === a) {
            starManager.areAssetsLoaded = true;
            starManager.initialize(DEDICATED_GAME_WIDTH, DEDICATED_GAME_HEIGHT);
            biomeManager.loadBiomeImages(() => {
                npcManager.loadCurrentBiomeAssets(biomeManager.currentBiomeName, callback);
            });
        }
    };

    for (const key in starImagePaths) {
        const img = new Image();
        img.src = starImagePaths[key];
        img.onload = () => { starImages[key] = img; f(); };
        img.onerror = () => { console.error(`Star image loading error: ${img.src}`); f(); };
    }

    for (const biomeName in biomeDefsForPierSpans) {
        const path = biomeDefsForPierSpans[biomeName];
        const img = new Image();
        img.src = path;
        img.onload = () => { pierSpanImages[biomeName] = img; f(); };
        img.onerror = () => { console.error(`Pier span image loading error: ${img.src}`); f(); };
    }

    for (const h in allPaths) {
        const i = new Image;
        i.src = allPaths[h];
        i.onload = () => {
            if (characterImagePaths[h]) characterImages[h] = i;
            else if (customizationUIPaths[h]) customizationUIImages[h] = i;
            else if (tutorialImagePaths[h]) tutorialImages[h] = i;
            else if (fishingUIPaths[h]) fishingUIImages[h] = i;
            else if (h.startsWith('fish_')) {
                const fishName = h.substring(5);
                allItemImages[fishName] = i;
            }
            else if (baitImagePaths[h]) {
                 allItemImages[h] = i;
            }
            // ======================= POCZĄTEK ZMIAN =======================
            else if (hookImagePaths[h]) {
                 allItemImages[h] = i;
            }
            // ======================== KONIEC ZMIAN =========================
            f()
        }, i.onerror = () => { console.error(`Image loading error: ${i.src}`), f() }
    }
    for (const j in exampleCustomItemPaths) {
        if (j === "items") continue;
        const k = exampleCustomItemPaths[j];
        for (const l in k) {
            const m = k[l],
                n = new Image;
            n.src = m, n.onload = () => { characterCustomImages[j] || (characterCustomImages[j] = {}), characterCustomImages[j][l] = n, f() }, n.onerror = () => { console.error(`Image loading error: (${j}/${l}): ${n.src}`), characterCustomImages[j] || (characterCustomImages[j] = {}), characterCustomImages[j][l] = null, f() }
        }
    }
    const o = exampleCustomItemPaths.items;
    for (const p in o) {
        const q = o[p], r = new Image;
        r.src = q.path, r.onload = () => { characterCustomImages.items[p] = r, f() }, r.onerror = () => { console.error(`Item Image loading error:: ${r.src}`), f() }
    }
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function mapToDisplayRange(value, min, max) {
    if (max - min === 0) return 0;
    const percentage = (value - min) / (max - min);
    return Math.round(percentage * 100);
}

function mapFromDisplayRange(value, min, max) {
    const percentage = value / 100;
    return Math.round(min + (max - min) * percentage);
}

const RECONCILIATION_FACTOR = 0.1;

function reconcilePlayerPosition() {
    const serverState = playersInRoom[localPlayer.id];
    if (!serverState) return;
    localPlayer.x = lerp(localPlayer.x, serverState.x, RECONCILIATION_FACTOR);
    localPlayer.y = lerp(localPlayer.y, serverState.y, RECONCILIATION_FACTOR);
    localPlayer.isJumping = serverState.isJumping;
    localPlayer.direction = serverState.direction;
    localPlayer.hasLineCast = serverState.hasLineCast;
    localPlayer.floatWorldX = serverState.floatWorldX;
    localPlayer.floatWorldY = serverState.floatWorldY;
    if (Math.abs(localPlayer.x - serverState.x) < 0.5) localPlayer.x = serverState.x;
    if (Math.abs(localPlayer.y - serverState.y) < 0.5) localPlayer.y = serverState.y;
}

function applyCycleColorBalance() {
    const rotationDegrees = (cycleManager.rotation * (180 / Math.PI)) % 360;
    const angle = rotationDegrees < 0 ? rotationDegrees + 360 : rotationDegrees;

    let filters = [];
    let overlayColor = 'rgba(0, 0, 0, 0)';

    if (angle >= 0 && angle < 90) {
        const progress = angle / 90;
        const opacity = lerp(0, 0.45, progress);
        overlayColor = `rgba(255, 120, 180, ${opacity})`;
    }
    else if (angle >= 90 && angle < 135) {
        const progress = (angle - 85) / 45;
        const brightness = lerp(1, 0.85, progress);
        const contrast = lerp(1, 1.25, progress);
        const saturation = lerp(1, 0.5, progress);
        const opacity = lerp(0, 0.92, progress);

        filters.push(`brightness(${brightness})`);
        filters.push(`saturate(${saturation})`);
        filters.push(`contrast(${contrast})`);     
        overlayColor = `rgba(0, 80, 180, ${opacity})`;
    }
    else if (angle >= 135 && angle < 225) {
        const brightness = 0.85;
        const saturation = 0.5;
        const opacity = 0.92;
        const contrast = 1.25;
        filters.push(`brightness(${brightness})`);
        filters.push(`saturate(${saturation})`);
        filters.push(`contrast(${contrast})`);   
   
        overlayColor = `rgba(0, 80, 180, ${opacity})`;
    }
    else if (angle >= 225 && angle < 270) {
        const progress = (angle - 225) / 95;
        const brightness = lerp(0.85, 1, progress);
        filters.push(`brightness(${brightness})`);

        const saturation = lerp(0.7, 1, progress);
        const opacity = lerp(0.65, 0, progress);
        filters.push(`saturate(${saturation})`);
        const contrast = lerp(1.25, 1, progress);
        filters.push(`contrast(${contrast})`);  
        overlayColor = `rgba(255, 120, 180, ${opacity})`;
    }

    cycleOverlay.style.backgroundColor = overlayColor;
    cycleOverlay.style.backdropFilter = filters.length > 0 ? filters.join(' ') : 'none';
}




function updateCamera() {
    const playerWorldCenterX = localPlayer.x + playerSize / 2;
    const playerWorldCenterY = localPlayer.y + playerSize / 2;

    const visibleWorldWidth = DEDICATED_GAME_WIDTH / currentZoomLevel;
    const visibleWorldHeight = DEDICATED_GAME_HEIGHT / currentZoomLevel;

    let targetCameraX = playerWorldCenterX - visibleWorldWidth / 2;
    if (targetCameraX < 0) targetCameraX = 0;
    if (targetCameraX > currentWorldWidth - visibleWorldWidth) targetCameraX = currentWorldWidth - visibleWorldWidth;
    if (currentWorldWidth < visibleWorldWidth) targetCameraX = (currentWorldWidth / 2) - (visibleWorldWidth / 2);
    
    const verticalOffset = visibleWorldHeight * (CAMERA_VERTICAL_BIAS - 0.5);
    let targetCameraY = (playerWorldCenterY + verticalOffset) - (visibleWorldHeight / 2);

    if (targetCameraY < 0) targetCameraY = 0;
    if (targetCameraY > DEDICATED_GAME_HEIGHT - visibleWorldHeight) targetCameraY = DEDICATED_GAME_HEIGHT - visibleWorldHeight;
    if (DEDICATED_GAME_HEIGHT < visibleWorldHeight) targetCameraY = (DEDICATED_GAME_HEIGHT / 2) - (visibleWorldHeight / 2);

    cameraX = lerp(cameraX, targetCameraX, CAMERA_SMOOTHING_FACTOR);
    cameraY = lerp(cameraY, targetCameraY, 1);
    biomeManager.drawParallaxBackground(ctx, cameraX, visibleWorldWidth);
    if (currentRoom && currentRoom.gameData && currentRoom.gameData.biome) {
        const biomeName = currentRoom.gameData.biome;
        const groundLevel = currentRoom.gameData.groundLevel;
        biomeManager.drawBackgroundBiomeGround(ctx, biomeName, groundLevel);
        biomeManager.drawBackgroundTrees(ctx);
        biomeManager.drawBackgroundPlants(ctx);
        biomeManager.drawForegroundBiomeGround(ctx, biomeName, groundLevel);
        biomeManager.drawBuildings(ctx, groundLevel, cameraX, DEDICATED_GAME_WIDTH / currentZoomLevel);
    }
}

function drawFilteredCharacterPart(a,b,c,d,e,f,g=100,h=0,i=100){if(!b||!b.complete)return;const j=document.createElement("canvas");j.width=e,j.height=f;const k=j.getContext("2d");k.imageSmoothingEnabled=!1,k.drawImage(b,0,0,e,f);const l=[];100!==g&&l.push(`saturate(${g}%)`),0!==h&&l.push(`hue-rotate(${h}deg)`),100!==i&&l.push(`brightness(${i}%)`),l.length>0?(a.save(),a.filter=l.join(" "),a.drawImage(j,c,d,e,f),a.restore()):a.drawImage(j,c,d,e,f)}

function drawPierSupports(ctx) {
    if (!pierSupportData || pierSupportData.length === 0 || !currentRoom || !currentRoom.gameData) return;
    const biomeName = currentRoom.gameData.biome;
    const supportImage = pierSpanImages[biomeName];
    if (!supportImage || !supportImage.complete) return;
    const PILE_GFX_WIDTH = 32;
    const PILE_GFX_HEIGHT = 128;
    const SCALED_TILE_SIZE = 32*4;
    const scaledPierGfxHeight = SCALED_TILE_SIZE;
    pierSupportData.forEach((pierData, pierIndex) => {
        if (pierIndex >= biomeManager.placedPiers.length) return;
        const originalPier = biomeManager.placedPiers[pierIndex];
        if (!originalPier) return;
        pierData.sections.forEach((sectionData, sectionIndex) => {
            const sectionBaseX = originalPier.x + sectionIndex * SCALED_TILE_SIZE;
            const pierPlankTopY = originalPier.y - scaledPierGfxHeight + 116;
            const PIER_PLANK_THICKNESS = 20;
            const pileStartY = pierPlankTopY + PIER_PLANK_THICKNESS;
            sectionData.piles.forEach(pile => {
                const renderWidth = PILE_GFX_WIDTH * pile.scale;
                const renderHeight = PILE_GFX_HEIGHT * pile.scale;
                const pileDrawX = sectionBaseX + pile.x;
                ctx.save();
                ctx.translate(pileDrawX + renderWidth / 2, pileStartY);
                ctx.rotate(pile.rotation);
                ctx.drawImage(supportImage, 0, 0, PILE_GFX_WIDTH, PILE_GFX_HEIGHT, -renderWidth / 2, 0, renderWidth*2.5, renderHeight*2.5);
                ctx.restore();
            });
        });
    });
}

function drawPlayer(p, imageSet = characterImages) {
    if (!imageSet.body || !imageSet.body.complete) {
        if (p.color) {
             ctx.fillStyle = p.color;
             ctx.fillRect(p.x, p.y, playerSize, playerSize);
        }
        return;
    }
    ctx.save();

    // ======================= POCZĄTEK ZMIANY =======================
    // Efekt wizualny (podświetlenie) jest teraz kontrolowany przez nową flagę.
    if (p.isHighlighted === true) {
        ctx.filter = 'brightness(1.6)';
    }
    // ======================== KONIEC ZMIANY ========================

    let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0;
    const i = (Number(p.animationFrame || 0) % animationCycleLength) / animationCycleLength,
        j = (Number(p.idleAnimationFrame || 0) % IDLE_ANIM_CYCLE_LENGTH) / IDLE_ANIM_CYCLE_LENGTH,
        k = p.isWalking === !0,
        l = p.isIdle === !0,
        m = p.isJumping === !0;
    let n = 0;
    const o = p.x, q = p.y;
    let r = 0, s = 0;
    if (p.id === localPlayer.id && void 0 !== localPlayer.currentMouseX) {
        const t = localPlayer.currentMouseX,
            u = localPlayer.currentMouseY,
            v = o + headPivotInImageX,
            w = q + (headInitialOffsetY + headPivotInImageY),
            x = (t - v) * p.direction,
            y = u - w,
            z = Math.sqrt(x * x + y * y);
        if (z > 0) {
            const A = x / z, B = y / z;
            r = A * Math.min(z, eyeMaxMovementRadius), s = B * Math.min(z, eyeMaxMovementRadius)
        }
    }
    if (k && !m) n = Math.sin(2 * i * Math.PI), a = -bodyHeadPulseAmount * Math.abs(n), b = n * armRotationAngle, c = -b, d = n * legRotationAngle, e = -d, f = n * headRotationAngleAmount, g = Math.sin(4 * i * Math.PI) * bodyHeadPulseAmount * headOscillationAmplitudeFactor;
    else if (l && !m) n = Math.sin(2 * j * Math.PI), a = -IDLE_BODY_HEAD_PULSE_AMOUNT * Math.abs(n), b = n * IDLE_ARM_ROTATION_ANGLE, c = -b, d = 0, e = 0, f = n * IDLE_HEAD_ROTATION_ANGLE_AMOUNT, g = Math.sin(4 * j * Math.PI) * IDLE_BODY_HEAD_PULSE_AMOUNT * IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR;
    else if (m) {
        const C = 18, D = 54;
        p.velocityY > 0 ? h = JUMP_BODY_TILT_ANGLE * (1 - Math.min(1, Math.max(0, p.velocityY / C))) : h = JUMP_BODY_TILT_ANGLE * (1 - Math.min(1, Math.max(0, Math.abs(p.velocityY) / D)));
        const E = Math.min(1, Math.abs(p.velocityY) / Math.max(C, D));
        d = -E * JUMP_LEG_OPPOSITE_ROTATION_ANGLE, e = E * JUMP_LEG_WAVE_ANGLE, b = E * JUMP_ARM_WAVE_ANGLE, c = -.7 * b, f = .5 * h, g = 0, a = 0
    }
    ctx.translate(o + playerSize / 2, q + playerSize / 2), ctx.scale(p.direction, 1), m && ctx.rotate(h * p.direction), ctx.translate(-(o + playerSize / 2), -(q + playerSize / 2));

    function t(a, b, c, d, e, f = 0, g = playerSize, h = playerSize) {
        if (!a || !a.complete) return;
        ctx.save();
        const i = o + b, j = q + c;
        ctx.translate(i + d, j + e), ctx.rotate(f), ctx.drawImage(a, -d, -e, g, h), ctx.restore()
    }

    const v = p.customizations || {};
    const playerClothes = v.clothes;
    const playerPants = v.pants;

    t(imageSet.leg, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, e);
    if (playerPants && playerPants !== 'none') {
        const pantsLegImage = characterCustomImages.pants_leg[playerPants];
        if (pantsLegImage && pantsLegImage.complete) {
            t(pantsLegImage, backLegOffsetX, 0, legPivotInImageX, legPivotInImageY, e);
        }
    }
    t(imageSet.arm, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, c);
    
    if (playerClothes && "none" !== playerClothes) {
        const clothesArmImage = characterCustomImages.clothes_arm[playerClothes];
        if (clothesArmImage && clothesArmImage.complete) t(clothesArmImage, backArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, c);
    }

    t(imageSet.leg, frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, d);
    if (playerPants && playerPants !== 'none') {
        const pantsLegImage = characterCustomImages.pants_leg[playerPants];
        if (pantsLegImage && pantsLegImage.complete) {
            t(pantsLegImage, frontLegOffsetX, 0, legPivotInImageX, legPivotInImageY, d);
        }
    }
    ctx.drawImage(imageSet.body, o, q + a, playerSize, playerSize);

    if (playerPants && playerPants !== 'none') {
        const pantsImage = characterCustomImages.pants[playerPants];
        if (pantsImage && pantsImage.complete) {
            ctx.drawImage(pantsImage, o, q + a, playerSize, playerSize);
        }
    }

    if (playerClothes && "none" !== playerClothes) {
        const clothesImage = characterCustomImages.clothes[playerClothes];
        if (clothesImage && clothesImage.complete) {
            ctx.drawImage(clothesImage, o, q + a, playerSize, playerSize);
        }
    }
    const u = headInitialOffsetY + a + g;
    t(imageSet.head, 0, u, headPivotInImageX, headPivotInImageY, f);
    t(imageSet.eye, LEFT_EYE_BASE_X_REL_HEAD_TL + r, u + EYE_BASE_Y_REL_HEAD_TL + s, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);
    t(imageSet.eye, RIGHT_EYE_BASE_X_REL_HEAD_TL + r, u + EYE_BASE_Y_REL_HEAD_TL + s, eyePivotInImage, eyePivotInImage, 0, eyeSpriteSize, eyeSpriteSize);

    const accessories = v.accessories;
    if (accessories && "none" !== accessories) {
        const accessoriesImage = characterCustomImages.accessories[accessories];
        if (accessoriesImage && accessoriesImage.complete) {
            ctx.save();
            ctx.translate(o + headPivotInImageX, q + u + headPivotInImageY);
            ctx.rotate(f);
            ctx.drawImage(accessoriesImage, -headPivotInImageX, -headPivotInImageY, playerSize, playerSize);
            ctx.restore();
        }
    }

    const y = v.beard;
    if (y && "none" !== y) {
        const z = characterCustomImages.beard[y];
        if (z && z.complete) {
            ctx.save();
            ctx.translate(o + headPivotInImageX, q + u + BEARD_VERTICAL_OFFSET + headPivotInImageY - BEARD_VERTICAL_OFFSET);
            ctx.rotate(f);
            drawFilteredCharacterPart(ctx, z, -headPivotInImageX, -(headPivotInImageY - BEARD_VERTICAL_OFFSET), playerSize, playerSize, v.beardSaturation, v.beardHue, v.beardBrightness);
            ctx.restore();
        }
    }

    const w = v.hair;
    if (w && "none" !== w) {
        const x = characterCustomImages.hair[w];
        x && x.complete && (ctx.save(), ctx.translate(o + headPivotInImageX, q + u + HAIR_VERTICAL_OFFSET + headPivotInImageY - HAIR_VERTICAL_OFFSET), ctx.rotate(f), drawFilteredCharacterPart(ctx, x, -headPivotInImageX, -(headPivotInImageY - HAIR_VERTICAL_OFFSET), playerSize, playerSize, v.hairSaturation, v.hairHue, v.hairBrightness), ctx.restore())
    }
    
    const B = v.hat;
    if (B && "none" !== B) {
        const C = characterCustomImages.hat[B];
        C && C.complete && t(C, 0, u - Math.round(20 * (playerSize / 32)) + 44, headPivotInImageX, headPivotInImageY - 44 - -Math.round(20 * (playerSize / 32)), f, playerSize, playerSize)
    }

    const D = v.rightHandItem;
    if (D && D !== ITEM_NONE) {
        const E = exampleCustomItemPaths.items[D], F = characterCustomImages.items[D];
        E && F && F.complete && t(F, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, b, E.width, E.height)
    }

    t(imageSet.arm, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, b);
    
    if (playerClothes && "none" !== playerClothes) {
        const clothesArmImage = characterCustomImages.clothes_arm[playerClothes];
        if (clothesArmImage && clothesArmImage.complete) t(clothesArmImage, frontArmOffsetX, 0, originalArmPivotInImageX, originalArmPivotInImageY, b);
    }

    ctx.restore();

    if (p.username) {
        const ROD_TIP_OFFSET_X = playerSize * 1.07; 
        const ROD_TIP_OFFSET_Y = -playerSize * 0.32;
        if (p.customizations && p.customizations.rightHandItem === ITEM_ROD) {
            p.rodTipWorldX = p.x + playerSize / 2 + (frontArmOffsetX + originalArmPivotInImageX - playerSize / 2) * p.direction + (ROD_TIP_OFFSET_X * Math.cos(b) - ROD_TIP_OFFSET_Y * Math.sin(b)) * p.direction;
            p.rodTipWorldY = p.y + playerSize / 2 + (0 + originalArmPivotInImageY - playerSize / 2) + (ROD_TIP_OFFSET_X * Math.sin(b) + ROD_TIP_OFFSET_Y * Math.cos(b));
            if (p.id === localPlayer.id) {
                localPlayer.rodTipWorldX = p.rodTipWorldX;
                localPlayer.rodTipWorldY = p.rodTipWorldY;
            }
        } else {
            p.rodTipWorldX = null;
            p.rodTipWorldY = null;
            if (p.id === localPlayer.id) {
                localPlayer.rodTipWorldX = null;
                localPlayer.rodTipWorldY = null;
            }
        }
        
        ctx.font = `${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`;
        const usernameText = p.username || p.id.substring(0, 5);
        const usernameMetrics = ctx.measureText(usernameText);
        const usernameWidth = usernameMetrics.width;
        
        const flagWidth = 24;
        const flagHeight = 18;
        const flagPadding = 5;
        
        const totalWidth = usernameWidth + flagPadding + flagWidth;
        const playerCenterX = p.x + playerSize / 2;
        
        const startX = playerCenterX - totalWidth / 2;
        const usernameY = p.y - 14 + a;

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
    
        if (p.meActionText && Date.now() < p.meActionExpiry) {
            ctx.fillStyle = "#C77CFF";
            ctx.font = `italic ${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`;
            ctx.textAlign = "center";
            const meText = `* ${p.meActionText} *`;
            const meTextY = p.y - 36 + a;
            ctx.strokeText(meText, playerCenterX, meTextY);
            ctx.fillText(meText, playerCenterX, meTextY);
        }

        if (p.chatMessageText && Date.now() < p.chatMessageExpiry) {
            ctx.fillStyle = "white";
            ctx.font = `${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`;
            ctx.textAlign = "center";
            
            const chatText = p.chatMessageText;
            // Umieść tekst czatu nad głową. Jeśli jest też komenda /me, umieść go jeszcze wyżej.
            const chatTextY = (p.meActionText && Date.now() < p.meActionExpiry) ? p.y - 58 + a : p.y - 36 + a;
            
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(chatText, playerCenterX, chatTextY);
            ctx.fillText(chatText, playerCenterX, chatTextY);
        }
    }
}


function drawCustomizationMenu() {
    const ROLLER_X_OFFSET_FROM_PLAYER = playerSize * currentZoomLevel * 1.5;
    const ROLLER_Y_OFFSET = -playerSize * currentZoomLevel * 0.5;
    const ROLLER_ITEM_SPACING = 50;
    const ALPHAS = [0.2, 0.5, 1, 0.5, 0.2];
    const FONT_SIZES = [16, 20, 24, 20, 16];
    const playerScreenX = (localPlayer.x - cameraX) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;

    const menuX = playerScreenX + (playerSize / 2) * currentZoomLevel + ROLLER_X_OFFSET_FROM_PLAYER;
    const menuY = playerScreenY + (playerSize / 2) * currentZoomLevel + ROLLER_Y_OFFSET;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (customizationMenuState === 'adjust_value') {
        const category = customizationCategories[selectedCategoryIndex];
        const property = colorProperties[selectedColorPropertyIndex];
        const propertyCapitalized = property.charAt(0).toUpperCase() + property.slice(1);
        const key = category + propertyCapitalized;
        let currentDisplayValue, minDisplay, maxDisplay, internalMin, internalMax;
        if (property === 'hue') {
            currentDisplayValue = localPlayer.customizations[key];
            minDisplay = HAIR_HUE_MIN;
            maxDisplay = HAIR_HUE_MAX;
        } else {
            internalMin = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MIN : HAIR_SATURATION_MIN) : (property === 'brightness' ? BEARD_BRIGHTNESS_MIN : BEARD_SATURATION_MIN));
            internalMax = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MAX : HAIR_SATURATION_MAX) : (property === 'brightness' ? BEARD_BRIGHTNESS_MAX : BEARD_SATURATION_MAX));
            currentDisplayValue = mapToDisplayRange(localPlayer.customizations[key], internalMin, internalMax);
            minDisplay = 0;
            maxDisplay = 100;
        }
        const valuesToShow = [];
        if (currentDisplayValue > minDisplay) valuesToShow.push(currentDisplayValue - 1);
        else valuesToShow.push(null);
        valuesToShow.push(currentDisplayValue);
        if (currentDisplayValue < maxDisplay) valuesToShow.push(currentDisplayValue + 1);
        else valuesToShow.push(null);
        for (let i = -1; i <= 1; i++) {
            const value = valuesToShow[i + 1];
            if (value === null) continue;
            const text = String(value);
            const yPos = menuY + i * ROLLER_ITEM_SPACING;
            const isCenter = (i === 0);
            const alpha = isCenter ? ALPHAS[2] : ALPHAS[1];
            const fontSize = isCenter ? FONT_SIZES[2] : FONT_SIZES[1];
            ctx.fillStyle = isCenter ? `rgba(255, 255, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
            ctx.font = `${fontSize}px ${PIXEL_FONT}`;
            ctx.fillText(text, menuX, yPos);
        }
    } else { 
        let listToDraw;
        let selectedIndex;
        if (customizationMenuState === 'category') {
            listToDraw = customizationCategories;
            selectedIndex = selectedCategoryIndex;
        } else if (customizationMenuState === 'value') {
            const currentCategory = customizationCategories[selectedCategoryIndex];
            listToDraw = customizationOptions[currentCategory];
            selectedIndex = currentCustomizationOptionIndices[currentCategory];
        } else {
            listToDraw = colorProperties;
            selectedIndex = selectedColorPropertyIndex;
        }
        const displayRange = 2;
        for (let i = -displayRange; i <= displayRange; i++) {
            let itemIndex = (selectedIndex + i + listToDraw.length) % listToDraw.length;
            const text = listToDraw[itemIndex].toUpperCase();
            const yPos = menuY + i * ROLLER_ITEM_SPACING;
            const focusIndex = i + displayRange;
            const alpha = ALPHAS[focusIndex];
            const fontSize = FONT_SIZES[focusIndex];
            ctx.fillStyle = (i === 0) ? `rgba(255, 255, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
            ctx.font = `${fontSize}px ${PIXEL_FONT}`;
            ctx.fillText(text, menuX, yPos);
        }
    }
    ctx.restore();
}

function drawFishingBar(p) {
    const barScreenX = DEDICATED_GAME_WIDTH / 2 - FISHING_BAR_WIDTH / 2;
    const barScreenY = DEDICATED_GAME_HEIGHT - 100;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barScreenX, barScreenY, FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT);
    const powerWidth = p.castingPower * FISHING_BAR_WIDTH;
    ctx.fillStyle = `hsl(${120 * (1 - p.castingPower)}, 100%, 50%)`;
    ctx.fillRect(barScreenX, barScreenY, powerWidth, FISHING_BAR_HEIGHT);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(barScreenX, barScreenY, FISHING_BAR_WIDTH, FISHING_BAR_HEIGHT);
    ctx.restore();
}

function drawDanglingBobber(ctx, p) {
    if (!p || p.customizations.rightHandItem !== ITEM_ROD || p.hasLineCast || p.rodTipWorldX === null) {
        if (p.danglingBobber) p.danglingBobber.initialized = false;
        return;
    }

    const bobber = p.danglingBobber;
    const floatImage = characterCustomImages.items.float;
    if (!floatImage || !floatImage.complete) return;

    const GRAVITY = 0.4;
    const DAMPING = 0.79;
    const ROPE_LENGTH = 8;
    const ITERATIONS = 1;

    if (!bobber.initialized) {
        bobber.x = p.rodTipWorldX;
        bobber.y = p.rodTipWorldY + ROPE_LENGTH;
        bobber.oldX = bobber.x;
        bobber.oldY = bobber.y;
        bobber.initialized = true;
    }
    
    let velocityX = (bobber.x - bobber.oldX) * DAMPING;
    let velocityY = (bobber.y - bobber.oldY) * DAMPING;

    bobber.oldX = bobber.x;
    bobber.oldY = bobber.y;

    bobber.x += velocityX;
    bobber.y += velocityY;
    bobber.y += GRAVITY;

    for (let i = 0; i < ITERATIONS; i++) {
        const dx = bobber.x - p.rodTipWorldX;
        const dy = bobber.y - p.rodTipWorldY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const difference = ROPE_LENGTH - distance;
        const percent = difference / distance / 2;
        
        const offsetX = dx * percent;
        const offsetY = dy * percent;

        bobber.x += offsetX;
        bobber.y += offsetY;
    }

    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);

    ctx.strokeStyle = '#ffffff7e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
    ctx.lineTo(bobber.x, bobber.y);
    ctx.stroke();

    ctx.drawImage(
        floatImage,
        bobber.x - FLOAT_SIZE / 2,
        bobber.y - FLOAT_SIZE / 2,
        FLOAT_SIZE,
        FLOAT_SIZE * 2
    );

    ctx.restore();
}

function drawFishingLine(p) {
    if (!p.hasLineCast || p.rodTipWorldX === null || p.floatWorldX === null) return;

    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);

    const floatImage = characterCustomImages.items.float;

    if (floatImage && floatImage.complete) {
        bobberAnimationTime += BOBBER_ANIMATION_SPEED;
        let verticalOffset = Math.sin(bobberAnimationTime) * BOBBER_VERTICAL_OSCILLATION;
        let rotation = 0;

        if (p.id === localPlayer.id && (fishingManager.isBiting || fishingManager.isFishHooked)) {
            const biteTime = Date.now();
            verticalOffset += Math.sin(biteTime / 100) * 8; 
            rotation = Math.sin(biteTime / 150) * 0.7; 
        }

        const bobberAnimatedX = p.floatWorldX;
        const bobberAnimatedY = p.floatWorldY + verticalOffset;

        ctx.strokeStyle = '#ffffff6b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
        ctx.lineTo(bobberAnimatedX, bobberAnimatedY);
        ctx.stroke();

        ctx.save();
        ctx.translate(bobberAnimatedX, bobberAnimatedY);
        ctx.rotate(rotation);
        ctx.drawImage(floatImage, -FLOAT_SIZE / 2, -FLOAT_SIZE - 8, FLOAT_SIZE, FLOAT_SIZE * 2);
        ctx.restore();
    } else {
        ctx.strokeStyle = '#ffffff6b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
        ctx.lineTo(p.floatWorldX, p.floatWorldY + 24);
        ctx.stroke();

        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(p.floatWorldX, p.floatWorldY, 10, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

function drawSingleTutorialImage(imageInfo) {
    if (!imageInfo) return;
    const image = tutorialImages[imageInfo.key];
    if (!image || !image.complete) return;
    const playerScreenX = (localPlayer.x - cameraX + playerSize / 2) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;
    const drawWidth = image.width * TUTORIAL_IMAGE_SCALE;
    const drawHeight = image.height * TUTORIAL_IMAGE_SCALE;
    const x = playerScreenX - drawWidth / 2;
    const y = playerScreenY + TUTORIAL_Y_OFFSET - drawHeight + imageInfo.yOffset;
    const rockingAngle = Math.sin(Date.now() / 1000 * TUTORIAL_ROCKING_SPEED) * (TUTORIAL_ROCKING_ANGLE_DEGREES * Math.PI / 180);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = imageInfo.alpha;
    ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
    ctx.rotate(rockingAngle);
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
}

function drawTutorialHelper() {
    if (tutorial.state === 'finished') return;
    drawSingleTutorialImage(tutorial.fadingOutImage);
    drawSingleTutorialImage(tutorial.activeImage);
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
        ctx.save();
        ctx.translate(insect.x + renderedSize / 2, insect.y + renderedSize / 2);
        ctx.rotate(angleInRadians);
        if (typeof insect.hue === 'number') ctx.filter = `hue-rotate(${insect.hue}deg)`;
        ctx.drawImage(insectImage, sourceX, sourceY, INSECT_TILE_SIZE, INSECT_TILE_SIZE, -renderedSize / 2, -renderedSize / 2, renderedSize, renderedSize);
        ctx.restore();
    }
}

// W pliku script.js

function updateAndDrawCaughtFishAnimations() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const now = Date.now();

    for (let i = caughtFishAnimations.length - 1; i >= 0; i--) {
        const anim = caughtFishAnimations[i];
        const player = playersInRoom[anim.playerId];

        if (!player) {
            caughtFishAnimations.splice(i, 1);
            continue;
        }

        if (now > anim.startTime + FISH_ANIMATION_DURATION + FISH_DISPLAY_DURATION) {
            caughtFishAnimations.splice(i, 1);
            continue;
        }
        
        const startScreenPos = {
            x: (anim.startPos.x - cameraX) * currentZoomLevel,
            y: (anim.startPos.y - cameraY) * currentZoomLevel
        };
        
        const targetScreenPos = {
            x: (player.x + playerSize / 2 - cameraX) * currentZoomLevel,
            y: (player.y - 60 - cameraY) * currentZoomLevel
        };

        let currentPos;
        const elapsed = now - anim.startTime;

        if (elapsed < FISH_ANIMATION_DURATION) {
            const progress = elapsed / FISH_ANIMATION_DURATION;
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            currentPos = {
                x: lerp(startScreenPos.x, targetScreenPos.x, easeProgress),
                y: lerp(startScreenPos.y, targetScreenPos.y, easeProgress)
            };
            
            const fishImg = allItemImages[anim.fishName];

            if (fishImg && fishImg.complete) {
                // ======================= POCZĄTEK ZMIAN =======================
                const BASE_ANIMATION_SCALE = 2.1;
                const finalScale = BASE_ANIMATION_SCALE * (anim.scale || 1); // Używamy 'anim.scale'
                const fishWidth = fishImg.width * finalScale;
                const fishHeight = fishImg.height * finalScale;
                // ======================== KONIEC ZMIAN =========================
                ctx.drawImage(fishImg, currentPos.x - fishWidth / 2, currentPos.y - fishHeight / 2, fishWidth, fishHeight);
            }
        } else {
            currentPos = targetScreenPos;
            
            const fishImg = allItemImages[anim.fishName];

            if (fishImg && fishImg.complete) {
                // ======================= POCZĄTEK ZMIAN =======================
                const BASE_ANIMATION_SCALE = 2.1;
                const finalScale = BASE_ANIMATION_SCALE * (anim.scale || 1); // Używamy 'anim.scale' również tutaj
                const fishWidth = fishImg.width * finalScale;
                const fishHeight = fishImg.height * finalScale;
                // ======================== KONIEC ZMIAN =========================
                ctx.drawImage(fishImg, currentPos.x - fishWidth / 2, currentPos.y - fishHeight / 2, fishWidth, fishHeight);
            }

            const tier = anim.tier || 0;
            const tierConfig = FISH_TIER_CONFIG[tier];
            const text = `${anim.fishName} ${anim.size}cm`;
            
            ctx.font = tierConfig.font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            const displayElapsed = elapsed - FISH_ANIMATION_DURATION;
            const FADE_TIME = 700;
            let textAlpha = 1;

            if (displayElapsed < FADE_TIME) {
                textAlpha = displayElapsed / FADE_TIME;
            } else if (displayElapsed > FISH_DISPLAY_DURATION - FADE_TIME) {
                textAlpha = (FISH_DISPLAY_DURATION - displayElapsed) / FADE_TIME;
            }
            
            const starImg = tierConfig.imageKey ? starImages[tierConfig.imageKey] : null;
            const padding = 4;
            
            const FISH_TIER_STAR_SCALE = 1.3;
            const starDrawWidth = starImg ? starImg.width * FISH_TIER_STAR_SCALE : 0;
            const starDrawHeight = starImg ? starImg.height * FISH_TIER_STAR_SCALE : 0;
            
            const textWidth = ctx.measureText(text).width;
            const totalWidth = textWidth + (starImg ? starDrawWidth + padding : 0);

            if (starImg && starImg.complete) {
                const starX = currentPos.x + 85- totalWidth / 2;
                const starY = currentPos.y + 30 - starDrawHeight / 2 - 4;
                ctx.globalAlpha = textAlpha;
                ctx.drawImage(starImg, starX, starY, starDrawWidth, starDrawHeight);
                ctx.globalAlpha = 1.0;
            }

            const textX = currentPos.x + (starImg ? (starDrawWidth + padding) / 2 : 0);
            
            ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * textAlpha})`;
            ctx.fillText(text, textX-2, currentPos.y - 52);

            ctx.fillStyle = tierConfig.color.replace(', 1)', `, ${textAlpha})`);
            ctx.fillText(text, textX, currentPos.y - 50);
        }
    }
    ctx.restore();
}




// ====================================================================
// === SEKCJA 3: LOGIKA SIECIOWA (z modyfikacjami) ===
// ====================================================================

function createFullItemObject(itemName) {
    const baitData = fishingManager.baitData[itemName];
    if (baitData) {
        return {
            name: itemName,
            image: allItemImages[itemName],
            tier: baitData.tier || 0,
            description: baitData.description || '' // <-- DODAJ TĘ LINIĘ
        };
    }

    const hookData = fishingManager.hookData[itemName];
    if (hookData) {
        return {
            name: itemName,
            image: allItemImages[itemName],
            tier: hookData.tier || 0,
            description: hookData.description || '' // <-- DODAJ TĘ LINIĘ
        };
    }

    const fishData = fishingManager.getFishData();
    for (const biome in fishData) {
        if (fishData[biome][itemName]) {
            const itemDetails = fishData[biome][itemName];
            return {
                name: itemName,
                image: allItemImages[itemName],
                tier: itemDetails.tier || 0,
                description: itemDetails.description || '' // <-- DODAJ TĘ LINIĘ
            };
        }
    }
    
    console.warn(`Nie znaleziono szczegółowych danych dla przedmiotu: ${itemName}. Tworzenie podstawowego obiektu.`);
    return {
        name: itemName,
        image: allItemImages[itemName],
        tier: 0,
        description: 'No description available.' // <-- DODAJ TĘ LINIĘ
    };
}

function initializeSignaling() {
    signalingSocket = io();
    signalingSocket.on('connect', () => {
        console.log('Connected to the signaling server.', signalingSocket.id);
        showNotification('Connected to the signaling server.', 'success');
    });
    signalingSocket.on('roomListUpdate', (hosts) => {
        availableRooms = hosts;
        if (!currentRoom) {
            roomListUl.innerHTML = '';
            if (Object.keys(hosts).length === 0) {
                roomListUl.innerHTML = '<li>No available rooms. Create one!</li>';
            } else {
                for (let peerId in hosts) {
                    if (isHost && peerId === peer?.id) continue;

                    const room = hosts[peerId];
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${room.name} (Players: ${room.playerCount})</span><button data-peer-id="${peerId}">Join</button>`;
                    li.querySelector('button').addEventListener('click', () => joinRoom(peerId));
                    roomListUl.appendChild(li);
                }
            }
        }
    });
    signalingSocket.on('roomRemoved', (removedRoomId) => {
        if (hostConnection && hostConnection.peer === removedRoomId) {
            showNotification('The room you were in has been removed by the host.', 'warning');
            leaveCurrentRoomUI();
        }
    });
}


function initializePeer(callback) {
    if (peer && !peer.destroyed) return callback(peer.id);
    const peerConfig = {
        debug: 3,
        config: { 'iceServers': [ { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" } ] }
    };
    peer = new Peer(undefined, peerConfig);
    peer.on('open', (id) => {
        console.log('My ID in the P2P network (from the PeerJS cloud server): ' + id);
        if (callback) callback(id);
    });
    peer.on('error', (err) => {
        console.error("MAIN PEER OBJECT ERROR: ", err);
        showNotification(`A fatal PeerJS error occurred: ${err.type}`, 'error');
    });
    peer.on('disconnected', () => {
        console.warn(`PEERJS: Disconnected from PeerJS broker server. I'm trying to reconnect...`);
        showNotification('Disconnected from PeerJS server. Reconnecting...', 'warning');
    });
    peer.on('close', () => {
        console.error(`PEERJS: The connection to the broker server has been permanently closed. New connections cannot be made.`);
        showNotification('Connection to PeerJS server closed permanently.', 'error');
    });
}

function onSuccessfulJoin(roomData, hostPeerId = null) {
    // Krok 1: Upewnij się, że dane pokoju są poprawne
    if (!roomData || !roomData.name) {
        if (hostPeerId && availableRooms[hostPeerId] && availableRooms[hostPeerId].name) {
            roomData = roomData || {};
            roomData.name = availableRooms[hostPeerId].name;
        } else {
            roomData = roomData || {};
            roomData.name = "Undefined Room";
            console.warn(`[WARN] Failed to determine room name.`);
        }
    }
    
    // Krok 2: Ustaw wszystkie zmienne stanu gry
    currentRoom = roomData;
    playersInRoom = roomData.playersInRoom;
    if (roomData.gameData) {
        currentWorldWidth = roomData.gameData.worldWidth;
        biomeManager.worldWidth = currentWorldWidth;
        if (typeof roomData.gameData.initialCycleRotation === 'number' && typeof roomData.gameData.roomCreationTimestamp === 'number') {
            const timeElapsedSeconds = (Date.now() - roomData.gameData.roomCreationTimestamp) / 1000;
            const rotationToAdd = timeElapsedSeconds * cycleManager.ROTATION_SPEED;
            cycleManager.rotation = roomData.gameData.initialCycleRotation + rotationToAdd;
        }
        npcManager.loadCurrentBiomeAssets(roomData.gameData.biome, () => npcManager.spawnNPCs(roomData.gameData));
        biomeManager.setBiome(roomData.gameData.biome);
        biomeManager.setVillageData(roomData.gameData.villageType, roomData.gameData.villageXPosition, roomData.gameData.placedBuildings);
        biomeManager.initializeGroundPlants(roomData.gameData.groundPlants || []);
        biomeManager.initializeTrees(roomData.gameData.trees || []);
        if (biomeManager.initializePiers) biomeManager.initializePiers(roomData.gameData.piers || []);
        
        pierSupportData = [];
        const serverPiers = roomData.gameData.piers || [];
        const SCALED_TILE_SIZE = 120;
        serverPiers.forEach(pier => {
            const newPierSupport = { sections: [] };
            for (let i = 0; i < pier.sections.length - 1; i++) {
                const piles = [];
                const sectionWidth = SCALED_TILE_SIZE;
                const PILE_GFX_WIDTH = 32;
                const PILE_RENDER_SCALE = 1.5;
                const PILE_RENDER_WIDTH = PILE_GFX_WIDTH * PILE_RENDER_SCALE;
                const margin = 25;
                const maxStartPosition = sectionWidth - PILE_RENDER_WIDTH - margin;
                const pileX = margin + Math.random() * (maxStartPosition - margin);
                const rotation = (Math.random() * 16 - 8) * (Math.PI / 180);
                piles.push({ x: pileX, rotation: rotation, scale: PILE_RENDER_SCALE });
                newPierSupport.sections.push({ piles: piles });
            }
            pierSupportData.push(newPierSupport);
        });
        insectsInRoom = roomData.gameData.insects || [];
    }
    const myId = peer ? peer.id : null;
    if (myId && playersInRoom[myId]) {
        const serverPlayerState = playersInRoom[myId];
        Object.assign(localPlayer, serverPlayerState);
        if (serverPlayerState.customizations) Object.assign(localPlayer.customizations, serverPlayerState.customizations);
        Object.assign(localPlayerCustomizations, localPlayer.customizations);
        for (const category in customizationOptions) {
            const selectedOption = localPlayer.customizations[category];
            const options = customizationOptions[category];
            if (options) {
                const index = options.indexOf(selectedOption);
                if (index !== -1) currentCustomizationOptionIndices[category] = index;
            }
        }
    }
    const playerInitialCenterX = localPlayer.x + playerSize / 2;
    const playerInitialCenterY = localPlayer.y + playerSize / 2;
    const visibleWorldWidthAtInit = DEDICATED_GAME_WIDTH / currentZoomLevel;
    const visibleWorldHeightAtInit = DEDICATED_GAME_HEIGHT / currentZoomLevel;
    cameraX = playerInitialCenterX - visibleWorldWidthAtInit / 2;
    cameraY = playerInitialCenterY - visibleWorldHeightAtInit / 2;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > currentWorldWidth - visibleWorldWidthAtInit) cameraX = currentWorldWidth - visibleWorldWidthAtInit;
    if (cameraY < 0) cameraY = 0;
    if (cameraY > DEDICATED_GAME_HEIGHT - visibleWorldHeightAtInit) cameraY = DEDICATED_GAME_HEIGHT - visibleWorldHeightAtInit;
    
    // Krok 3: Zmień UI - ukryj menu, pokaż grę i DOPIERO TERAZ pokaż czat
    lobbyDiv.style.display = 'none';
    gameContainerDiv.style.display = 'block';
    resetMenuUI();
    showNotification(`Successfully joined room: "${currentRoom.name}"`, 'success');
    
    // NOWOŚĆ: Uruchom mechanizm sprawdzania hosta po stronie gościa
    if (!isHost) {
        lastPingTime = Date.now(); // Ustawiamy początkowy czas
        if (hostPingTimeout) clearInterval(hostPingTimeout); // Wyczyść stary na wszelki wypadek

        hostPingTimeout = setInterval(() => {
            if (Date.now() - lastPingTime > HOST_TIMEOUT_LIMIT) {
                console.warn('[GUEST-HEARTBEAT] Host przestał odpowiadać. Powrót do lobby.');
                showNotification('Connection to the host timed out.', 'error');
                leaveCurrentRoomUI(); // Używamy tej samej funkcji co przycisk "Leave"
            }
        }, 5000); // Sprawdzaj co 5 sekund
    }

    
    // <<< KLUCZOWA POPRAWKA: Wywołanie jest tutaj, na samym końcu funkcji.
    chatManager.show(); 
}


// ====================================================================
// === SEKCJA 4: GŁÓWNA PĘTLA GRY I KOMUNIKACJA (z modyfikacjami) ===
// ====================================================================

function updateTutorialAnimations() {
    if (tutorial.state === 'finished') return;
    const now = Date.now();
    if (tutorial.fadingOutImage) {
        const elapsed = now - tutorial.fadingOutImage.startTime;
        if (elapsed >= TUTORIAL_FADE_DURATION_MS) {
            tutorial.fadingOutImage = null;
        } else {
            const progress = elapsed / TUTORIAL_FADE_DURATION_MS;
            tutorial.fadingOutImage.alpha = 1 - progress;
            tutorial.fadingOutImage.yOffset = -TUTORIAL_FADE_UP_DISTANCE * progress;
        }
    }
    if (tutorial.activeImage) {
        const elapsed = now - tutorial.activeImage.startTime;
        if (elapsed < TUTORIAL_FADE_DURATION_MS) {
            tutorial.activeImage.alpha = elapsed / TUTORIAL_FADE_DURATION_MS;
        } else {
            tutorial.activeImage.alpha = 1;
        }
    }
}

function sendPlayerInput() {
    const isPlayerInputLocked = isCustomizationMenuOpen;
    const inputPayload = {
        keys: isPlayerInputLocked ? {} : keys,
        currentMouseX: localPlayer.currentMouseX,
        currentMouseY: localPlayer.currentMouseY,
    };
    if (hostConnection) hostConnection.send({ type: 'playerInput', payload: inputPayload });
}

function sendPlayerAction(type, payload = {}) {
    if (hostConnection) hostConnection.send({ type: 'playerAction', payload: { type, payload } });
}


function drawWorldItems(ctx) {
    if (!worldItems || worldItems.length === 0) return;

    const ITEM_IMAGE_SIZE = inventoryManager.SLOT_SIZE * 0.7;
    const STAR_SIZE = 24;
    const ROCKING_SPEED = 2.5;
    const ROCKING_AMPLITUDE_DEGREES = 15;
    const ROCKING_AMPLITUDE_RADIANS = ROCKING_AMPLITUDE_DEGREES * (Math.PI / 180);
    const time = Date.now() / 1000;

    worldItems.forEach(item => {
        const rotation = Math.sin(time * ROCKING_SPEED) * ROCKING_AMPLITUDE_RADIANS;
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(rotation);
        
        const itemImage = allItemImages[item.data.name];

        if (itemImage && itemImage.complete) {
            ctx.drawImage(itemImage, -ITEM_IMAGE_SIZE / 2, -ITEM_IMAGE_SIZE / 2, ITEM_IMAGE_SIZE, ITEM_IMAGE_SIZE);
            if (item.data.tier && item.data.tier > 0) {
                const tierConfig = FISH_TIER_CONFIG[item.data.tier];
                if (tierConfig && tierConfig.imageKey) {
                    const starImg = starImages[tierConfig.imageKey];
                    if (starImg && starImg.complete) {
                        const starX = ITEM_IMAGE_SIZE / 2 - STAR_SIZE;
                        const starY = ITEM_IMAGE_SIZE / 2 - STAR_SIZE;
                        ctx.drawImage(starImg, starX, starY, STAR_SIZE, STAR_SIZE);
                    }
                }
            }
        }
        ctx.restore();
    });
}

const MAX_DELTA_TIME = 1 / 1; 

function gameLoop(currentTime) {
    function updateLocalPlayerMovement() {
        const PLAYER_WALK_SPEED = 5;
        const DECELERATION_FACTOR = 0.9;
        const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.1;
        let targetVelocityX = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) targetVelocityX = -PLAYER_WALK_SPEED;
        else if (keys['ArrowRight'] || keys['KeyD']) targetVelocityX = PLAYER_WALK_SPEED;
        localPlayer.velocityX = targetVelocityX !== 0 ? targetVelocityX : localPlayer.velocityX * DECELERATION_FACTOR;
        if (Math.abs(localPlayer.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) localPlayer.velocityX = 0;
        localPlayer.x += localPlayer.velocityX;
        localPlayer.x = Math.max(0, Math.min(currentWorldWidth - playerSize, localPlayer.x));
    }

     if (!lastTime) lastTime = currentTime;
    
    let deltaTime = (currentTime - lastTime) / 1000;
    deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);
    
    lastTime = currentTime;
    if (currentRoom === null) {
        requestAnimationFrame(gameLoop);
        return;
    }

     if (currentRoom && currentRoom.gameData) {
        const playerRect = { x: localPlayer.x, y: localPlayer.y, width: playerSize, height: playerSize };
        const playerCenterX = localPlayer.x + playerSize / 2;

        const campRect = {
            x: biomeManager.campsiteX || 0,
            y: biomeManager.campsiteY || 0,
            width: biomeManager.campsiteWidth || 256,
            height: biomeManager.campsiteHeight || 256
        };
        isPlayerInCampZone = (playerRect.x < campRect.x + campRect.width &&
                              playerRect.x + playerRect.width > campRect.x &&
                              playerRect.y < campRect.y + campRect.height &&
                              playerRect.y + playerRect.height > campRect.y);
        
        // =================================================================
        // === POCZĄTEK ZMIAN: UJEDNOLICONA LOGIKA AKTYWNEJ INTERAKCJI ===
        // =================================================================
        let activeInteraction = { type: 'none', distance: Infinity };

        // Krok 1: Sprawdź obóz
        if (isPlayerInCampZone && tutorial.state === 'finished') {
            const campCenterX = campRect.x + campRect.width / 2;
            activeInteraction = {
                type: 'camp',
                distance: Math.abs(playerCenterX - campCenterX)
            };
        }

        // Krok 2: Znajdź najbliższego NPC
        
        // WAŻNA POPRAWKA: Resetujemy globalną zmienną bez `let`, aby nie tworzyć nowej lokalnej.
        closestNpc = null; 
        let isPlayerStillNearTradingNpc = false;

        npcManager.npcs.forEach(npc => {
            const npcCenterX = npc.x + playerSize / 2;
            const distance = Math.abs(playerCenterX - npcCenterX);

            if (tradingManager.isTradeWindowOpen && tradingManager.activeNpc?.id === npc.id && distance < npcManager.INTERACTION_RADIUS) {
                isPlayerStillNearTradingNpc = true;
            }

            if (distance < npcManager.INTERACTION_RADIUS && distance < activeInteraction.distance) {
                activeInteraction = { type: 'npc', distance: distance };
                closestNpc = npc; // Tutaj przypisujemy do globalnej zmiennej
            }
        });

        // Automatyczne zamykanie handlu
        if (tradingManager.isTradeWindowOpen && !isPlayerStillNearTradingNpc) {
            tradingManager.stopTrading();
        }

        // Krok 3: Ustaw stany podświetlenia i interakcji dla wszystkich NPC
        npcManager.npcs.forEach(npc => {
            npc.isHighlighted = (npc === closestNpc);
            npc.isInteracting = (tradingManager.isTradeWindowOpen && tradingManager.activeNpc?.id === npc.id);
        });

        // Krok 4: Ustaw komunikaty
        showCampPrompt = (activeInteraction.type === 'camp');
        let showNpcTradePrompt = (activeInteraction.type === 'npc');

        if (biomeManager.setPlayerProximity) {
            biomeManager.setPlayerProximity(showCampPrompt);
        }
        
        if (showCampPrompt) {
            campPromptAlpha = Math.min(1, campPromptAlpha + PROMPT_FADE_SPEED * deltaTime);
        } else {
            campPromptAlpha = Math.max(0, campPromptAlpha - PROMPT_FADE_SPEED * deltaTime);
        }

        if (showNpcTradePrompt && !tradingManager.isTradeWindowOpen) {
            npcPromptAlpha = Math.min(1, npcPromptAlpha + PROMPT_FADE_SPEED * deltaTime);
        } else {
            npcPromptAlpha = Math.max(0, npcPromptAlpha - PROMPT_FADE_SPEED * deltaTime);
        }
        // ===============================================================
        // === KONIEC ZMIAN: UJEDNOLICONA LOGIKA AKTYWNEJ INTERAKCJI ===
        // ===============================================================
    }

    if (insectsInRoom.length > 0 && currentRoom.gameData) {
        const worldWidth = currentRoom.gameData.worldWidth || 0;
        insectsInRoom.forEach(insect => {
             const time = (Date.now() / 1000) + (insect.timeOffset || 0);
             insect.anchorX += (insect.drift || 0);
             if (insect.anchorX < 0 || insect.anchorX > worldWidth) insect.drift *= -1;
             insect.x = (insect.anchorX || 0) + Math.sin(time * (insect.hSpeed || 1)) * (insect.hAmp || 100);
             insect.y = (insect.baseY || 500) + Math.cos(time * (insect.vSpeed || 1)) * (insect.vAmp || 80);
             insect.angle = Math.cos(time * (insect.hSpeed || 1)) * (insect.hAmp || 100) * (insect.hSpeed || 1) * 0.5;
             insect.animationFrame = ((insect.animationFrame || 0) + 1) % 16;
        });
    }

    if (Object.keys(playersInRoom).length > 0 && currentRoom.gameData) {
        const PLAYER_WALK_SPEED = 5;
        const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.1;
        const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - currentRoom.gameData.groundLevel - playerSize;
        for (const id in playersInRoom) {
            const p = playersInRoom[id];
            const isOnGround = (p.y >= groundY_target_for_player_top - 1 && p.y <= groundY_target_for_player_top + 1);
            p.isWalking = Math.abs(p.velocityX || 0) > MIN_VELOCITY_FOR_WALK_ANIMATION && isOnGround;
            
            if (p.meActionText && Date.now() >= p.meActionExpiry) {
        p.meActionText = null;
        p.meActionExpiry = null;
    }

     if (p.chatMessageText && Date.now() >= p.chatMessageExpiry) {
                p.chatMessageText = null;
                p.chatMessageExpiry = null;
            }
            const isStationaryHorizontal = Math.abs(p.velocityX || 0) < MIN_VELOCITY_FOR_WALK_ANIMATION;
            p.isIdle = !p.isWalking && !p.isJumping && isStationaryHorizontal && isOnGround;
            if (p.isWalking) {
                 const speedFactor = Math.abs((p.velocityX || 0) / PLAYER_WALK_SPEED);
                 p.animationFrame = ((p.animationFrame || 0) + (1 * speedFactor)) % animationCycleLength;
                 p.idleAnimationFrame = 0;
            } else if (p.isIdle) {
                 p.animationFrame = 0;
                 p.idleAnimationFrame = ((p.idleAnimationFrame || 0) + 1) % IDLE_ANIM_CYCLE_LENGTH;
            } else {
                 p.animationFrame = 0; p.idleAnimationFrame = 0;
            }
        }
    }

    bobberAnimationTime += BOBBER_ANIMATION_SPEED;
    biomeManager.updateAnimations(deltaTime);
    cycleManager.update(deltaTime);
    starManager.update(deltaTime);
    npcManager.update(deltaTime);
    // Usunęliśmy particleManager.update(deltaTime); - teraz robi to fishingManager
    updateTutorialAnimations();
    sendPlayerInput();
    updateLocalPlayerMovement();
    reconcilePlayerPosition();
    updatePlayerAudio(); // <--- DODAJ TĘ LINIĘ TUTAJ
    updateCamera();
    

    
    const playerCenterScreenX = (localPlayer.x + playerSize / 2 - cameraX) * currentZoomLevel;
    const playerCenterScreenY = (localPlayer.y + playerSize / 2 - cameraY) * currentZoomLevel;

    // Zmieniono z 3 na 4 sloty i z 2 na 3 przerwy w obliczeniach
    const inventoryWidth = 4 * inventoryManager.SLOT_SIZE + 3 * inventoryManager.GRID_GAP;
    const inventoryHeight = 4 * inventoryManager.SLOT_SIZE + 3 * inventoryManager.GRID_GAP;

    // Ustaw pozycję ekwipunku względem stabilnego środka gracza, a nie jego lewego górnego rogu.
    // Odejmujemy szerokość ekwipunku i dodatkowy margines, aby umieścić go po lewej stronie gracza.
    invX = playerCenterScreenX - inventoryWidth - 140; 
    if (invX < 10) invX = 10; // Upewnij się, że ekwipunek nie wychodzi poza lewą krawędź ekranu.

    // Wyśrodkowujemy ekwipunek w pionie względem środka gracza.
    invY = playerCenterScreenY - (inventoryHeight / 2); 
    if (invY < 10) invY = 10; // Upewnij się, że ekwipunek nie wychodzi poza górną krawędź.
    if (invY + inventoryHeight > canvas.height - 10) invY = canvas.height - inventoryHeight - 10; // Sprawdź dolną krawędź.
    
    const inventoryOrigin = { x: invX, y: invY };
    inventoryManager.origin = inventoryOrigin;
    // ======================== KONIEC ZMIAN ========================
    tradingManager.update(deltaTime);
    inventoryManager.update(deltaTime);
    if (localPlayer.isCasting) {
        localPlayer.fishingBarTime += FISHING_SLIDER_SPEED;
        localPlayer.fishingBarSliderPosition = (Math.sin(localPlayer.fishingBarTime) + 1) / 2;
        localPlayer.castingPower = localPlayer.fishingBarSliderPosition;
    }
    
    if (localPlayer.hasLineCast && !previousHasLineCast) {
    fishingManager.startFishing(
        inventoryManager.getBaitItem(),
        inventoryManager.getHookItem()
    );

    // =======================================================
    // === POCZĄTEK ZMIAN: SEKWENCJA SAMOUCZKA WĘDKOWANIA ===
    // =======================================================
    const now = Date.now();
    const firstInfo7Start = now + 1000;
    const firstInfo7Duration = 4000; // 2s fade in, 2s fade out
    const pause = 2000;
    const secondInfo7Start = firstInfo7Start + firstInfo7Duration + pause;
    const info1Start = secondInfo7Start + firstInfo7Duration;

    timedTutorialsQueue = [
        { key: 'info7', startTime: firstInfo7Start, duration: 4000, endTime: firstInfo7Start + 4000 },
        { key: 'info8', startTime: secondInfo7Start, duration: 4000, endTime: secondInfo7Start + 4000 },
        { key: 'info1', startTime: info1Start, duration: 4000, endTime: info1Start + 4000 }
    ];
    // =======================================================
    // === KONIEC ZMIAN: SEKWENCJA SAMOUCZKA WĘDKOWANIA ===
    // =======================================================
}
    
    if (!localPlayer.hasLineCast && previousHasLineCast) {
        fishingManager.cancelFishing();
    }
    previousHasLineCast = localPlayer.hasLineCast;
    

    applyCycleColorBalance(); 
    ctx.clearRect(0, 0, DEDICATED_GAME_WIDTH, DEDICATED_GAME_HEIGHT);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY + 2150);
    ctx.rotate(cycleManager.rotation);
    cycleManager.drawBackground(ctx);
    ctx.restore();

    starManager.draw(ctx, cycleManager);

    ctx.save();
    ctx.translate(centerX, centerY + 2150);
    ctx.rotate(cycleManager.rotation);
    cycleManager.drawMoon(ctx);
    ctx.restore();

    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);
    biomeManager.drawClouds(ctx, cameraX, cameraY);
    
    biomeManager.drawParallaxBackground(ctx, cameraX, cameraY, DEDICATED_GAME_WIDTH / currentZoomLevel);
            
    if (currentRoom?.gameData?.biome) {
        const { biome: b, groundLevel: g } = currentRoom.gameData;
        biomeManager.drawBuildings(ctx,g,cameraX,DEDICATED_GAME_WIDTH/currentZoomLevel);
        biomeManager.drawBackgroundBiomeGround(ctx,b,g);
        biomeManager.drawCampsite(ctx);
        biomeManager.drawBackgroundPlants(ctx);
        biomeManager.drawBackgroundTrees(ctx);
    }
    
    const allCharacters = [...Object.values(playersInRoom), ...npcManager.npcs];
    allCharacters.sort((a,b)=>(a.y+playerSize)-(b.y+playerSize)).forEach(p => {
        if (p.username) drawPlayer(p);
        else npcManager.drawPlayer(p, npcManager.npcAssets);
    });
    drawWorldItems(ctx);

    if(currentRoom?.gameData?.biome){
        const {biome:b,groundLevel:g} = currentRoom.gameData;

        biomeManager.drawForegroundTrees(ctx);
        biomeManager.drawFireplaceParticles(ctx);
        biomeManager.drawFireplace(ctx);
        biomeManager.drawLightEffect(ctx);
        biomeManager.drawForegroundPlants(ctx);

        drawInsects();
                
        biomeManager.drawForegroundBiomeGround(ctx,b,g);
        biomeManager.drawSwimmingFish(ctx);
        drawPierSupports(ctx);
        
        if (biomeManager.drawPiers) biomeManager.drawPiers(ctx);
        
        biomeManager.drawWater(ctx,b,cameraX);

        
        // === POCZĄTEK TWOJEJ POPRAWKI ===
        // Dodaj tę jedną linię, aby narysować chmury na pierwszym planie

        // Usunęliśmy particleManager.draw(ctx); - teraz robi to fishingManager
    }

    ctx.restore();

    for(const id in playersInRoom) drawFishingLine(playersInRoom[id]);
    
    drawDanglingBobber(ctx, localPlayer);
    
    drawTutorialHelper();
    drawCampPrompt();
    drawNpcTradePrompt();
    drawTimedTutorials(); // <-- DODAJ TĘ LINIĘ
    if(isCustomizationMenuOpen) drawCustomizationMenu();
    if(localPlayer.isCasting) drawFishingBar(localPlayer);
    
    inventoryManager.draw(ctx, PIXEL_FONT);
    tradingManager.draw(ctx);

// ======================= POCZĄTEK KODU DEBUGUJĄCEGO =======================
ctx.save();
ctx.setTransform(1, 0, 0, 1, 0, 0); // Resetuj wszystkie transformacje, aby rysować w przestrzeni ekranu

    let bobberScreenPos = null;
if (localPlayer.hasLineCast && localPlayer.floatWorldX !== null) {
    bobberScreenPos = {
        x: (localPlayer.floatWorldX - cameraX) * currentZoomLevel,
        y: (localPlayer.floatWorldY - cameraY) * currentZoomLevel
    };
}

// Zaktualizowane wywołanie z dodatkowym parametrem bobberScreenPos
fishingManager.update(deltaTime, localPlayer, bobberScreenPos);

fishingManager.draw(ctx, localPlayer, bobberScreenPos, cameraX, currentZoomLevel);

    updateAndDrawCaughtFishAnimations();

    fishingManager.updateAndDrawDugBaitAnimations(ctx, playersInRoom, cameraX, cameraY, currentZoomLevel);

    requestAnimationFrame(gameLoop);

}


// ====================================================================
// === SEKCJA 5: OBSŁUGA UI i P2P (z modyfikacjami) ===
// ====================================================================

const joinGameBtn = document.getElementById('joinGameBtn');
const optionsBtn = document.getElementById('optionsBtn');
const menuStatus = document.getElementById('menuStatus');
const MAX_PLAYERS_PER_ROOM = 4;

// --- GŁÓWNA FUNKCJA MATCHMAKINGU ---

function transitionToNewRoom() {
    // Pokaż ekran ładowania, aby ukryć grę
    loadingManager.show(() => {
        // Krok 1: Użyj naszej nowej, scentralizowanej funkcji do posprzątania wszystkiego
        console.log('[TRANSITION] Cleaning up current room state...');
        leaveCurrentRoomUI();

        // Krok 2: Uruchom logikę szukania nowego pokoju.
        // Dajemy małe opóźnienie, aby dać czas na pełne zniszczenie starego obiektu Peer
        // i uniknąć potencjalnych wyścigów z serwerem brokera.
        setTimeout(() => {
             console.log('[TRANSITION] Starting new matchmaking process...');
             initiateMatchmakingProcess(true);
        }, 250);
    });
}

function initiateMatchmakingProcess(isTransition = false) {
    if (!isTransition) {
        // Jeśli to standardowe kliknięcie w menu, zablokuj przyciski i pokaż ekran ładowania
        joinGameBtn.disabled = true;
        optionsBtn.disabled = true;
        loadingManager.show(() => startNetworkHandshake());
    } else {
        // Jeśli to przejście, ekran ładowania jest już widoczny, więc od razu startujemy
        startNetworkHandshake();
    }
}

function startNetworkHandshake() {
    menuStatus.textContent = 'Initializing network...';
    loadingManager.updateProgress(10);

    initializePeer((peerId) => {
        if (!peerId) {
            showNotification("Network error: Could not initialize.", 'error');
            resetMenuUI();
            loadingManager.hide();
            return;
        }
        localPlayer.id = peerId;
        loadingManager.updateProgress(30);

        menuStatus.textContent = 'Searching for an available game...';
        
        const joinableRooms = Object.values(availableRooms)
            .filter(room => room.playerCount < MAX_PLAYERS_PER_ROOM);

        if (joinableRooms.length > 0) {
            tryToJoinRooms(joinableRooms);
        } else {
            menuStatus.textContent = 'No available games found. Creating a new one...';
            loadingManager.updateProgress(50);
            createNewRoom();
        }
    });
}

// Stary event listener jest teraz uproszczony do wywołania naszej nowej funkcji
joinGameBtn.addEventListener('click', () => {
    soundManager.play('menuClick'); // <-- NOWA LINIA
    initiateMatchmakingProcess(false)
});
function tryToJoinRooms(rooms) {
    let roomIndex = 0;
    
    function tryNext() {
        if (roomIndex >= rooms.length) {
            // Próbowaliśmy dołączyć do wszystkich i się nie udało
            menuStatus.textContent = 'Could not connect to available games. Creating a new one...';
            loadingManager.updateProgress(50);
            createNewRoom();
            return;
        }

        const roomToJoin = rooms[roomIndex];
        menuStatus.textContent = `Attempting to join "${roomToJoin.name}"...`;
        loadingManager.updateProgress(60 + (roomIndex * 5)); // Mały postęp dla każdej próby
        
        // Zwiększamy indeks na potrzeby następnej próby
        roomIndex++;

        // Czyścimy poprzednie połączenie, jeśli istnieje
        if (hostConnection) hostConnection.close();

        // === POPRAWIONA LINIA ===
        // Błąd był tutaj: użyto "roomToToJoin" zamiast "roomToJoin"
        hostConnection = peer.connect(roomToJoin.peerId, { reliable: true });
        
        // Timeout połączenia - jeśli nie uda się połączyć w 10 sekund, próbujemy następny pokój
        const connectionTimeout = setTimeout(() => {
            showNotification(`Connection to "${roomToJoin.name}" timed out.`, 'warning');
            hostConnection.close(); // Ważne, aby zamknąć próbę połączenia
            tryNext();
        }, 4000); // <--- ZMIANA NA 4 SEKUNDY

        hostConnection.on('open', () => {
            clearTimeout(connectionTimeout); // Anuluj timeout, bo się udało
            loadingManager.updateProgress(85); // Prawie gotowe!
            console.log(`[GUEST] Połączenie P2P z hostem ${roomToJoin.peerId} otwarte.`);
            signalingSocket.emit('notify-join', roomToJoin.peerId);
            hostConnection.send({ type: 'requestJoin', payload: localPlayer });
            // onSuccessfulJoin zostanie wywołane, gdy host odpowie
        });

        hostConnection.on('data', (data) => handleDataFromServer(data));
        
        hostConnection.on('error', (err) => {
            clearTimeout(connectionTimeout);
            console.error(`[GUEST] Błąd połączenia z ${roomToJoin.peerId}:`, err);
            showNotification(`Failed to connect to "${roomToJoin.name}".`, 'error');
            tryNext();
        });

        hostConnection.on('close', () => {
            // Jeśli nie jesteśmy jeszcze w grze, to znaczy, że połączenie zostało zamknięte przedwcześnie
            if (!currentRoom) {
                clearTimeout(connectionTimeout);
                console.warn(`[GUEST] Połączenie z ${roomToJoin.peerId} zamknięte przed dołączeniem.`);
                // Celowo nie wywołujemy tryNext() ponownie, aby uniknąć pętli,
                // bo "close" może być wywołane zaraz po timeoucie.
            } else {
                 showNotification('The host closed the room or the connection was lost.', 'warning');
                 leaveCurrentRoomUI();
            }
        });
    }

    tryNext(); // Rozpocznij proces prób dołączenia
}

function createNewRoom() {
    isHost = true;
    
    console.log(`[HOST-UI] Creating a new room with Peer ID: ${localPlayer.id}. Starting worker...`);
    gameHostWorker = new Worker('js/host-worker.js');
    
    gameHostWorker.onmessage = (event) => {
        const { type, peerId: targetPeerId, message } = event.data;
        // Host nasłuchuje na wiadomości od workera...
        if (type === 'broadcast' || (type === 'sendTo' && targetPeerId === localPlayer.id)) {
            handleDataFromServer(message);
        }
        // ...i przekazuje je do odpowiednich klientów
        if (type === 'broadcast') {
            Object.values(hostPeerConnections).forEach(conn => conn.send(message));
        } else if (type === 'sendTo' && targetPeerId !== localPlayer.id) {
            const conn = hostPeerConnections[targetPeerId];
            if (conn) {
                 // Sprawdzamy, czy połączenie na pewno jest otwarte przed wysłaniem
                 if (conn.open) {
                    conn.send(message);
                 } else {
                    console.warn(`[HOST-UI] Tried to send message to a non-open connection: ${targetPeerId}`);
                 }
            }
        }
    };

    const roomName = `Game of ${localPlayer.username}`;
    // Informujemy worker, aby zainicjalizował stan gry
    gameHostWorker.postMessage({ type: 'start', payload: { id: localPlayer.id, username: localPlayer.username, color: localPlayer.color, customizations: localPlayer.customizations } });

    // Rejestrujemy się jako host na serwerze sygnałowym
    signalingSocket.emit('register-host', { peerId: localPlayer.id, name: roomName });

    // === POCZĄTEK KLUCZOWEJ ZMIANY ===
    peer.on('connection', (conn) => {
        console.log(`[HOST-UI] Incoming connection request from: ${conn.peer}`);

        // Czekaj na PEŁNE otwarcie połączenia, zanim cokolwiek zrobisz!
        conn.on('open', () => {
            console.log(`[HOST-UI] Connection with ${conn.peer} is now open and ready!`);
            
            // 1. Dopiero TERAZ dodaj połączenie do listy aktywnych
            hostPeerConnections[conn.peer] = conn;

            // 2. Obsługuj dane przychodzące od tego klienta
            conn.on('data', (data) => {
                // Gdy gracz poprosi o dołączenie, przekaż jego dane do workera
                if (data.type === 'requestJoin') {
                    gameHostWorker.postMessage({ type: 'addPlayer', payload: { peerId: conn.peer, initialPlayerData: data.payload } });
                } else {
                    // Inne dane (input, akcje) również przekaż do workera
                    gameHostWorker.postMessage({ type: data.type, payload: { ...data.payload, peerId: conn.peer } });
                }
            });

            // 3. Obsłuż rozłączenie klienta
            conn.on('close', () => {
                console.log(`[HOST-UI] Connection with ${conn.peer} closed.`);
                delete hostPeerConnections[conn.peer];
                gameHostWorker.postMessage({ type: 'removePlayer', payload: { peerId: conn.peer } });
                signalingSocket.emit('notify-leave', localPlayer.id);
            });
        });
        
        conn.on('error', (err) => {
            console.error(`[HOST-UI] Connection error with ${conn.peer}:`, err);
        });
    });
    // === KONIEC KLUCZOWEJ ZMIANY ===
    
    // Ustawiamy "fałszywe" połączenie dla hosta, aby mógł komunikować się z workerem
    hostConnection = {
        send: (data) => gameHostWorker.postMessage({ type: data.type, payload: { ...data.payload, peerId: localPlayer.id } })
    };
    
    // Dodajemy samego hosta do gry (z opóźnieniem, aby worker był gotowy)
    setTimeout(() => {
        console.log('[HOST-UI] Adding host as a player...');
        gameHostWorker.postMessage({ type: 'addPlayer', payload: { peerId: localPlayer.id, initialPlayerData: localPlayer } });
    }, 100);
}

function resetMenuUI() {
    joinGameBtn.disabled = false;
    // optionsBtn pozostaje nieaktywny zgodnie z założeniem, ale można go tu włączyć w przyszłości
    optionsBtn.disabled = false;
    menuStatus.textContent = '';
}


// --- FUNKCJE OBSŁUGI SIECI I STANU GRY ---

function initializeSignaling() {
    signalingSocket = io();
    signalingSocket.on('connect', () => {
        console.log('Connected to the signaling server.', signalingSocket.id);
        showNotification('Connected to the signaling server.', 'success');
    });

    // Ta funkcja już nie aktualizuje listy w HTML, tylko zapisuje dane
    signalingSocket.on('roomListUpdate', (hosts) => {
        availableRooms = hosts;
        console.log('Updated room list received:', availableRooms);
    });

    signalingSocket.on('roomRemoved', (removedRoomId) => {
        if (hostConnection && hostConnection.peer === removedRoomId) {
            showNotification('The room you were in has been removed by the host.', 'warning');
            leaveCurrentRoomUI();
        }
    });
}

function initializePeer(callback) {
    if (peer && !peer.destroyed) return callback(peer.id);
    const peerConfig = {
        debug: 2, // Poziom logowania dla PeerJS
        config: { 'iceServers': [ { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' } ] }
    };
    peer = new Peer(undefined, peerConfig);
    peer.on('open', (id) => {
        console.log('My ID in the P2P network: ' + id);
        if (callback) callback(id);
    });
    peer.on('error', (err) => {
        console.error("MAIN PEER OBJECT ERROR: ", err);
        resetMenuUI();
    });
    peer.on('disconnected', () => {
        showNotification('Disconnected from PeerJS server. Reconnecting...', 'warning');
    });
    peer.on('close', () => {
        showNotification('Connection to PeerJS server closed permanently.', 'error');
        resetMenuUI();
    });
}

function onSuccessfulJoin(roomData, hostPeerId = null) {
    if (!roomData || !roomData.name) {
        if (hostPeerId && availableRooms[hostPeerId] && availableRooms[hostPeerId].name) {
            roomData = roomData || {};
            roomData.name = availableRooms[hostPeerId].name;
        } else {
            roomData = roomData || {};
            roomData.name = "Undefined Room";
        }
    }
    currentRoom = roomData;
    playersInRoom = roomData.playersInRoom;
    if (roomData.gameData) {
        currentWorldWidth = roomData.gameData.worldWidth;
        biomeManager.worldWidth = currentWorldWidth;
        if (typeof roomData.gameData.initialCycleRotation === 'number' && typeof roomData.gameData.roomCreationTimestamp === 'number') {
            const timeElapsedSeconds = (Date.now() - roomData.gameData.roomCreationTimestamp) / 1000;
            const rotationToAdd = timeElapsedSeconds * cycleManager.ROTATION_SPEED;
            cycleManager.rotation = roomData.gameData.initialCycleRotation + rotationToAdd;
        }
        npcManager.loadCurrentBiomeAssets(roomData.gameData.biome, () => npcManager.spawnNPCs(roomData.gameData));
        biomeManager.setBiome(roomData.gameData.biome);
        biomeManager.setVillageData(roomData.gameData.villageType, roomData.gameData.villageXPosition, roomData.gameData.placedBuildings);
        biomeManager.initializeGroundPlants(roomData.gameData.groundPlants || []);
        biomeManager.initializeTrees(roomData.gameData.trees || []);
        if (biomeManager.initializePiers) biomeManager.initializePiers(roomData.gameData.piers || []);
        
        pierSupportData = [];
        const serverPiers = roomData.gameData.piers || [];
        const SCALED_TILE_SIZE = 120;
        serverPiers.forEach(pier => {
            const newPierSupport = { sections: [] };
            for (let i = 0; i < pier.sections.length - 1; i++) {
                const piles = [];
                const sectionWidth = SCALED_TILE_SIZE;
                const PILE_GFX_WIDTH = 32;
                const PILE_RENDER_SCALE = 1.5;
                const PILE_RENDER_WIDTH = PILE_GFX_WIDTH * PILE_RENDER_SCALE;
                const margin = 25;
                const maxStartPosition = sectionWidth - PILE_RENDER_WIDTH - margin;
                const pileX = margin + Math.random() * (maxStartPosition - margin);
                const rotation = (Math.random() * 16 - 8) * (Math.PI / 180);
                piles.push({ x: pileX, rotation: rotation, scale: PILE_RENDER_SCALE });
                newPierSupport.sections.push({ piles: piles });
            }
            pierSupportData.push(newPierSupport);
        });
        insectsInRoom = roomData.gameData.insects || [];
    }
    const myId = peer ? peer.id : null;
    if (myId && playersInRoom[myId]) {
        const serverPlayerState = playersInRoom[myId];
        Object.assign(localPlayer, serverPlayerState);
        if (serverPlayerState.customizations) Object.assign(localPlayer.customizations, serverPlayerState.customizations);
        Object.assign(localPlayerCustomizations, localPlayer.customizations);
        for (const category in customizationOptions) {
            const selectedOption = localPlayer.customizations[category];
            const options = customizationOptions[category];
            if (options) {
                const index = options.indexOf(selectedOption);
                if (index !== -1) currentCustomizationOptionIndices[category] = index;
            }
        }
    }
    const playerInitialCenterX = localPlayer.x + playerSize / 2;
    const playerInitialCenterY = localPlayer.y + playerSize / 2;
    const visibleWorldWidthAtInit = DEDICATED_GAME_WIDTH / currentZoomLevel;
    const visibleWorldHeightAtInit = DEDICATED_GAME_HEIGHT / currentZoomLevel;
    cameraX = playerInitialCenterX - visibleWorldWidthAtInit / 2;
    cameraY = playerInitialCenterY - visibleWorldHeightAtInit / 2;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > currentWorldWidth - visibleWorldWidthAtInit) cameraX = currentWorldWidth - visibleWorldWidthAtInit;
    if (cameraY < 0) cameraY = 0;
    if (cameraY > DEDICATED_GAME_HEIGHT - visibleWorldHeightAtInit) cameraY = DEDICATED_GAME_HEIGHT - visibleWorldHeightAtInit;
    
    lobbyDiv.style.display = 'none';
    gameContainerDiv.style.display = 'block';
    resetMenuUI();
    showNotification(`Successfully joined room: "${currentRoom.name}"`, 'success');
    
     loadingManager.updateProgress(100);
    setTimeout(() => { // Dajmy chwilę na 100%
        loadingManager.hide(() => {
            // Po zniknięciu ekranu ładowania, finalizujemy przejście
            lobbyDiv.style.display = 'none';
            gameContainerDiv.style.display = 'block';
            chatManager.show();
        });
    }, 200);

}

function handleDataFromServer(data) {
    switch (data.type) {
    case 'playerLeftRoom': {
        const { peerId, username } = data.payload;
        if (playersInRoom[peerId]) {
            delete playersInRoom[peerId];
            chatManager.addMessage(null, `${username} left the room.`, true);
        }
        break;
    }
     case 'hostClosing': {
            showNotification('Host zamknął pokój.', 'warning');
            // Natychmiastowo wywołaj funkcję powrotu do lobby,
            // nie czekając na formalne zamknięcie połączenia.
            leaveCurrentRoomUI();
            break;
        }

        case 'awardStarterItem': {
            const { itemName, targetSlot } = data.payload;
            const fullItemObject = createFullItemObject(itemName);
            if (fullItemObject) {
                inventoryManager.placeItemInSlot(fullItemObject, targetSlot);
            }
            break;
        }

        case 'ping':
            if (!isHost && hostConnection) {
                lastPingTime = Date.now(); // Zaktualizuj czas ostatniego kontaktu z hostem
                // Odeślij odpowiedź 'pong' jako akcję gracza
                sendPlayerAction('pong'); 
            }
            break;

        // NOWE FRAGMENTY START
        case 'directMessageReceived': {
            const { senderUsername, message } = data.payload;
            chatManager.addMessage(senderUsername, message, false, 'dm-received', null);
            break;
        }

        case 'directMessageSent': {
            const { recipientUsername, message } = data.payload;
            chatManager.addMessage(null, message, false, 'dm-sent', recipientUsername);
            break;
        }

        case 'systemNotification': {
            const { message, notificationType } = data.payload;
            showNotification(message, notificationType);
            break;
        }
        // NOWE FRAGMENTY KONIEC

        case 'meCommandBroadcast': {
            const { peerId, username, action } = data.payload;
            const player = playersInRoom[peerId];
            if (player) {
                player.meActionText = action;
                player.meActionExpiry = Date.now() + 8000; // Wyświetlaj tekst przez 8 sekund
            }
            chatManager.addMeActionMessage(username, action);
            break;
        }

         case 'overheadMessageBroadcast': {
            const { peerId, message } = data.payload;
            const player = playersInRoom[peerId];
            if (player) {
                player.chatMessageText = message;
                // Wiadomość będzie widoczna przez 5 sekund
                player.chatMessageExpiry = Date.now() + 5000;
            }
            break;
        }

        case 'chatMessageBroadcast': {
        const { username, message } = data.payload;
        chatManager.addMessage(username, message);
        break;
        }
        case 'playerJoinedRoomNotification': {
            chatManager.addMessage(null, `${data.payload.username} joined the room.`, true);
            break;
        }
        case 'playerJoinedRoomNotification': {
            chatManager.addMessage(null, `${data.payload.username} joined the room.`, true);
            break;
        }
        case 'playerLeftRoomNotification': {
            chatManager.addMessage(null, `${data.payload.username} left the room.`, true);
            break;
        }

        // === POCZĄTEK NOWEGO KODU ===
        case 'fishCaughtNotification': {
            const { username, fishName, size } = data.payload;
            const message = `${username} caught a  ${fishName} (${size}cm)!`;
            chatManager.addMessage(null, message, true); // true, bo to powiadomienie
            break;
        }

        case 'itemPickedUp': {
            const itemData = data.payload;
            const fullItemObject = createFullItemObject(itemData.name);
            if (fullItemObject) {
                if (!inventoryManager.addItem(fullItemObject)) {
                    showNotification('Inventory full!', 'warning');
                } else {
                    soundManager.play('info'); // <-- DODANA LINIA
                    showNotification(`Picked up: ${itemData.name}`, 'success');
                }
            }
            break;
        }
        case 'fishCaughtBroadcast': {
            const catchingPlayer = playersInRoom[data.payload.playerId];
            if (catchingPlayer && allItemImages[data.payload.fishName]) {
                caughtFishAnimations.push({ ...data.payload, startTime: Date.now(), startPos: { x: catchingPlayer.floatWorldX, y: catchingPlayer.floatWorldY } });
            }
            break;
        }
        case 'baitDugBroadcast': {
            if (playersInRoom[data.payload.playerId] && allItemImages[data.payload.bait.name]) {
                fishingManager.startDiggingAnimation(data.payload.playerId, data.payload.bait, data.payload.startPos);
            }
            break;
        }
        case 'dugBaitAwarded': {
            const { baitData } = data.payload;
            const fullBaitObject = createFullItemObject(baitData.name);
            if (fullBaitObject) {
                const wasAdded = inventoryManager.addItem(fullBaitObject);
                showNotification(wasAdded ? `Found: ${baitData.name}` : 'Inventory full', wasAdded ? 'success' : 'warning');
            }
            break;
        }
        case 'roomJoined':
            onSuccessfulJoin(data.payload, hostConnection?.peer);
            break;
        case 'gameStateUpdate': {
    const { players: playersData, worldItems: worldItemsData } = data.payload;

    // Aktualizuj dane graczy, ale zachowaj stan /me
    playersData.forEach(serverPlayer => {
        const clientPlayer = playersInRoom[serverPlayer.id];
        
        if (clientPlayer) {
            // === POCZĄTEK FINALNEJ POPRAWKI ===
            if (serverPlayer.hasLineCast) {
                const isBobberOnWater = serverPlayer.floatWorldY >= (biomeManager.WATER_TOP_Y_WORLD - 15);
                const wasBobberOnWater = clientPlayer.wasBobberOnWater || false;

                // --- Logika DŹWIĘKU (jednorazowa) ---
                // Odtwarzamy dźwięk tylko w momencie, gdy spławik ląduje na wodzie.
                if (isBobberOnWater && !wasBobberOnWater) {
                    soundManager.play('waterSplash');
                }

                // --- Logika ANIMACJI (ciągła, gdy spławik się rusza) ---
                // Przywracamy oryginalną logikę animacji, która była zależna od ruchu.
                const isBobberMoving = Math.abs(serverPlayer.floatWorldX - clientPlayer.floatWorldX) > 0.1 || Math.abs(serverPlayer.floatWorldY - clientPlayer.floatWorldY) > 0.1;
                if (isBobberOnWater && isBobberMoving) {
                    fishingManager.createWaterSplash(serverPlayer.floatWorldX, serverPlayer.floatWorldY, 5, 0.5);
                }
                
                // Zapisz stan na potrzeby następnej klatki (kluczowe dla dźwięku)
                clientPlayer.wasBobberOnWater = isBobberOnWater;
            } else {
                // Resetuj flagę, gdy wędka jest zwinięta
                clientPlayer.wasBobberOnWater = false;
            }
            // === KONIEC FINALNEJ POPRAWKI ===

            // Zachowaj aktualny stan /me, który jest zarządzany tylko po stronie klienta
            const meText = clientPlayer.meActionText;
            const meExpiry = clientPlayer.meActionExpiry;
            // ======================= POCZĄTEK ZMIAN =======================
            const chatText = clientPlayer.chatMessageText;
            const chatExpiry = clientPlayer.chatMessageExpiry;
            // ======================== KONIEC ZMIAN =========================


            // Zaktualizuj gracza danymi z serwera
            Object.assign(clientPlayer, serverPlayer);

            // Przywróć stan /me, nadpisując ewentualne `null` z serwera
            clientPlayer.meActionText = meText;
            clientPlayer.meActionExpiry = meExpiry;
            // ======================= POCZĄTEK ZMIAN =======================
            clientPlayer.chatMessageText = chatText;
            clientPlayer.chatMessageExpiry = chatExpiry;
            // ======================== KONIEC ZMIAN =========================
        } else {
            // Jeśli gracz jest nowy, po prostu go dodaj
            playersInRoom[serverPlayer.id] = serverPlayer;
        }
    });

    worldItems = worldItemsData;
    if (playersInRoom[localPlayer.id]) {
        const castingState = { isCasting: localPlayer.isCasting, castingPower: localPlayer.castingPower };
        Object.assign(localPlayer, playersInRoom[localPlayer.id]);
        Object.assign(localPlayer, castingState);
    }
    break;
}
        

        case 'playerCustomizationUpdated':
            if (playersInRoom[data.payload.id]) playersInRoom[data.payload.id].customizations = data.payload.customizations;
            break;
        case 'grassSwaying':
            if (biomeManager) biomeManager.startSwayAnimation(data.payload.grassId, data.payload.direction);
            break;
    }
}


leaveRoomBtn.addEventListener('click', () => {
    soundManager.play('menuClick'); // <-- NOWA LINIA
    // Logika dla gościa pozostaje prosta - po prostu czyści swój stan.
    if (!isHost) {
        leaveCurrentRoomUI();
        return;
    }

    // Logika dla hosta zamykającego pokój
    if (isHost) {
        console.log('[HOST-UI] Host is closing the room. Notifying clients...');

        // 1. Opcjonalnie: Wyślij wiadomość do podłączonych graczy, że pokój jest zamykany
        const closingMessage = { type: 'hostClosing', payload: {} };
        Object.values(hostPeerConnections).forEach(conn => {
            if (conn && conn.open) {
                try {
                    conn.send(closingMessage);
                } catch (e) {
                    console.error("Error sending closing message to client:", e);
                }
            }
        });

        // 2. Daj sieci krótką chwilę na wysłanie wiadomości
        setTimeout(() => {
            // === KLUCZOWA ZMIANA: WYŚLIJ NOWY EVENT DO SERWERA SYGNALIZACYJNEGO ===
            // Robimy to PRZED zniszczeniem obiektu peer, gdy jego ID jest jeszcze ważne.
            if (peer?.id) {
                console.log(`[HOST-UI] Emitting 'host-closing-room' to signaling server for peerId: ${peer.id}`);
                signalingSocket.emit('host-closing-room', { peerId: peer.id });
            }
            
            // 4. Użyj naszej scentralizowanej funkcji do posprzątania całej reszty (w tym peer.destroy())
            leaveCurrentRoomUI();
        }, 200);
    }
});



function leaveCurrentRoomUI() {
    console.log("Leaving room. Initiating full cleanup...");
    gameContainerDiv.style.display = 'none';
    lobbyDiv.style.display = 'block';

    if (hostPingTimeout) {
        clearInterval(hostPingTimeout);
        hostPingTimeout = null;
    }

    // Zamknij połączenie P2P z hostem (TYLKO jeśli jesteśmy gościem)
    if (!isHost && hostConnection && typeof hostConnection.close === 'function') {
        hostConnection.close();
    }
    hostConnection = null;

    // === POCZĄTEK KLUCZOWEJ POPRAWKI ===
    // Jeśli byliśmy hostem, najpierw zamknij wszystkie połączenia z klientami
    if (isHost) {
        Object.values(hostPeerConnections).forEach(conn => conn.close());
        hostPeerConnections = {};
    }
    
    // Zatrzymaj i usuń worker (jeśli byliśmy hostem)
    if (gameHostWorker) {
        gameHostWorker.terminate();
        gameHostWorker = null; // Ustaw na null OD RAZU po terminacji
    }

    // Usuń WSZYSTKIE listenery z obiektu peer, aby uniknąć wywołań "zombie"
    if (peer) {
        peer.off('connection');
        peer.off('open');
        peer.off('error');
        peer.off('disconnected');
        peer.off('close');
    }
    // === KONIEC KLUCZOWEJ POPRAWKI ===

    // Zniszcz obiekt PeerJS, aby uzyskać nowe, czyste ID przy następnym połączeniu
    if (peer && !peer.destroyed) {
        peer.destroy();
    }
    peer = null;

    // Resetuj stan gry
    isHost = false;
    currentRoom = null;
    playersInRoom = {};
    insectsInRoom = [];
    pierSupportData = [];
    worldItems = [];
    npcManager.clear();

    // Resetuj UI i stan lokalny
    resetMenuUI();
    currentWorldWidth = DEDICATED_GAME_WIDTH * 2;
    biomeManager.worldWidth = currentWorldWidth;
    biomeManager.setBiome('jurassic');
    keys = {};
    cameraX = 0;
    cameraY = 0;
    isCustomizationMenuOpen = false;
    chatManager.hide();
    
    console.log('Cleanup complete. Returned to lobby.');
    showNotification('You left the room.', 'warning');
}


// ====================================================================
// === SEKCJA 6: OBSŁUGA KLAWIATURY I MYSZY (z modyfikacjami) ===
// ====================================================================

function advanceTutorialStep(nextState) {
    if (tutorial.state === 'finished' || tutorial.state === nextState) return;
    if (tutorial.activeImage) tutorial.fadingOutImage = { ...tutorial.activeImage, startTime: Date.now() };
    tutorial.state = nextState;
    if (nextState !== 'finished') {
        tutorial.activeImage = { key: 'info' + nextState, alpha: 0, yOffset: 0, startTime: Date.now() };
    } else {
        tutorial.activeImage = null;
    }
}

function getMousePosOnCanvas(canvas, evt) {
    // Pobierz rzeczywiste wymiary i pozycję elementu <canvas> na stronie
    const rect = canvas.getBoundingClientRect();

    // Oblicz współczynniki skalowania między rozmiarem logicznym (1920x1080)
    // a rozmiarem, w jakim canvas jest faktycznie renderowany na ekranie.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Przelicz pozycję myszy:
    // 1. Weź pozycję myszy względem lewego górnego rogu wyrenderowanego płótna (evt.clientX - rect.left)
    // 2. Przemnóż przez współczynnik skalowania, aby uzyskać współrzędne w logicznej przestrzeni gry (1920x1080)
    const mouseX = (evt.clientX - rect.left) * scaleX;
    const mouseY = (evt.clientY - rect.top) * scaleY;

    return { x: mouseX, y: mouseY };
}

document.addEventListener('keydown', (event) => {
    if (!currentRoom) return;


    if (chatManager && chatManager.isFocused) {
        return;
    }

    // ======================= POCZĄTEK ZMIAN =======================
    if (inventoryManager.isOpen && event.code === 'KeyQ') {
        event.preventDefault();

        // Wyrzucamy przedmiot pod kursorem tylko, jeśli nie trzymamy innego w ręku
        if (!inventoryManager.heldItem) {
            const hoveredSlot = inventoryManager._getHoveredSlot();

            if (hoveredSlot && hoveredSlot.item) {
                const droppedItem = { ...hoveredSlot.item };
                hoveredSlot.item = null; // Usuń przedmiot ze slotu

                // Wyślij informację do hosta o wyrzuceniu przedmiotu
                sendPlayerAction('dropItem', {
                    name: droppedItem.name,
                    tier: droppedItem.tier
                });

                // Odtwórz dźwięk
                soundManager.play('throw');
            }
        }
        return; // Zakończ dalsze przetwarzanie
    }
    // ======================== KONIEC ZMIAN =========================

    if (event.code === 'KeyF' && tutorial.state === 'finished') {
        // Używamy globalnej zmiennej `closestNpc`, która jest aktualizowana w gameLoop
        if (closestNpc) {
            event.preventDefault();

            // ======================= POCZĄTEK ZMIANY =======================
            // Stare wywołanie:
            // tradingManager.toggleTrading(closestNpc);

            // Nowe wywołanie z przekazaniem nazwy biomu:
            tradingManager.toggleTrading(closestNpc, biomeManager.currentBiomeName);
            // ======================== KONIEC ZMIANY =========================

            return;
        }

        // Jeśli nie ma aktywnego NPC, sprawdź obóz
        if (isPlayerInCampZone && !isCustomizationMenuOpen) {
            if (loadingManager.isVisible) return;

            event.preventDefault();
            soundManager.play('camp'); // <--- DODAJ TĘ LINIĘ
            transitionToNewRoom();
            return;
        }
    }

    if (event.code === 'Escape') {
        event.preventDefault();
        if (tradingManager.isTradeWindowOpen) {
            tradingManager.stopTrading();
        } else if (isCustomizationMenuOpen) {
            isCustomizationMenuOpen = false;
            inventoryManager.isOpen = false;
        }
        return;
    }

    if (event.code === 'KeyE' && !fishingManager.isFishHooked && !tradingManager.isTradeWindowOpen) {
        event.preventDefault();
        soundManager.play('inventory'); // <--- DODAJ TĘ LINIĘ

        if (tutorial.state === 5) {
            soundManager.play('info'); // <-- DODANA LINIA
            advanceTutorialStep('finished');
            isCustomizationMenuOpen = true;
            inventoryManager.isOpen = true;
            customizationMenuState = 'category';
        } else {
            isCustomizationMenuOpen = !isCustomizationMenuOpen;
            inventoryManager.toggle();
            if (isCustomizationMenuOpen) {
                customizationMenuState = 'category';
            }
        }
        return;
    }

    keys[event.code] = true;

    if (fishingManager.isFishHooked) {
        if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
            fishingManager.setBarMovementDirection(-1);
        } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
            fishingManager.setBarMovementDirection(1);
        }
        event.preventDefault();
        return;
    }

    if (isCustomizationMenuOpen) {
        event.preventDefault();
        if (customizationMenuState === 'category') {
            if (event.code === 'ArrowUp') {
                selectedCategoryIndex = (selectedCategoryIndex - 1 + customizationCategories.length) % customizationCategories.length;
                soundManager.play('menuNavigate');
            }
            else if (event.code === 'ArrowDown') {
                selectedCategoryIndex = (selectedCategoryIndex + 1) % customizationCategories.length;
                soundManager.play('menuNavigate');
            }
            else if (event.code === 'ArrowRight') {
                 customizationMenuState = 'value';
                 soundManager.play('menuClick');
            }
        } else if (customizationMenuState === 'value') {
            const currentCategory = customizationCategories[selectedCategoryIndex];
            const options = customizationOptions[currentCategory];
            let optionIndex = currentCustomizationOptionIndices[currentCategory];
            let selectionChanged = false;

            // --- POCZĄTEK ZMIAN ---
        if (event.code === 'ArrowUp') {
            optionIndex = (optionIndex - 1 + options.length) % options.length;
            selectionChanged = true;
            soundManager.play('clothNavigate'); // Zawsze odtwarzaj ten dźwięk
        }
        else if (event.code === 'ArrowDown') {
            optionIndex = (optionIndex + 1) % options.length;
            selectionChanged = true;
            soundManager.play('clothNavigate'); // Zawsze odtwarzaj ten dźwięk
        }
            // --- KONIEC ZMIAN ---

            else if (event.code === 'ArrowLeft') {
                customizationMenuState = 'category';
                soundManager.play('menuClick');
            }
            else if (event.code === 'ArrowRight' && (currentCategory === 'hair' || currentCategory === 'beard')) {
                customizationMenuState = 'color';
                selectedColorPropertyIndex = 0;
                soundManager.play('menuClick');
            }
            if (selectionChanged) {
                currentCustomizationOptionIndices[currentCategory] = optionIndex;
                const newValue = options[optionIndex];
                localPlayer.customizations[currentCategory] = newValue;
                if (currentCategory === 'hat' && newValue !== 'none') { localPlayer.customizations.hair = 'none'; currentCustomizationOptionIndices['hair'] = 0; }
                if (currentCategory === 'hair' && newValue !== 'none') { localPlayer.customizations.hat = 'none'; currentCustomizationOptionIndices['hat'] = 0; }
                sendPlayerAction('updateCustomization', localPlayer.customizations);
            }
        } else if (customizationMenuState === 'color') {
            if (event.code === 'ArrowUp') {
                selectedColorPropertyIndex = (selectedColorPropertyIndex - 1 + colorProperties.length) % colorProperties.length;
                soundManager.play('menuNavigate'); // <-- NOWA LINIA
            }
            else if (event.code === 'ArrowDown') {
                selectedColorPropertyIndex = (selectedColorPropertyIndex + 1) % colorProperties.length;
                soundManager.play('menuNavigate'); // <-- NOWA LINIA
            }
            else if (event.code === 'ArrowLeft') {
                customizationMenuState = 'value';
                soundManager.play('menuClick'); // <-- NOWA LINIA
            }
            else if (event.code === 'ArrowRight') {
                customizationMenuState = 'adjust_value';
                soundManager.play('menuClick'); // <-- NOWA LINIA
            }
        } else if (customizationMenuState === 'adjust_value') {
            if (event.code === 'ArrowLeft') {
                customizationMenuState = 'color';
                soundManager.play('menuClick'); // <-- NOWA LINIA
            }
            else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
                soundManager.play('menuNavigate'); // <-- NOWA LINIA
                const isIncrement = event.code === 'ArrowUp';
                const category = customizationCategories[selectedCategoryIndex];
                const property = colorProperties[selectedColorPropertyIndex];
                const propertyCapitalized = property.charAt(0).toUpperCase() + property.slice(1);
                const key = category + propertyCapitalized;
                if (property === 'hue') {
                    let currentValue = localPlayer.customizations[key];
                    let newValue = isIncrement ? currentValue + 1 : currentValue - 1;
                    newValue = Math.max(HAIR_HUE_MIN, Math.min(HAIR_HUE_MAX, newValue));
                    if (localPlayer.customizations[key] !== newValue) { localPlayer.customizations[key] = newValue; sendPlayerAction('updateCustomization', localPlayer.customizations); }
                } else {
                    const internalMin = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MIN : HAIR_SATURATION_MIN) : (property === 'brightness' ? BEARD_BRIGHTNESS_MIN : BEARD_SATURATION_MIN));
                    const internalMax = (category === 'hair' ? (property === 'brightness' ? HAIR_BRIGHTNESS_MAX : HAIR_SATURATION_MAX) : (property === 'brightness' ? BEARD_BRIGHTNESS_MAX : BEARD_SATURATION_MAX));
                    let currentDisplayValue = mapToDisplayRange(localPlayer.customizations[key], internalMin, internalMax);
                    let newDisplayValue = isIncrement ? currentDisplayValue + 1 : currentDisplayValue - 1;
                    newDisplayValue = Math.max(0, Math.min(100, newDisplayValue));
                    const newInternalValue = mapFromDisplayRange(newDisplayValue, internalMin, internalMax);
                    if (localPlayer.customizations[key] !== newInternalValue) { localPlayer.customizations[key] = newInternalValue; sendPlayerAction('updateCustomization', localPlayer.customizations); }
                }
            }
        }
        return;
    }

    if (tutorial.state !== 'finished') {
        switch (tutorial.state) {
            case 1:
                if (event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'KeyA' || event.code === 'KeyD') {
                    soundManager.play('info'); // <-- DODANE
                    advanceTutorialStep(2);
                }
                break;
            case 2:
                if (event.code === 'Space') {
                    soundManager.play('info'); // <-- DODANE
                    advanceTutorialStep(3);
                }
                break;
            case 3:
                if (['Digit1', 'Numpad1', 'Digit2', 'Numpad2', 'Digit3', 'Numpad3'].includes(event.code)) {
                    soundManager.play('info'); // <-- DODANE
                    advanceTutorialStep(4);
                }
                break;
            case 4:
                if (event.code === 'KeyT') {
                    soundManager.play('info'); // <-- DODANE
                    advanceTutorialStep(5);
                }
                break;
        }
    }

    if (event.code.startsWith('Digit') || event.code.startsWith('Numpad')) {
        let item = localPlayer.customizations.rightHandItem;
        if (event.code.includes('1')) item = ITEM_NONE;
        if (event.code.includes('2')) item = ITEM_ROD;
        if (event.code.includes('3')) item = ITEM_SHOVEL;

        // Sprawdzamy, czy przedmiot faktycznie się zmienia
        if (localPlayer.customizations.rightHandItem !== item) {

            // ===============================================
            // === DODAJ TĘ LINIĘ WŁAŚNIE TUTAJ ===
            // ===============================================
            soundManager.play('itemChange');
            // ===============================================

            localPlayer.customizations.rightHandItem = item;
            localPlayerCustomizations.rightHandItem = item;
            sendPlayerAction('updateCustomization', localPlayer.customizations);
        }
        event.preventDefault();
    } else if (event.code === 'Space' && !localPlayer.isJumping) {
        soundManager.play('jump');
        sendPlayerAction('playerJump');
    }
});

document.addEventListener('keyup', (event) => {
    if (currentRoom) {
        delete keys[event.code];

        if ((event.code === 'ArrowLeft' || event.code === 'KeyA') && fishingManager.minigameBarDirection === -1) {
            fishingManager.setBarMovementDirection(0);
        }
        if ((event.code === 'ArrowRight' || event.code === 'KeyD') && fishingManager.minigameBarDirection === 1) {
            fishingManager.setBarMovementDirection(0);
        }
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (currentRoom && localPlayer.id) {
        const pos = getMousePosOnCanvas(canvas, event);
        localPlayer.currentMouseX = pos.x / currentZoomLevel + cameraX;
        localPlayer.currentMouseY = pos.y / currentZoomLevel + cameraY;
        inventoryManager.updateMousePosition(pos.x, pos.y);
    }
});

canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || !currentRoom) return;

    // Logika zacinania ryby
    if (!isCustomizationMenuOpen && fishingManager.isBiting) {
        soundManager.stopStrikeSound();
        const currentBiome = currentRoom?.gameData?.biome || 'grassland';
        fishingManager.playerRightClicked(currentBiome);
        event.preventDefault();
        return;
    }

    // --- NOWA, ULEPSZONA LOGIKA OBSŁUGI EKWIPUNKU ---
    
    // Sprawdzamy, czy kursor jest nad jakimkolwiek slotem PRZED wykonaniem akcji
    const isOverSlot = !!inventoryManager._getHoveredSlot();
    
    // Wykonujemy akcję w ekwipunku i pobieramy przedmiot, który brał w niej udział
    const interactedItem = inventoryManager.handleMouseDown();

    // Jeśli akcja dotyczyła jakiegoś przedmiotu...
    if (interactedItem) {
        // Jeśli kliknięcie było POZA slotem, to znaczy, że wyrzucamy przedmiot
        if (!isOverSlot) {
            sendPlayerAction('dropItem', {
                name: interactedItem.name,
                tier: interactedItem.tier
            });
            soundManager.play('throw');
        } 
        // Jeśli kliknięcie było WEWNĄTRZ slotu, to podnosimy, odkładamy lub zamieniamy
        else {
            const itemName = interactedItem.name;

            // 1. Sprawdź, czy to haczyk
            if (fishingManager.hookData[itemName]) {
                soundManager.play('hook');
            }
            // 2. Sprawdź, czy to przynęta (nie-ryba)
            else if (fishingManager.baitData[itemName] && fishingManager.baitData[itemName].chance > 0) {
                soundManager.play('bait');
            }
            // 3. W przeciwnym razie, załóż, że to ryba
            else {
                let isFish = false;
                for (const biome in fishingManager.fishData) {
                    if (fishingManager.fishData[biome][itemName]) {
                        isFish = true;
                        break;
                    }
                }
                if (isFish) {
                    soundManager.play('fish');
                }
            }
        }
        
        // Zapobiegaj dalszym akcjom (np. kopaniu), jeśli interakcja z ekwipunkiem miała miejsce
        event.preventDefault();
        return;
    }
    
    // --- Koniec logiki ekwipunku ---


    // Logika kopania łopatą
    if (!isCustomizationMenuOpen && localPlayer.customizations.rightHandItem === ITEM_SHOVEL) {
        const groundLevelY = DEDICATED_GAME_HEIGHT - (currentRoom.gameData?.groundLevel || 100);

        if (localPlayer.currentMouseY >= groundLevelY) {
            soundManager.playExclusive('dig');
            sendPlayerAction('digForBait', { 
                clickX: localPlayer.currentMouseX,
                clickY: localPlayer.currentMouseY
            });
            event.preventDefault();
            return;
        }
    }

    // Logika zarzucania wędki
    if (!isCustomizationMenuOpen && localPlayer.customizations.rightHandItem === ITEM_ROD && !localPlayer.hasLineCast) {
        localPlayer.isCasting = true;
        localPlayer.fishingBarTime = 0;
        event.preventDefault();
    }
});

canvas.addEventListener('contextmenu', (event) => {
    if (!currentRoom) return;
    event.preventDefault();

    if (!isCustomizationMenuOpen && fishingManager.isBiting) {
        soundManager.stopStrikeSound(); // <-- DODANA LINIA
        const currentBiome = currentRoom?.gameData?.biome || 'grassland';
        fishingManager.playerRightClicked(currentBiome);
    }
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !currentRoom || isCustomizationMenuOpen || localPlayer.customizations.rightHandItem !== ITEM_ROD) {
        return;
    }

    if (fishingManager.isCatchComplete) {
        // ======================= POCZĄTEK ZMIANY =======================
        // TO JEST NOWE, PRAWIDŁOWE MIEJSCE ODTWARZANIA DŹWIĘKU
        soundManager.play('catch');
        // ======================== KONIEC ZMIANY =========================

        const fish = fishingManager.currentFish;
        if (fish) {
            // ======================= POCZĄTEK ZMIAN =======================
            // DODAJEMY 'scale' do wysyłanych danych
            sendPlayerAction('fishCaught', {
                fishName: fish.name,
                size: fish.size,
                scale: fish.scale, // <-- TA LINIA JEST NOWA
                tier: fish.tier || 0
            });
            // ======================== KONIEC ZMIAN =========================

            const fullFishObject = createFullItemObject(fish.name);
            fullFishObject.size = fish.size;
            inventoryManager.addItem(fullFishObject);

            fishingManager.cleanUpAfterCatch();
        }
        event.preventDefault();
        return;
    }

    if (localPlayer.isCasting) {
        localPlayer.isCasting = false;

        // --- POCZĄTEK ZMIAN ---
        // Odtwarzamy dźwięk zarzucania, używając `castingPower` jako mnożnika głośności.
        // Dodajemy minimalną głośność, aby nawet najsłabszy rzut był słyszalny.
        const castVolume = Math.max(0.2, localPlayer.castingPower); // Minimalna głośność 20%
        soundManager.playWithVolume('cast', castVolume);
        // --- KONIEC ZMIAN ---

        const angle = Math.atan2(localPlayer.currentMouseY - localPlayer.rodTipWorldY, localPlayer.currentMouseX - localPlayer.rodTipWorldX);
        const CAST_SPEED_MULTIPLIER = 1200;
        const distance = localPlayer.castingPower * CAST_SPEED_MULTIPLIER;
        const simulatedFloatX = localPlayer.rodTipWorldX + Math.cos(angle) * distance;
        const simulatedFloatY = localPlayer.rodTipWorldY + Math.sin(angle) * distance;
        
        biomeManager.scareFishAt(simulatedFloatX, simulatedFloatY);
        sendPlayerAction('castFishingLine', {
            power: localPlayer.castingPower,
            angle: angle,
            startX: localPlayer.rodTipWorldX,
            startY: localPlayer.rodTipWorldY
        });
        event.preventDefault();
        return;
    }

    if (localPlayer.hasLineCast) {
        if (fishingManager.isFishHooked) {
            fishingManager.abortMinigame();
            event.preventDefault();
            return;
        }
        if (!fishingManager.isBiting) {
            soundManager.play('reelIn'); // <-- DODANA LINIA
            sendPlayerAction('reelInFishingLine');
            event.preventDefault();
        }
    }
});

canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? ZOOM_SENSITIVITY : -ZOOM_SENSITIVITY;
    currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoomLevel + zoomDelta));
}, { passive: false });


// ====================================================================
// === SEKCJA 7: INICJALIZACJA ===
// ====================================================================

console.log("Initializing P2P client...");
setupNotificationArea();
initializeSignaling();
cycleManager.load();

// === POCZĄTEK ZMIAN ===
// Zdefiniuj ścieżki do dźwięków i rozpocznij ich ładowanie
const soundPaths = {
    'menuClick': 'sound/menu_click.mp3',
    'menuNavigate': 'sound/menu_navigate.mp3',
    'clothNavigate': 'sound/cloth_navigate.mp3',
    'walk': 'sound/walk.mp3',
    'jump': 'sound/jump.mp3',
    'land': 'sound/land.mp3',
    'itemChange': 'sound/change.mp3',
    'cast': 'sound/cast.mp3',
    'waterSplash': 'sound/watersplash.mp3',
    'reelIn': 'sound/reelin.mp3',
    'dig': 'sound/dig.mp3',
    'info': 'sound/info.mp3',
    'inventory': 'sound/inventory.mp3',
    'camp': 'sound/camp.mp3',
    'throw': 'sound/throw.mp3',
    'strike': 'sound/strike_1.mp3',
    'fishing': 'sound/fishing.mp3',
    'catchin': 'sound/catchin.mp3',
    'catchout': 'sound/catchout.mp3',
    'catch': 'sound/catch.mp3',
    'fish': 'sound/fish.mp3',
    'hook': 'sound/hook.mp3',
    'bait': 'sound/bait.mp3',
    'strike_2': 'sound/strike_2.mp3' // <-- DODANA LINIA
};
soundManager.loadSounds(soundPaths);

// WAŻNE: W tym miejscu nic nie zmieniamy. loadImages wciąż jest potrzebne,
// aby zasoby gry były dostępne w pamięci, zanim gracz kliknie "Join".
// Nasz drugi ekran ładowania symuluje wczytywanie stanu pokoju, nie plików.
loadImages(() => {
    console.log("All images loaded, starting render loop.");
    
    fishingManager.strikeImage = fishingUIImages.strike;
    fishingManager.fishFrameImage = fishingUIImages.fishframe;
    fishingManager.fishImages = allItemImages;
    fishingManager.baitImages = allItemImages;
    biomeManager.setFishAssets(fishingManager.getFishData(), allItemImages);

    fishingManager.soundManager = soundManager; // <-- DODANA LINIA

    fishingManager.onFishingResetCallback = () => sendPlayerAction('reelInFishingLine');

    fishingManager.onBaitConsumedCallback = () => {
        inventoryManager.consumeBait();
    };
    updatePlayerAudio();
    requestAnimationFrame(gameLoop);
});

function updatePlayerAudio() {
    if (!currentRoom || !currentRoom.gameData) return;

    const groundLevel = DEDICATED_GAME_HEIGHT - currentRoom.gameData.groundLevel - playerSize;
    const isPlayerOnGround = localPlayer.y >= groundLevel - 1;

    // --- Lądowanie ---
    // Jeśli gracz jest teraz na ziemi, a w poprzedniej klatce nie był, to znaczy, że wylądował.
    if (isPlayerOnGround && !wasPlayerOnGround) {
    soundManager.play('land');
    }
    // --- Chodzenie ---
    // Dźwięk chodzenia jest odtwarzany tylko, gdy gracz idzie I jest na ziemi.
    const isWalkingOnGround = localPlayer.isWalking && isPlayerOnGround;
    if (isWalkingOnGround) {
        soundManager.startLoop('walk');
    } else {
        soundManager.stopLoop('walk'); // Zatrzymaj dźwięk, jeśli gracz się zatrzymał lub skoczył
    }

    // Zaktualizuj stan z poprzedniej klatki na potrzeby następnej iteracji
    wasPlayerOnGround = isPlayerOnGround;
}


// Inicjalizacja Chatu
const chatManager = new ChatManager();
setupFlagSelection();

function setupFlagSelection() {
    const selectedFlagImg = document.getElementById('selectedFlagImg');
    const flagListContainer = document.getElementById('flagListContainer');

    if (!selectedFlagImg || !flagListContainer) {
        console.error('Required flag elements not found in HTML.');
        return;
    }

    // Wypełnij listę flagami
    COUNTRIES.forEach(country => {
        const flagImg = document.createElement('img');
        flagImg.src = `https://flagcdn.com/24x18/${country.code.toLowerCase()}.png`;
        flagImg.srcset = `https://flagcdn.com/48x36/${country.code.toLowerCase()}.png 2x, https://flagcdn.com/72x54/${country.code.toLowerCase()}.png 3x`;
        flagImg.width = 24;
        flagImg.height = 18;
        flagImg.alt = country.name;
        flagImg.dataset.code = country.code.toLowerCase();

        flagImg.addEventListener('click', () => {
            const newCode = flagImg.dataset.code;
            localPlayer.selectedFlag = newCode;

            selectedFlagImg.src = `https://flagcdn.com/24x18/${newCode}.png`;
            selectedFlagImg.srcset = `https://flagcdn.com/48x36/${newCode}.png 2x, https://flagcdn.com/72x54/${newCode}.png 3x`;
            selectedFlagImg.alt = country.name;

            // Ukryj listę przez usunięcie klasy .visible
            isFlagListOpen = false;
            flagListContainer.classList.remove('visible');
        });

        flagListContainer.appendChild(flagImg);
    });

    // Pokaż/ukryj listę po kliknięciu
    selectedFlagImg.addEventListener('click', (event) => {
        event.stopPropagation();
        isFlagListOpen = !isFlagListOpen;
        // Użyj classList.toggle do przełączania widoczności
        flagListContainer.classList.toggle('visible', isFlagListOpen);
    });

    // Zamknij listę po kliknięciu poza nią
    window.addEventListener('click', () => {
        if (isFlagListOpen) {
            isFlagListOpen = false;
            flagListContainer.classList.remove('visible');
        }
    });

    // Zapobiegaj zamykaniu listy po kliknięciu wewnątrz niej
    flagListContainer.addEventListener('click', (event) => {
        event.stopPropagation();
    });
}