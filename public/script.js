
'use strict';

// ====================================================================
// === SEKCJA 1: ZMIENNE SIECIOWE P2P i STANU GRY ===
// ====================================================================

let signalingSocket;
let peer;
let isHost = false;
let gameHostInstance;
let hostConnection;

// === NOWA ZMIENNA GLOBALNA: Przechowuje listę dostępnych pokoi z serwera sygnalizacyjnego ===
let availableRooms = {}; 
// === NOWA ZMIENNA GLOBALNA: Przechowuje konfigurację pokoju hosta ===
let hostRoomConfiguration = null; 
// ========================================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const DEDICATED_GAME_WIDTH = 1920;

let currentWorldWidth = DEDICATED_GAME_WIDTH * 2;

canvas.width = DEDICATED_GAME_WIDTH;
canvas.height = DEDICATED_GAME_HEIGHT;
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.imageSmoothingEnabled = false;

const biomeManager = new BiomeManager(currentWorldWidth, DEDICATED_GAME_HEIGHT);

const lobbyDiv = document.getElementById('lobby');
const gameContainerDiv = document.getElementById('gameContainer');
const myUsernameSpan = document.getElementById('myUsername');
const myColorDisplay = document.getElementById('myColorDisplay');
const createRoomBtn = document.getElementById('createRoomBtn');
const newRoomNameInput = document.getElementById('newRoomName');
const roomListUl = document.getElementById('roomList');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

const playerSize = 128;
const animationCycleLength = 30;
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
const MIN_ZOOM = 0.0735;
const MAX_ZOOM = 1.5;
const ZOOM_SENSITIVITY = 0.1;
const ITEM_NONE = 'none';
const ITEM_ROD = 'rod';
const ITEM_LANTERN = 'lantern';
const FISHING_BAR_WIDTH = 192;
const FISHING_BAR_HEIGHT = 30;
const FISHING_SLIDER_SPEED = 0.05;
const FISHING_LINE_SEGMENT_WIDTH = 4;
const BOBBER_VERTICAL_OSCILLATION = 4;
const BOBBER_ROTATION_OSCILLATION = 10 * (Math.PI / 180);
const BOBBER_ANIMATION_SPEED = 0.05;

const characterImagePaths = { leg: 'img/character/leg.png', body: 'img/character/body.png', arm: 'img/character/arm.png', head: 'img/character/head.png', eye: 'img/character/eye.png' };
const customizationUIPaths = { frame: 'img/ui/frame.png' };
const sliderUIPaths = { bar: 'img/ui/bar.png', sliderHandle: 'img/ui/slider.png', fishingBar: 'img/ui/fishingbar.png' };
const characterImages = {};
const customizationUIImages = {};
const characterCustomImages = { hat: {}, hair: {}, accessories: {}, beard: {}, clothes: {}, pants: {}, shoes: {}, items: {} };
const exampleCustomItemPaths = {
    hat: { 'hat1': 'img/character/custom/hat/type1.png', 'hat2': 'img/character/custom/hat/type2.png', 'hat3': 'img/character/custom/hat/type3.png' },
    hair: {'hair1':'img/character/custom/hair/type1.png','hair2':'img/character/custom/hair/type2.png','hair3':'img/character/custom/hair/type3.png','hair4':'img/character/custom/hair/type4.png','hair5':'img/character/custom/hair/type5.png','hair6':'img/character/custom/hair/type6.png','hair7':'img/character/custom/hair/type7.png','hair8':'img/character/custom/hair/type8.png','hair9':'img/character/custom/hair/type9.png','hair10':'img/character/custom/hair/type10.png','hair11':'img/character/custom/hair/type11.png','hair12':'img/character/custom/hair/type12.png','hair13':'img/character/custom/hair/type13.png','hair14':'img/character/custom/hair/type14.png','hair15':'img/character/custom/hair/type15.png','hair16':'img/character/custom/hair/type16.png','hair20':'img/character/custom/hair/type20.png'},
    accessories: { 'glasses': 'img/character/custom/accessories/type1.png', 'scarf': 'img/character/custom/accessories/type2.png' },
    beard: { 'beard1': 'img/character/custom/beard/type1.png' },
    clothes: { 'shirt1': 'img/character/custom/clothes/type1.png', 'shirt2': 'img/character/custom/clothes/type2.png' },
    pants: { 'pants1': 'img/character/custom/pants/type1.png' },
    shoes: { 'shoes1': 'img/character/custom/shoes/type1.png' },
    items: {'rod':{path:'img/item/rod.png',width:playerSize*2,height:playerSize,pivotX_in_img:Math.round(20*(playerSize/128)),pivotY_in_round:(20*(playerSize/128))},'lantern':{path:'img/item/lantern.png',width:playerSize,height:playerSize,pivotX_in_img:playerSize/2,pivotY_in_img:playerSize/2},'float':{path:'img/item/float.png',width:32,height:62,pivotX_in_img:FLOAT_SIZE/2,pivotY_in_img:FLOAT_SIZE/2}}
};

let localPlayer = { id: null, username: 'Gracz' + Math.floor(Math.random()*1000), color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'), x: 50, y: DEDICATED_GAME_HEIGHT-50-playerSize, isJumping: false, velocityY: 0, isWalking: false, isIdle: false, animationFrame: 0, idleAnimationFrame: 0, direction: 1, velocityX: 0, currentMouseX: undefined, currentMouseY: undefined, customizations: { hat:'none', hair:'none', accessories:'none', beard:'none', clothes:'none', pants:'none', shoes:'none', rightHandItem:ITEM_NONE, hairSaturation:100, hairHue:0, hairBrightness:100, beardSaturation:100, beardHue:0, beardBrightness:100 }, isCasting:false, castingPower:0, fishingBarSliderPosition:0, fishingBarTime:0, castingDirectionAngle:0, hasLineCast:false, floatWorldX:null, floatWorldY:null, rodTipWorldX:null, rodTipWorldY:null, lineAnchorWorldY:null };
myUsernameSpan.textContent = localPlayer.username; myColorDisplay.style.backgroundColor = localPlayer.color;

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
const customizationOptions = { hat: ['none', 'hat1', 'hat2', 'hat3'], hair: ['none', 'hair1', 'hair2', 'hair3', 'hair4', 'hair5', 'hair6', 'hair7', 'hair8', 'hair9', 'hair10', 'hair11', 'hair12', 'hair13', 'hair14', 'hair15', 'hair16', 'hair17', 'hair18', 'hair19', 'hair20'], accessories: ['none', 'glasses', 'scarf'], beard: ['none', 'beard1'], clothes: ['none', 'shirt1', 'shirt2'], pants: ['none', 'pants1'], shoes: ['none', 'shoes1'] };
let currentCustomizationOptionIndices = { hat: 0, hair: 0, accessories: 0, beard: 0, clothes: 0, pants: 0, shoes: 0 };
const MENU_WIDTH=150,MENU_TEXT_COLOR='white',MENU_HIGHLIGHT_COLOR='yellow',MENU_ITEM_HEIGHT=40,MENU_X_OFFSET_FROM_PLAYER=20,MENU_Y_OFFSET_FROM_PLAYER_TOP_CENTER_SELECTED=-40,ROLLER_VISIBLE_COUNT=3,ROLLER_ITEM_VERTICAL_SPACING=1.2*MENU_ITEM_HEIGHT,ROLLER_DIMMED_SCALE=.7,ROLLER_DIMMED_ALPHA=.3,FRAME_SIZE=186,FRAME_OFFSET_X_FROM_MENU_TEXT=30,FRAME_OSCILLATION_SPEED=.05,FRAME_ROTATION_DEGREES=5;let frameOscillationTime=0;const PIXEL_FONT='Segoe UI, monospace',DEFAULT_FONT_SIZE_USERNAME=16,DEFAULT_FONT_SIZE_MENU=24,SLIDER_WIDTH=256,SLIDER_HEIGHT=16,SLIDER_HANDLE_SIZE=36,SLIDER_HANDLE_HITBOX_EXTEND=50,SLIDER_OFFSET_FROM_MENU_X=MENU_WIDTH+FRAME_OFFSET_X_FROM_MENU_TEXT+FRAME_SIZE+20,SLIDER_ITEM_VERTICAL_SPACING=64,HAIR_SATURATION_MIN=0,HAIR_SATURATION_MAX=200,HAIR_BRIGHTNESS_MIN=40,HAIR_BRIGHTNESS_MAX=200,HAIR_HUE_MIN=0,HAIR_HUE_MAX=360,BEARD_SATURATION_MIN=0,BEARD_SATURATION_MAX=200,BEARD_BRIGHTNESS_MIN=40,BEARD_BRIGHTNESS_MAX=200,BEARD_HUE_MIN=0,BEARD_HUE_MAX=360;
let currentSliderBounds = []; let draggingSlider = null;
let lastTime = 0;


// ====================================================================
// === SEKCJA 2: FUNKCJE RYSOWANIA (bez zmian) ===
// ====================================================================

function loadImages(callback){const allPaths={...characterImagePaths,...customizationUIPaths,...sliderUIPaths};let a=Object.keys(allPaths).length;for(const b in exampleCustomItemPaths.items)a++;for(const c in exampleCustomItemPaths){if(c==="items")continue;for(const d in exampleCustomItemPaths[c])a++;}if(a===0){biomeManager.loadBiomeImages(callback);return}let e=0;const f=g=>{e++;if(e===a)biomeManager.loadBiomeImages(()=>callback())};for(const h in allPaths){const i=new Image;i.src=allPaths[h];i.onload=()=>{characterImagePaths[h]?characterImages[h]=i:(customizationUIPaths[h]||sliderUIPaths[h])&&(customizationUIImages[h]=i),f(i.src)},i.onerror=()=>{console.error(`Błąd ładowania obrazu: ${i.src}`),f(i.src)}}for(const j in exampleCustomItemPaths){if(j==="items")continue;const k=exampleCustomItemPaths[j];for(const l in k){const m=k[l],n=new Image;n.src=m,n.onload=()=>{characterCustomImages[j]||(characterCustomImages[j]={}),characterCustomImages[j][l]=n,f(n.src)},n.onerror=()=>{console.error(`Błąd ładowania obrazu personalizacji (${j}/${l}): ${n.src}`),characterCustomImages[j]||(characterCustomImages[j]={}),characterCustomImages[j][l]=null,f(n.src)}}}const o=exampleCustomItemPaths.items;for(const p in o){const q=o[p],r=new Image;r.src=q.path,r.onload=()=>{characterCustomImages.items[p]=r,f(r.src)},r.onerror=()=>{console.error(`Błąd ładowania obrazu przedmiotu: ${r.src}`),f(r.src)}}}
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
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
    if (Math.abs(localPlayer.x - serverState.x) < 0.5) {
        localPlayer.x = serverState.x;
    }
    if (Math.abs(localPlayer.y - serverState.y) < 0.5) {
        localPlayer.y = serverState.y;
    }
}

function updateCamera() {
    const playerWorldCenterX = localPlayer.x + playerSize / 2;
    const playerWorldCenterY = localPlayer.y + playerSize / 2;

    const visibleWorldWidth = DEDICATED_GAME_WIDTH / currentZoomLevel;
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
    const visibleWorldHeight = DEDICATED_GAME_HEIGHT / currentZoomLevel;

    let targetCameraX = playerWorldCenterX - visibleWorldWidth / 2;
    if (targetCameraX < 0) {
        targetCameraX = 0;
    }
    if (targetCameraX > currentWorldWidth - visibleWorldWidth) {
        targetCameraX = currentWorldWidth - visibleWorldWidth;
    }
    if (currentWorldWidth < visibleWorldWidth) {
        targetCameraX = (currentWorldWidth / 2) - (visibleWorldWidth / 2);
    }

    let targetCameraY = playerWorldCenterY - visibleWorldHeight / 2;
    if (targetCameraY < 0) {
        targetCameraY = 0;
    }
    if (targetCameraY > DEDICATED_GAME_HEIGHT - visibleWorldHeight) {
        targetCameraY = DEDICATED_GAME_HEIGHT - visibleWorldHeight;
    }
    if (DEDICATED_GAME_HEIGHT < visibleWorldHeight) {
        targetCameraY = (DEDICATED_GAME_HEIGHT / 2) - (visibleWorldHeight / 2);
    }

    cameraX = targetCameraX;
    cameraY = targetCameraY * 1.2;
}
function drawFilteredCharacterPart(a,b,c,d,e,f,g=100,h=0,i=100){if(!b||!b.complete)return;const j=document.createElement("canvas");j.width=e,j.height=f;const k=j.getContext("2d");k.imageSmoothingEnabled=!1,k.drawImage(b,0,0,e,f);const l=[];100!==g&&l.push(`saturate(${g}%)`),0!==h&&l.push(`hue-rotate(${h}deg)`),100!==i&&l.push(`brightness(${i}%)`),l.length>0?(a.save(),a.filter=l.join(" "),a.drawImage(j,c,d,e,f),a.restore()):a.drawImage(j,c,d,e,f)}
function drawPlayer(p){if(!characterImages.body||!characterImages.body.complete){ctx.fillStyle=p.color,ctx.fillRect(p.x,p.y,playerSize,playerSize);return}ctx.save();let a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0;const i=(Number(p.animationFrame||0)%animationCycleLength)/animationCycleLength,j=(Number(p.idleAnimationFrame||0)%IDLE_ANIM_CYCLE_LENGTH)/IDLE_ANIM_CYCLE_LENGTH,k=p.isWalking===!0,l=p.isIdle===!0,m=p.isJumping===!0;let n=0;const o=p.x,q=p.y;let r=0,s=0;if(p.id===localPlayer.id&&void 0!==localPlayer.currentMouseX){const t=localPlayer.currentMouseX,u=localPlayer.currentMouseY,v=o+headPivotInImageX,w=q+(headInitialOffsetY+headPivotInImageY),x=(t-v)*p.direction,y=u-w,z=Math.sqrt(x*x+y*y);if(z>0){const A=x/z,B=y/z;r=A*Math.min(z,eyeMaxMovementRadius),s=B*Math.min(z,eyeMaxMovementRadius)}}if(k&&!m)n=Math.sin(2*i*Math.PI),a=-bodyHeadPulseAmount*Math.abs(n),b=n*armRotationAngle,c=-b,d=n*legRotationAngle,e=-d,f=n*headRotationAngleAmount,g=Math.sin(4*i*Math.PI)*bodyHeadPulseAmount*headOscillationAmplitudeFactor;else if(l&&!m)n=Math.sin(2*j*Math.PI),a=-IDLE_BODY_HEAD_PULSE_AMOUNT*Math.abs(n),b=n*IDLE_ARM_ROTATION_ANGLE,c=-b,d=0,e=0,f=n*IDLE_HEAD_ROTATION_ANGLE_AMOUNT,g=Math.sin(4*j*Math.PI)*IDLE_BODY_HEAD_PULSE_AMOUNT*IDLE_HEAD_OSCILLATION_AMPLITUDE_FACTOR;else if(m){const C=18,D=54;p.velocityY>0?h=JUMP_BODY_TILT_ANGLE*(1-Math.min(1,Math.max(0,p.velocityY/C))):h=JUMP_BODY_TILT_ANGLE*(1-Math.min(1,Math.max(0,Math.abs(p.velocityY)/D)));const E=Math.min(1,Math.abs(p.velocityY)/Math.max(C,D));d=-E*JUMP_LEG_OPPOSITE_ROTATION_ANGLE,e=E*JUMP_LEG_WAVE_ANGLE,b=E*JUMP_ARM_WAVE_ANGLE,c=-.7*b,f=.5*h,g=0,a=0}ctx.translate(o+playerSize/2,q+playerSize/2),ctx.scale(p.direction,1),m&&ctx.rotate(h*p.direction),ctx.translate(-(o+playerSize/2),-(q+playerSize/2));function t(a,b,c,d,e,f=0,g=playerSize,h=playerSize){if(!a||!a.complete)return;ctx.save();const i=o+b,j=q+c;ctx.translate(i+d,j+e),ctx.rotate(f),ctx.drawImage(a,-d,-e,g,h),ctx.restore()}t(characterImages.leg,backLegOffsetX,0,legPivotInImageX,legPivotInImageY,e),t(characterImages.arm,backArmOffsetX,0,originalArmPivotInImageX,originalArmPivotInImageY,c),t(characterImages.leg,frontLegOffsetX,0,legPivotInImageX,legPivotInImageY,d),ctx.drawImage(characterImages.body,o,q+a,playerSize,playerSize);const u=headInitialOffsetY+a+g;t(characterImages.head,0,u,headPivotInImageX,headPivotInImageY,f),t(characterImages.eye,LEFT_EYE_BASE_X_REL_HEAD_TL+r,u+EYE_BASE_Y_REL_HEAD_TL+s,eyePivotInImage,eyePivotInImage,0,eyeSpriteSize,eyeSpriteSize),t(characterImages.eye,RIGHT_EYE_BASE_X_REL_HEAD_TL+r,u+EYE_BASE_Y_REL_HEAD_TL+s,eyePivotInImage,eyePivotInImage,0,eyeSpriteSize,eyeSpriteSize);const v=p.customizations||{},w=v.hair;if(w&&"none"!==w){const x=characterCustomImages.hair[w];x&&x.complete&&(ctx.save(),ctx.translate(o+headPivotInImageX,q+u+HAIR_VERTICAL_OFFSET+headPivotInImageY-HAIR_VERTICAL_OFFSET),ctx.rotate(f),drawFilteredCharacterPart(ctx,x,-headPivotInImageX,-(headPivotInImageY-HAIR_VERTICAL_OFFSET),playerSize,playerSize,v.hairSaturation,v.hairHue,v.hairBrightness),ctx.restore())}const y=v.beard;if(y&&"none"!==y){const z=characterCustomImages.beard[y];if(z&&z.complete){const A=Math.round(15*(playerSize/32));ctx.save(),ctx.translate(o+headPivotInImageX,q+u+A+headPivotInImageY-A),ctx.rotate(f),drawFilteredCharacterPart(ctx,z,-headPivotInImageX,-(headPivotInImageY-A),playerSize,playerSize,v.beardSaturation,v.beardHue,v.brightness),ctx.restore()}}const B=v.hat;if(B&&"none"!==B){const C=characterCustomImages.hat[B];C&&C.complete&&t(C,0,u-Math.round(20*(playerSize/32)),headPivotInImageX,headPivotInImageY- -Math.round(20*(playerSize/32)),f,playerSize,playerSize)}const D=v.rightHandItem;if(D&&D!==ITEM_NONE){const E=exampleCustomItemPaths.items[D],F=characterCustomImages.items[D];E&&F&&F.complete&&t(F,frontArmOffsetX,0,originalArmPivotInImageX,originalArmPivotInImageY,b,E.width,E.height)}t(characterImages.arm,frontArmOffsetX,0,originalArmPivotInImageX,originalArmPivotInImageY,b),ctx.restore(),p.customizations&&p.customizations.rightHandItem===ITEM_ROD?(p.rodTipWorldX=p.x+playerSize/2+(frontArmOffsetX+originalArmPivotInImageX-playerSize/2)*p.direction+(ROD_TIP_OFFSET_X*Math.cos(b)-ROD_TIP_OFFSET_Y*Math.sin(b))*p.direction,p.rodTipWorldY=p.y+playerSize/2+(0+originalArmPivotInImageY-playerSize/2)+(ROD_TIP_OFFSET_X*Math.sin(b)+ROD_TIP_OFFSET_Y*Math.cos(b)),p.id===localPlayer.id&&(localPlayer.rodTipWorldX=p.rodTipWorldX,localPlayer.rodTipWorldY=p.rodTipWorldY)):(p.rodTipWorldX=null,p.rodTipWorldY=null,p.id===localPlayer.id&&(localPlayer.rodTipWorldX=null,localPlayer.rodTipWorldY=null)),ctx.fillStyle="white",ctx.font=`${DEFAULT_FONT_SIZE_USERNAME}px ${PIXEL_FONT}`,ctx.textAlign="center",ctx.fillText(p.username||p.id.substring(0,5),p.x+playerSize/2,p.y-10+a)}
function drawCustomizationMenu() {
    const playerScreenX = (localPlayer.x - cameraX) * currentZoomLevel;
    const playerScreenY = (localPlayer.y - cameraY) * currentZoomLevel;
    const menuX = playerScreenX + (playerSize / 2) * currentZoomLevel;
    const menuY = playerScreenY;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${DEFAULT_FONT_SIZE_MENU}px ${PIXEL_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    customizationCategories.forEach((category, index) => {
        const itemY = menuY + (index - selectedCategoryIndex) * MENU_ITEM_HEIGHT;
        if (index === selectedCategoryIndex) {
            ctx.fillStyle = MENU_HIGHLIGHT_COLOR;
            ctx.fillText(`> ${category.toUpperCase()}`, menuX + 20, itemY);
        } else {
            ctx.fillStyle = MENU_TEXT_COLOR;
            ctx.fillText(category, menuX + 40, itemY);
        }
    });
    const selectedCategory = customizationCategories[selectedCategoryIndex];
    const optionIndex = currentCustomizationOptionIndices[selectedCategory];
    const optionName = customizationOptions[selectedCategory][optionIndex];
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';
    ctx.fillText(`< ${optionName} >`, menuX + 250, menuY);
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

function drawFishingLine(p) {
    if (!p.hasLineCast || p.rodTipWorldX === null || p.floatWorldX === null) {
        return;
    }
    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);
    ctx.strokeStyle = '#ffffff99';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.rodTipWorldX, p.rodTipWorldY);
    ctx.lineTo(p.floatWorldX, p.floatWorldY+24);
    ctx.stroke();
    const floatImage = characterCustomImages.items.float;
    if (floatImage && floatImage.complete) {
        bobberAnimationTime += BOBBER_ANIMATION_SPEED;
        const verticalOffset = Math.sin(bobberAnimationTime) * BOBBER_VERTICAL_OSCILLATION;
        ctx.drawImage(floatImage, p.floatWorldX - FLOAT_SIZE / 2, p.floatWorldY - FLOAT_SIZE / 2 + verticalOffset, FLOAT_SIZE, FLOAT_SIZE * 2);
    } else {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(p.floatWorldX, p.floatWorldY, 10, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
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
        if (typeof insect.hue === 'number') {
            ctx.filter = `hue-rotate(${insect.hue}deg)`;
        }
        ctx.drawImage(
            insectImage,
            sourceX,
            sourceY,
            INSECT_TILE_SIZE,
            INSECT_TILE_SIZE,
            -renderedSize / 2,
            -renderedSize / 2,
            renderedSize,
            renderedSize
        );
        ctx.restore();
    }
}

// ====================================================================
// === SEKCJA 3: NOWA LOGIKA SIECIOWA (P2P & SYGNALIZACJA) ===
// ====================================================================

function initializeSignaling() {
    signalingSocket = io();
    signalingSocket.on('connect', () => console.log('Połączono z serwerem sygnalizacyjnym.', signalingSocket.id));
    // === ZMIANA: Aktualizujemy globalną zmienną availableRooms ===
    signalingSocket.on('roomListUpdate', (hosts) => {
        availableRooms = hosts; // Przechowujemy listę pokoi globalnie
        if (!currentRoom) { // Aktualizujemy lobby tylko jeśli nie jesteśmy w grze
            roomListUl.innerHTML = '';
            if (Object.keys(hosts).length === 0) {
                roomListUl.innerHTML = '<li>Brak dostępnych pokoi. Stwórz jeden!</li>';
            } else {
                for (let peerId in hosts) {
                    const room = hosts[peerId];
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${room.name} (Graczy: ${room.playerCount})</span><button data-peer-id="${peerId}">Dołącz</button>`;
                    li.querySelector('button').addEventListener('click', () => joinRoom(peerId));
                    roomListUl.appendChild(li);
                }
            }
        }
    });
    // =============================================================
    signalingSocket.on('roomRemoved', (removedRoomId) => {
        if (hostConnection && hostConnection.peer === removedRoomId) {
            alert('Pokój, w którym byłeś, został usunięty!');
            leaveCurrentRoomUI();
        }
    });
}


function initializePeer(callback) {
    if (peer && !peer.destroyed) {
        return callback(peer.id);
    }

    // Użycie `new Peer()` bez opcji łączy z domyślnym serwerem PeerJS
    const peerConfig = {
    // Możesz zostawić puste, aby łączyć się z domyślnym serwerem PeerJS Cloud,
    // albo podać dane swojego serwera PeerJS, jeśli go hostujesz.
    // host: 'twoj-peerjs-server.onrender.com',
    // secure: true,
    
    // NAJWAŻNIEJSZA CZĘŚĆ: Konfiguracja STUN/TURN
    config: {
        'iceServers': [
            // Dodajemy publiczne serwery STUN od Google. Zazwyczaj wystarczają.
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            
            // --- WAŻNE: Dodaj serwer TURN jako fallback ---
            // Serwery TURN rzadko są darmowe, ponieważ zużywają transfer.
            // Poniżej jest przykład. Musisz uzyskać własne dane uwierzytelniające
            // od dostawcy takiego jak Twilio, Metered, lub postawić własny (coturn).
            /*
            {
                urls: 'turn:adres-twojego-serwera-turn.com:3478',
                username: 'twoja-nazwa-uzytkownika',
                credential: 'twoje-haslo'
            }
            */
        ]
    }
};

// Inicjalizujemy Peer z nową konfiguracją.
// Przekazujemy 'undefined' jako pierwszy argument, aby serwer sam przydzielił nam ID.
peer = new Peer(undefined, peerConfig);

    peer.on('open', (id) => {
        console.log('Moje ID w sieci P2P (z serwera chmurowego PeerJS): ' + id);
        if (callback) callback(id);
    });

    peer.on('error', (err) => {
        console.error("Błąd krytyczny PeerJS: ", err);
        alert("Wystąpił błąd sieciowy P2P. Spróbuj odświeżyć stronę. Błąd: " + err.type);
        if (callback) callback(null);
    });
}

// === ZMIANA: Funkcja teraz akceptuje hostPeerId ===
function onSuccessfulJoin(roomData, hostPeerId = null) { 
    // Jeśli nazwa pokoju jest brakująca, spróbuj ją pobrać z listy dostępnych pokoi
    if (!roomData || !roomData.name) {
        if (hostPeerId && availableRooms[hostPeerId] && availableRooms[hostPeerId].name) {
            roomData = roomData || {}; // Upewnij się, że roomData istnieje
            roomData.name = availableRooms[hostPeerId].name; // Pobierz nazwę z listy lobby
            console.log(`[INFO] Nazwa pokoju była pusta, używam nazwy z listy lobby: ${roomData.name}`);
        } else {
            console.warn(`[WARN] Nie udało się ustalić nazwy pokoju. Dane pokoju:`, roomData);
            roomData = roomData || {};
            roomData.name = "Nieznany pokój"; // Placeholder, jeśli nazwa nie zostanie znaleziona
        }
    }
    // ====================================================

    currentRoom = roomData;
    playersInRoom = roomData.playersInRoom;

    if (roomData.gameData) {
        currentWorldWidth = roomData.gameData.worldWidth;
        biomeManager.worldWidth = currentWorldWidth;
        biomeManager.setBiome(roomData.gameData.biome);
        biomeManager.setVillageData(roomData.gameData.villageType, roomData.gameData.villageXPosition, roomData.gameData.placedBuildings);
        
        biomeManager.initializeGroundPlants(roomData.gameData.groundPlants || []);
        biomeManager.initializeTrees(roomData.gameData.trees || []);
        insectsInRoom = roomData.gameData.insects || [];
    }

    const myId = peer ? peer.id : null;
    if (myId && playersInRoom[myId]) {
        const serverPlayerState = playersInRoom[myId];
        Object.assign(localPlayer, serverPlayerState);
        if (serverPlayerState.customizations) {
            Object.assign(localPlayer.customizations, serverPlayerState.customizations);
        }
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
    // Logowanie nazwy pokoju, która mogła zostać uzupełniona
    console.log(`Pomyślnie dołączono do pokoju: "${currentRoom.name}"`); 
}


// ====================================================================
// === SEKCJA 4: GŁÓWNA PĘTLA GRY I FUNKCJE KOMUNIKACYJNE ===
// ====================================================================

function sendPlayerInput() {
    const isPlayerInputLocked = isCustomizationMenuOpen || draggingSlider;
    const inputPayload = {
        keys: isPlayerInputLocked ? {} : keys,
        currentMouseX: localPlayer.currentMouseX,
        currentMouseY: localPlayer.currentMouseY,
    };

    if (hostConnection) { 
        hostConnection.send({ type: 'playerInput', payload: inputPayload });
    }
}

function sendPlayerAction(type, payload = {}) {
    const actionPayload = { type, payload };
    
    if (hostConnection) { 
        hostConnection.send({ type: 'playerAction', payload: actionPayload });
    }
}

function gameLoop(currentTime) {
    function updateLocalPlayerMovement() {
    let targetVelocityX = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) {
        targetVelocityX = -PLAYER_WALK_SPEED;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        targetVelocityX = PLAYER_WALK_SPEED;
    }
    localPlayer.velocityX = targetVelocityX !== 0 ? targetVelocityX : localPlayer.velocityX * DECELERATION_FACTOR;
    if (Math.abs(localPlayer.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) {
        localPlayer.velocityX = 0;
    }
    localPlayer.x += localPlayer.velocityX;
    localPlayer.x = Math.max(0, Math.min(currentWorldWidth - playerSize, localPlayer.x));
}

    if (!lastTime) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    if (currentRoom === null) {
        requestAnimationFrame(gameLoop);
        return;
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
        const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - currentRoom.gameData.groundLevel - playerSize;
        for (const id in playersInRoom) {
            const p = playersInRoom[id];
            const isOnGround = (p.y >= groundY_target_for_player_top - 1 && p.y <= groundY_target_for_player_top + 1);
            p.isWalking = Math.abs(p.velocityX || 0) > MIN_VELOCITY_FOR_WALK_ANIMATION && isOnGround;
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
    
    sendPlayerInput();
    updateLocalPlayerMovement();
    reconcilePlayerPosition();
    updateCamera();
    if (localPlayer.isCasting) {
        localPlayer.fishingBarTime += FISHING_SLIDER_SPEED;
        localPlayer.fishingBarSliderPosition = (Math.sin(localPlayer.fishingBarTime) + 1) / 2;
        localPlayer.castingPower = localPlayer.fishingBarSliderPosition;
    }
    
    ctx.clearRect(0, 0, DEDICATED_GAME_WIDTH, DEDICATED_GAME_HEIGHT);
    biomeManager.drawBackground(ctx);
    ctx.save();
    ctx.scale(currentZoomLevel, currentZoomLevel);
    ctx.translate(-cameraX, -cameraY);
    
    biomeManager.drawParallaxBackground(ctx, cameraX, cameraY, DEDICATED_GAME_WIDTH / currentZoomLevel);
    
    if (currentRoom?.gameData?.biome) {
        const { biome: b, groundLevel: g } = currentRoom.gameData;
        biomeManager.drawBackgroundBiomeGround(ctx,b,g); biomeManager.drawBackgroundTrees(ctx); biomeManager.drawBackgroundPlants(ctx); biomeManager.drawBuildings(ctx,g,cameraX,DEDICATED_GAME_WIDTH/currentZoomLevel);
    }
    
    Object.values(playersInRoom).sort((a,b)=>(a.y+playerSize)-(b.y+playerSize)).forEach(p=>drawPlayer(p));
    
    if(currentRoom?.gameData?.biome){const {biome:b,groundLevel:g}=currentRoom.gameData;biomeManager.drawForegroundPlants(ctx);biomeManager.drawForegroundTrees(ctx);;drawInsects();biomeManager.drawForegroundBiomeGround(ctx,b,g);biomeManager.drawWater(ctx,b,cameraX)}
    
    ctx.restore();for(const id in playersInRoom) drawFishingLine(playersInRoom[id]);
    
    if(isCustomizationMenuOpen) drawCustomizationMenu();
    if(localPlayer.isCasting) drawFishingBar(localPlayer);
    
    requestAnimationFrame(gameLoop);
}

// ====================================================================
// === SEKCJA 5: OBSŁUGA ZDARZEŃ UI i P2P (NOWA LOGIKA) ===
// ====================================================================

createRoomBtn.addEventListener('click', () => {
    if (isHost) return; 
    isHost = true;
    createRoomBtn.disabled = true; 
    newRoomNameInput.disabled = true;

    initializePeer((peerId) => {
        if (!peerId) {
            console.error("Nie udało się uzyskać Peer ID. Nie można stworzyć pokoju.");
            alert("Błąd sieci, nie można stworzyć pokoju.");
            isHost = false; 
            createRoomBtn.disabled = false;
            newRoomNameInput.disabled = false;
            return;
        }
        
        console.log(`Uzyskano Peer ID: ${peerId}. Inicjuję hosta gry...`);
        localPlayer.id = peerId;

        gameHostInstance = new GameHost();
        // --- ZMIANA: Przechowujemy konfigurację pokoju hosta ---
        const roomConfig = gameHostInstance.start({ id: peerId, username: localPlayer.username, color: localPlayer.color, customizations: localPlayer.customizations });
        hostRoomConfiguration = roomConfig; // Zapisujemy konfigurację pokoju
        // ========================================================

        signalingSocket.emit('register-host', {
            peerId,
            name: newRoomNameInput.value.trim() || roomConfig.name, // Nazwa dla lobby
            biome: roomConfig.gameData.biome,
            worldWidth: roomConfig.gameData.worldWidth,
            villageType: roomConfig.gameData.villageType
        });

        peer.on('connection', (conn) => {
            conn.on('open', () => {
                conn.on('data', (data) => {
                    if (data.type === 'requestJoin') { 
                        gameHostInstance.addPlayer(conn, data.payload); 

                        // --- ZMIANA: Host jawnie wysyła nazwę pokoju ---
                        // Sprawdzamy, czy mamy nazwę pokoju w naszej globalnej zmiennej
                        if (hostRoomConfiguration) { 
                            const roomDataToSend = {
                                name: hostRoomConfiguration.name, // Używamy nazwy pokoju hosta
                                playersInRoom: playersInRoom, // Aktualna lista graczy
                                gameData: hostRoomConfiguration.gameData // Dane gry
                            };
                            // Wysyłamy wiadomość roomJoined z pełnymi danymi
                            conn.send({ type: 'roomJoined', payload: roomDataToSend });
                        } else {
                            console.error("Host: Nie można wysłać roomJoined - brak hostRoomConfiguration!");
                            // Opcjonalnie można wysłać błąd do klienta
                            // conn.send({ type: 'joinError', payload: 'Host configuration missing.' });
                        }
                        // --- KONIEC ZMIANY ---
                        
                        signalingSocket.emit('notify-join', peerId); 
                    }
                    else if (data.type === 'playerInput') { gameHostInstance.handlePlayerInput(conn.peer, data.payload); }
                    else if (data.type === 'playerAction') { gameHostInstance.handlePlayerAction(conn.peer, data.payload); }
                });
            });
            conn.on('close', () => { gameHostInstance.removePlayer(conn.peer); signalingSocket.emit('notify-leave', peerId); });
        });
        
        console.log(`[HOST] Serwer w tle uruchomiony. Pokój "${roomConfig.name}" jest teraz widoczny w lobby.`);
    });
});

function joinRoom(hostPeerId) {
    initializePeer((myPeerId) => {
        localPlayer.id = myPeerId;

        if (isHost && myPeerId === hostPeerId) {
            console.log('[HOST] Wykryto dołączanie do własnego pokoju. Używanie symulowanego połączenia.');
            
            const simulatedConnection = {
                peer: myPeerId,
                open: true,
                send: (data) => {
                    switch (data.type) {
                        case 'roomJoined': onSuccessfulJoin(data.payload); break; // Host sam sobie wysyła roomJoined
                        case 'gameStateUpdate':
                            const map = {};
                            for (const p of data.payload) {
                                if(playersInRoom[p.id]) {
                                    p.animationFrame = playersInRoom[p.id].animationFrame;
                                    p.idleAnimationFrame = playersInRoom[p.id].idleAnimationFrame;
                                }
                                map[p.id] = p;
                            }
                            playersInRoom = map;
                            break;
                        case 'playerJoinedRoom':
                            if (!playersInRoom[data.payload.id]) {
                                playersInRoom[data.payload.id] = data.payload.playerData;
                                console.log(`Gracz ${data.payload.username} dołączył.`);
                            }
                            break;
                        case 'playerLeftRoom':
                            if (playersInRoom[data.payload]) {
                                console.log(`Gracz ${playersInRoom[data.payload].username} opuścił.`);
                                delete playersInRoom[data.payload];
                            }
                            break;
                        case 'playerCustomizationUpdated':
                            if (playersInRoom[data.payload.id]) {
                                playersInRoom[data.payload.id].customizations = data.payload.customizations;
                            }
                            break;
                        case 'grassSwaying':
                            if (biomeManager) {
                                biomeManager.startSwayAnimation(data.payload.grassId, data.payload.direction);
                            }
                            break;
                    }
                },
                sendToServer: (data) => {
                     if (data.type === 'playerInput') { gameHostInstance.handlePlayerInput(myPeerId, data.payload); }
                     else if (data.type === 'playerAction') { gameHostInstance.handlePlayerAction(myPeerId, data.payload); }
                }
            };
            hostConnection = { send: (data) => simulatedConnection.sendToServer(data) };
            gameHostInstance.addPlayer(simulatedConnection, localPlayer);
        } 
        // Przypadek 2: Zwykły gość dołącza do gry.
        else {
            isHost = false;
            console.log(`[GOŚĆ] Próbuję nawiązać połączenie P2P z hostem o ID: ${hostPeerId}`);
            
            hostConnection = peer.connect(hostPeerId, { reliable: true });

            if (!hostConnection) {
                console.error("[GOŚĆ] BŁĄD KRYTYCZNY: peer.connect() zwróciło null.");
                alert("Nie udało się zainicjować połączenia z hostem.");
                return;
            }

            console.log("[GOŚĆ] Obiekt połączenia został stworzony. Oczekuję na zdarzenia...");

            hostConnection.on('open', () => {
                console.log(`[GOŚĆ] SUKCES! Połączenie P2P z hostem (${hostPeerId}) zostało otwarte.`);
                signalingSocket.emit('notify-join', hostPeerId);
                hostConnection.send({ type: 'requestJoin', payload: localPlayer });
            });

            hostConnection.on('data', (data) => {
                switch(data.type) {
                    case 'roomJoined':
                        // === ZMIANA: Przekazujemy hostPeerId do onSuccessfulJoin ===
                        onSuccessfulJoin(data.payload, hostPeerId); 
                        break;
                    // ===============================================================
                    case 'gameStateUpdate':
                        const map = {};
                        for (const p of data.payload) {
                            if(playersInRoom[p.id]) { p.animationFrame = playersInRoom[p.id].animationFrame; p.idleAnimationFrame = playersInRoom[p.id].idleAnimationFrame; }
                            map[p.id] = p;
                        }
                        playersInRoom = map;
                        if (playersInRoom[localPlayer.id]) Object.assign(localPlayer, playersInRoom[localPlayer.id]);
                        break;
                    case 'playerJoinedRoom': 
                        if (!playersInRoom[data.payload.id]) {
                            playersInRoom[data.payload.id] = data.payload.playerData; 
                            console.log(`Gracz ${data.payload.username} dołączył.`);
                        }
                        break;
                    case 'playerLeftRoom': if(playersInRoom[data.payload]) { console.log(`Gracz ${playersInRoom[data.payload].username} opuścił.`); delete playersInRoom[data.payload]; } break;
                    case 'playerCustomizationUpdated': if(playersInRoom[data.payload.id]) playersInRoom[data.payload.id].customizations = data.payload.customizations; break;
                    case 'grassSwaying': 
                        if (biomeManager) biomeManager.startSwayAnimation(data.payload.grassId, data.payload.direction);
                        break;
                }
            });

            hostConnection.on('error', (err) => {
                console.error(`[GOŚĆ] BŁĄD POŁĄCZENIA P2P:`, err);
                alert('Wystąpił błąd podczas komunikacji z hostem.');
            });

            hostConnection.on('close', () => { 
                console.warn("[GOŚĆ] Połączenie P2P z hostem zostało zamknięte.");
                alert('Host zamknął pokój lub utracono połączenie.'); 
                leaveCurrentRoomUI();
            });
        }
    });
}

leaveRoomBtn.addEventListener('click', () => {
    const hostPeerId = hostConnection?.peer || (isHost ? peer?.id : null);

    if(isHost) { 
        if(gameHostInstance) gameHostInstance.stop();
        setTimeout(() => {
            if(peer && !peer.destroyed) peer.destroy();
        }, 500);
    } 
    
    if (!isHost && hostConnection) { 
        hostConnection.close(); 
    }

    if (hostPeerId) {
        signalingSocket.emit('notify-leave', hostPeerId);
    }
    
    leaveCurrentRoomUI();
});


function leaveCurrentRoomUI() {
    gameContainerDiv.style.display='none'; lobbyDiv.style.display='block';
    currentRoom=null; playersInRoom={}; insectsInRoom=[];
    isHost=false; 
    hostConnection=null; 
    gameHostInstance=null;
    
    createRoomBtn.disabled = false;
    newRoomNameInput.disabled = false;

    currentWorldWidth=DEDICATED_GAME_WIDTH * 2; biomeManager.worldWidth=currentWorldWidth; biomeManager.setBiome('jurassic');
    keys={}; cameraX=0; cameraY=0; isCustomizationMenuOpen=false;
    console.log('Opuściłeś pokój, wrócono do lobby.');
}


// ====================================================================
// === SEKCJA 6: OBSŁUGA ZDARZEŃ KLAWIATURY I MYSZY ===
// ====================================================================
function getMousePosOnCanvas(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

document.addEventListener('keydown', (event) => {
    if (!currentRoom) return;
    keys[event.code] = true;
    
    if (event.code.startsWith('Digit') || event.code.startsWith('Numpad')) {
        let item = localPlayer.customizations.rightHandItem;
        if(event.code.includes('1')) item=ITEM_NONE; 
        if(event.code.includes('2')) item=ITEM_ROD; 
        if(event.code.includes('3')) item=ITEM_LANTERN;
        
        if(localPlayer.customizations.rightHandItem !== item) {
            localPlayer.customizations.rightHandItem = item;
            localPlayerCustomizations.rightHandItem = item;
            sendPlayerAction('updateCustomization', localPlayer.customizations);
        }
        event.preventDefault();

    } if (event.code === 'KeyE') {
        isCustomizationMenuOpen = !isCustomizationMenuOpen;
        event.preventDefault();
        draggingSlider = null;
    } else if (isCustomizationMenuOpen) {
        event.preventDefault(); 

        const currentCategory = customizationCategories[selectedCategoryIndex];
        const options = customizationOptions[currentCategory];
        let optionIndex = currentCustomizationOptionIndices[currentCategory];
        let needsUpdate = false;

        if (event.code === 'ArrowUp') {
            selectedCategoryIndex = (selectedCategoryIndex - 1 + customizationCategories.length) % customizationCategories.length;
        } else if (event.code === 'ArrowDown') {
            selectedCategoryIndex = (selectedCategoryIndex + 1) % customizationCategories.length;
        } else if (event.code === 'ArrowLeft') {
            optionIndex = (optionIndex - 1 + options.length) % options.length;
            needsUpdate = true;
        } else if (event.code === 'ArrowRight') {
            optionIndex = (optionIndex + 1) % options.length;
            needsUpdate = true;
        }

        if (needsUpdate) {
            currentCustomizationOptionIndices[currentCategory] = optionIndex;
            localPlayer.customizations[currentCategory] = options[optionIndex];
            sendPlayerAction('updateCustomization', localPlayer.customizations);
        }

    } else if (event.code === 'Space' && !localPlayer.isJumping) {
        sendPlayerAction('playerJump');
    }
});

document.addEventListener('keyup', (event) => {
    if (currentRoom) delete keys[event.code];
});

canvas.addEventListener('mousemove', (event) => {
    if (currentRoom && localPlayer.id) {
        const rect = canvas.getBoundingClientRect();
        const mouseX_unzoomed = (event.clientX - rect.left) * (DEDICATED_GAME_WIDTH / rect.width);
        const mouseY_unzoomed = (event.clientY - rect.top) * (DEDICATED_GAME_HEIGHT / rect.height);
        localPlayer.currentMouseX = mouseX_unzoomed / currentZoomLevel + cameraX;
        localPlayer.currentMouseY = mouseY_unzoomed / currentZoomLevel + cameraY;
    }
});

canvas.addEventListener('mousedown', (event) => {
    if(event.button !== 0 || !currentRoom) return;
    if (!isCustomizationMenuOpen && localPlayer.customizations.rightHandItem === ITEM_ROD && !localPlayer.hasLineCast) {
        localPlayer.isCasting = true;
        localPlayer.fishingBarTime = 0;
        event.preventDefault();
    }
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0 && !isCustomizationMenuOpen && currentRoom && localPlayer.customizations.rightHandItem === ITEM_ROD) {
        if (localPlayer.isCasting) {
            localPlayer.isCasting = false;
            const angle = Math.atan2(localPlayer.currentMouseY - localPlayer.rodTipWorldY, localPlayer.currentMouseX - localPlayer.rodTipWorldX);

            sendPlayerAction('castFishingLine', { 
                power: localPlayer.castingPower, 
                angle: angle, 
                startX: localPlayer.rodTipWorldX, 
                startY: localPlayer.rodTipWorldY 
            });
            event.preventDefault();
        } else if (localPlayer.hasLineCast) {
            sendPlayerAction('reelInFishingLine');
            event.preventDefault();
        }
    }
    draggingSlider = null;
});

canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? ZOOM_SENSITIVITY : -ZOOM_SENSITIVITY;
    currentZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoomLevel + zoomDelta));
}, { passive: false });


// ====================================================================
// === SEKCJA 7: INICJALIZACJA ===
// ====================================================================

console.log("Inicjalizacja klienta P2P...");
initializeSignaling();
loadImages(() => {
    console.log("Wszystkie obrazy załadowane, uruchamiam pętlę renderowania.");
    requestAnimationFrame(gameLoop);
});