

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 8080;

app.use(express.static('public'));

let rooms = {};
let playersGlobal = {};

const AVAILABLE_BIOMES = ['jurassic']; // Możesz dodać 'forest', 'desert' itp.

// === STAŁE GRY (serwer jest autorytatywny) ===
const DEDICATED_GAME_HEIGHT = 1080; // Wysokość widocznego obszaru gry (viewport)
const PLAYER_SIZE = 128;           // Rozmiar gracza
const WORLD_WIDTH = 4000;          // Szerokość świata gry
const GRAVITY = 1.6; // ZMNIEJSZONA GRAWITACJA - KLUCZOWA ZMIANA
const JUMP_STRENGTH = -25; // ZWIĘKSZONA SIŁA SKOKU - KLUCZOWA ZMIANA
const PLAYER_WALK_SPEED = 14;
const DECELERATION_FACTOR = 0.8;
const MIN_VELOCITY_FOR_WALK_ANIMATION = 0.5;

const ANIMATION_CYCLE_LENGTH = 30;
const IDLE_ANIM_CYCLE_LENGTH = 60; // Długość cyklu animacji idle (wolniejsza niż chód)

const GAME_TICK_RATE = 1000 / 60; // 60 ticks per second

// === NOWE STAŁE DLA WĘDKOWANIA (MUSZĄ BYĆ ZGODNE Z KLIENTEM) ===
const WATER_TOP_Y_WORLD = DEDICATED_GAME_HEIGHT - 164;
const FLOAT_GRAVITY = 0.3; // Serwer jest autorytatywny dla grawitacji spławika
const FLOAT_WATER_FRICTION = 0.9; // Serwer jest autorytatywny dla tarcia spławika w wodzie
const FLOAT_HITBOX_RADIUS = 32 / 2; // Zakładając, że sprite spławika ma 32x32px, promień to połowa rozmiaru.
const CASTING_POWER_MULTIPLIER = 20; // Wpływ siły zarzucenia na początkową prędkość (po stronie serwera)

// Replikacja wartości klienta dla obliczania pozycji końca wędki
// Upewnij się, że te stałe są dokładnie takie same jak w script.js
const ORIGINAL_ARM_PIVOT_IN_IMAGE_X = Math.round(14 * (PLAYER_SIZE / 36));
const ORIGINAL_ARM_PIVOT_IN_IMAGE_Y = Math.round(15 * (PLAYER_SIZE / 36));
const ROD_TIP_OFFSET_X = Math.round(136 * (PLAYER_SIZE / 128));
const ROD_TIP_OFFSET_Y = Math.round(-38 * (PLAYER_SIZE / 128));
const ARM_ROTATION_WALK_MAX_DEGREES = 45;
const ARM_ROTATION_WALK_MAX_ANGLE = ARM_ROTATION_WALK_MAX_DEGREES * (Math.PI / 180);
const FRONT_ARM_OFFSET_X = 0; // Odpowiada client-side frontArmOffsetX
const ARM_OFFSET_Y_IN_PLAYER_SPACE = 0; // Odpowiada client-side 0 dla ramienia (offset Y)
// ====================================================

// Funkcja pomocnicza do obliczania kąta obrotu ramienia na podstawie stanu gracza
function getArmRotationAngle(player) {
    if (player.isWalking) {
        const animationProgress = (player.animationFrame % ANIMATION_CYCLE_LENGTH) / ANIMATION_CYCLE_LENGTH;
        const oscillationWave = Math.sin(animationProgress * Math.PI * 2);
        return oscillationWave * ARM_ROTATION_WALK_MAX_ANGLE;
    }
    // Jeśli gracz jest bezczynny lub skacze, ręka może być w neutralnej pozycji lub animowana inaczej.
    // Dla uproszczenia zwracamy 0, jeśli nie chodzi. Można dodać logikę dla idle/jump animations.
    return 0; 
}

// Funkcja pomocnicza do obliczania pozycji końca wędki w świecie gry
function calculateRodTipWorldPosition(player) {
    // Jeśli gracz nie ma personalizacji lub nie ma wędki, zwróć null
    if (!player.customizations || player.customizations.rightHandItem !== 'rod') {
        return { x: null, y: null };
    }

    const armRotationAmount = getArmRotationAngle(player); // Pobierz aktualny kąt obrotu ramienia

    const playerCenterX = player.x + (PLAYER_SIZE / 2);
    const playerCenterY = player.y + (PLAYER_SIZE / 2);

    // Pozycja punktu obrotu ramienia względem centrum gracza.
    // Te wartości to offsety (X, Y) od lewego górnego rogu playera do pivota ramienia.
    // Chcemy przekształcić je tak, aby były względem centrum playera,
    // a następnie obrócić wokół centrum playera.
    const armLocalOffsetX_relToPlayerCenter = (FRONT_ARM_OFFSET_X + ORIGINAL_ARM_PIVOT_IN_IMAGE_X) - (PLAYER_SIZE / 2);
    const armLocalOffsetY_relToPlayerCenter = (ARM_OFFSET_Y_IN_PLAYER_SPACE + ORIGINAL_ARM_PIVOT_IN_IMAGE_Y) - (PLAYER_SIZE / 2);

    // Obrócony punkt obrotu ramienia względem centrum gracza
    const rotatedArmPivotX_relToPlayerCenter = armLocalOffsetX_relToPlayerCenter * Math.cos(armRotationAmount) - armLocalOffsetY_relToPlayerCenter * Math.sin(armRotationAmount);
    const rotatedArmPivotY_relToPlayerCenter = armLocalOffsetX_relToPlayerCenter * Math.sin(armRotationAmount) + armLocalOffsetY_relToPlayerCenter * Math.cos(armRotationAmount);

    // Punkt obrotu ramienia w świecie gry
    const currentArmPivotWorldX = playerCenterX + rotatedArmPivotX_relToPlayerCenter * player.direction;
    const currentArmPivotWorldY = playerCenterY + rotatedArmPivotY_relToPlayerCenter;

    // Obliczamy koniec wędki od punktu obrotu ramienia
    // Offset końca wędki w lokalnym układzie ramienia (bez globalnego skalowania kierunku)
    const rodTipLocalX = ROD_TIP_OFFSET_X;
    const rodTipLocalY = ROD_TIP_OFFSET_Y;

    // Obracamy offset końca wędki o ten sam kąt ramienia.
    const rotatedRodTipOffsetX_relToArmPivot = rodTipLocalX * Math.cos(armRotationAmount) - rodTipLocalY * Math.sin(armRotationAmount);
    const rotatedRodTipOffsetY_relToArmPivot = rodTipLocalX * Math.sin(armRotationAmount) + rodTipLocalY * Math.cos(armRotationAmount);

    // Dodajemy obrócony offset do punktu obrotu ramienia
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
        // NEW: Dodajemy domyślne personalizacje do globalnego obiektu gracza
        customizations: {
            hat: 'none',
            hair: 'none',
            accessories: 'none',
            beard: 'none',
            clothes: 'none',
            pants: 'none',
            shoes: 'none',
            rightHandItem: 'none', // Domyślnie brak przedmiotu
            // NEW: Domyślne wartości dla suwaków włosów i brody
            hairSaturation: 100,
            hairHue: 180,
            hairBrightness: 50,
            beardSaturation: 100,
            beardHue: 0,
            beardBrightness: 100
        }
    };

    // Emit 'playerInfo' z pełnymi danymi gracza, w tym personalizacjami
    socket.emit('playerInfo', playersGlobal[socket.id]);
    socket.emit('roomListUpdate', getPublicRoomList());

    socket.on('createRoom', (roomName, callback) => {
        const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
        roomName = roomName || `Pokój ${Object.keys(rooms).length + 1}`;

        if (playersGlobal[socket.id].currentRoomId) {
        if (callback) callback({ success: false, message: 'Już jesteś w pokoju. Najpierw go opuść.' });
        return;
    }

    const randomBiome = AVAILABLE_BIOMES[Math.floor(Math.random() * AVAILABLE_BIOMES.length)];

rooms[roomId] = {
    id: roomId,
    name: roomName,
    hostId: socket.id,
    players: {},
    gameData: {
        groundLevel: 256, // Zmieniamy to na większą wartość
        biome: randomBiome
    },
    playerInputs: {}
};


        socket.join(roomId);
        playersGlobal[socket.id].currentRoomId = roomId;

        const initialY = DEDICATED_GAME_HEIGHT - rooms[roomId].gameData.groundLevel - PLAYER_SIZE;

        rooms[roomId].players[socket.id] = {
            id: socket.id,
            x: 50, // Początkowa pozycja X w świecie gry
            y: initialY,
            color: playersGlobal[socket.id].color,
            isJumping: false,
            velocityY: 0,
            username: playersGlobal[socket.id].username,
            isWalking: false,
            animationFrame: 0,
            isIdle: true,
            idleAnimationFrame: 0,
            direction: 1, // Domyślna kierunek
            velocityX: 0, // Domyślna prędkość
            currentMouseX: undefined, // Będzie aktualizowane przez playerInput
            currentMouseY: undefined, // Będzie aktualizowane przez playerInput
            // NEW: Dołącz personalizacje gracza do danych w pokoju
            customizations: { ...playersGlobal[socket.id].customizations },
            // --- INICJALIZACJA ZMIENNYCH WĘDKOWANIA DLA NOWEGO GRACZA W POKOJU ---
            hasLineCast: false,
            floatWorldX: null,
            floatWorldY: null,
            floatVelocityX: 0,
            floatVelocityY: 0,
            lineAnchorWorldX: null,
            lineAnchorWorldY: null,
            rodTipWorldX: null, // Początkowo null, obliczy serwer
            rodTipWorldY: null, // Początkowo null, obliczy serwer
            // --- KONIEC INICJALIZACJI ---
        };
        // Inicjalizuj inputy dla nowego gracza
        rooms[roomId].playerInputs[socket.id] = { keys: {}, currentMouseX: undefined, currentMouseY: undefined };


        console.log(`Gracz ${playersGlobal[socket.id].username} (${socket.id}) stworzył pokój: "${roomName}" (${roomId})`);
        io.emit('roomListUpdate', getPublicRoomList());

        socket.emit('roomJoined', {
            roomId: roomId,
            roomName: rooms[roomId].name,
            playersInRoom: rooms[roomId].players, // Wysyła wszystkich graczy w pokoju, w tym personalizacje
            gameData: rooms[roomId].gameData
        });

        // Poinformuj innych graczy w pokoju, że nowy gracz dołączył, z uwzględnieniem personalizacji
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
                x: 50, // Początkowa pozycja X w świecie gry
                y: initialY,
                color: playersGlobal[socket.id].color,
                isJumping: false,
                velocityY: 0,
                username: playersGlobal[socket.id].username,
                isWalking: false,
                animationFrame: 0,
                isIdle: true,
                idleAnimationFrame: 0,
                direction: 1, // Domyślna kierunek
                velocityX: 0, // Domyślna prędkość
                currentMouseX: undefined, // Będzie aktualizowane przez playerInput
                currentMouseY: undefined, // Będzie aktualizowane przez playerInput
                // NEW: Dołącz personalizacje gracza do danych w pokoju
                customizations: { ...playersGlobal[socket.id].customizations },
                 // --- INICJALIZACJA ZMIENNYCH WĘDKOWANIA DLA NOWEGO GRACZA W POKOJU ---
                hasLineCast: false,
                floatWorldX: null,
                floatWorldY: null,
                floatVelocityX: 0,
                floatVelocityY: 0,
                lineAnchorWorldX: null,
                lineAnchorWorldY: null,
                rodTipWorldX: null, // Początkowo null, obliczy serwer
                rodTipWorldY: null, // Początkowo null, obliczy serwer
                // --- KONIEC INICJALIZACJI ---
            };
            rooms[roomId].playerInputs[socket.id] = { keys: {}, currentMouseX: undefined, currentMouseY: undefined };


            socket.emit('roomJoined', {
                roomId: roomId,
                roomName: rooms[roomId].name,
                playersInRoom: rooms[roomId].players, // Wysyła wszystkich graczy w pokoju, w tym personalizacje
                gameData: rooms[roomId].gameData
            });

            // Rozsyłanie danych o dołączającym graczu do innych, z uwzględnieniem personalizacji
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
            delete rooms[roomId].playerInputs[socket.id]; // Usuń inputy gracza
            playersGlobal[socket.id].currentRoomId = null;

            socket.to(roomId).emit('playerLeftRoom', socket.id);

            if (Object.keys(rooms[roomId].players).length === 0 || rooms[roomId].hostId === socket.id) {
                console.log(`Pokój ${roomId} jest pusty lub host (${rooms[roomId].hostId}) opuścił pokój. Pokój został usunięty.`);
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

    // Nowe wydarzenie: klient wysyła tylko swoje intencje/inputy
    socket.on('playerInput', (inputData) => {
        const roomId = playersGlobal[socket.id].currentRoomId;
        if (roomId && rooms[roomId] && rooms[roomId].playerInputs[socket.id]) {
            // Zaktualizuj tylko te pola, które są przesyłane przez klienta
            rooms[roomId].playerInputs[socket.id].keys = inputData.keys;
            rooms[roomId].playerInputs[socket.id].currentMouseX = inputData.currentMouseX;
            rooms[roomId].playerInputs[socket.id].currentMouseY = inputData.currentMouseY;
        }
    });

    // Obsługa skoku jako oddzielne wydarzenie, aby był bardziej responsywny
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

    // NEW: Obsługa aktualizacji personalizacji
    socket.on('updateCustomization', (newCustomizations) => {
        const playerId = socket.id;
        const roomId = playersGlobal[playerId].currentRoomId;

        if (roomId && rooms[roomId] && rooms[roomId].players[playerId]) {
            // Zaktualizuj personalizacje w globalnym obiekcie gracza
            // Użyj Object.assign, aby zaktualizować tylko wysłane właściwości
            Object.assign(playersGlobal[playerId].customizations, newCustomizations);
            // Zaktualizuj personalizacje w obiekcie gracza w pokoju
            Object.assign(rooms[roomId].players[playerId].customizations, newCustomizations);

            // Rozgłoś aktualizację do wszystkich innych graczy w tym pokoju
            socket.to(roomId).emit('playerCustomizationUpdated', {
                id: playerId,
                customizations: rooms[roomId].players[playerId].customizations
            });
        }
    });

    // --- NOWE: Obsługa zdarzeń wędkowania ---
    socket.on('castFishingLine', (data) => {
        const roomId = playersGlobal[socket.id].currentRoomId;
        if (roomId && rooms[roomId] && rooms[roomId].players[socket.id]) {
            const player = rooms[roomId].players[socket.id];
            // Sprawdź, czy gracz ma wędkę i nie ma jeszcze zarzuconej linki
            if (player.customizations.rightHandItem === 'rod' && !player.hasLineCast) {
                player.hasLineCast = true;

                // Użyj danych z klienta dla początkowej prędkości i pozycji startowej.
                // Serwer jest autorytatywny, więc te wartości są traktowane jako żądanie klienta.
                player.floatVelocityX = data.power * CASTING_POWER_MULTIPLIER * Math.cos(data.angle);
                player.floatVelocityY = data.power * CASTING_POWER_MULTIPLIER * Math.sin(data.angle);

                // Serwer zaufuje pozycji końca wędki wysłanej przez klienta jako punkt startowy
                // (w bardziej zaawansowanym systemie serwer by to zweryfikował lub przeliczył na nowo).
                player.floatWorldX = data.startX;
                player.floatWorldY = data.startY;

                player.lineAnchorWorldX = null; // Spławik nie jest jeszcze zakotwiczony
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
    // --- KONIEC OBSŁUGI ZDARZEŃ WĘDKOWANIA ---


    socket.on('disconnect', () => {
        console.log('Gracz rozłączony:', socket.id);
        const roomId = playersGlobal[socket.id] ? playersGlobal[socket.id].currentRoomId : null;

        if (roomId && rooms[roomId]) {
            delete rooms[roomId].players[socket.id];
            delete rooms[roomId].playerInputs[socket.id]; // Usuń inputy gracza
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
}); // <-- Ta klamra zamyka io.on('connection')

// --- Pętla gry na serwerze ---
setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const groundLevel = room.gameData?.groundLevel || 0;
        const groundY_target_for_player_top = DEDICATED_GAME_HEIGHT - groundLevel - PLAYER_SIZE;

        for (const playerId in room.players) {
            const player = room.players[playerId];
            const playerInput = room.playerInputs[playerId] || { keys: {} }; // Pobierz input klienta

            let targetVelocityX = 0;
            if (playerInput.keys['ArrowLeft']) {
                targetVelocityX = -PLAYER_WALK_SPEED;
                player.direction = -1;
            } else if (playerInput.keys['ArrowRight']) {
                targetVelocityX = PLAYER_WALK_SPEED;
                player.direction = 1;
            }

            // Aplikuj hamowanie lub ustaw prędkość docelową
            if (!playerInput.keys['ArrowLeft'] && !playerInput.keys['ArrowRight']) {
                player.velocityX *= DECELERATION_FACTOR;
                if (Math.abs(player.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION) {
                    player.velocityX = 0;
                }
            } else {
                player.velocityX = targetVelocityX;
            }

            player.x += player.velocityX;

            // Ogranicz pozycję X w świecie gry
            player.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, player.x));

            // === POPRAWIONA LOGIKA GRAWITACJI I ZIEMII ===
            // 1. Zawsze upewnij się, że gracz nie "przeszedł" przez ziemię
            if (player.y > groundY_target_for_player_top) {
                player.y = groundY_target_for_player_top;
                player.isJumping = false; // Gracz jest na ziemi, więc nie skacze
                player.velocityY = 0;
            }

            // 2. Jeśli gracz skacze LUB jest w powietrzu (powyżej ziemi), zastosuj grawitację
            if (player.isJumping || player.y < groundY_target_for_player_top) {
                player.velocityY += GRAVITY; // Grawitacja zmniejsza prędkość w górę, zwiększa w dół
                player.y += player.velocityY;

                // Ponowne sprawdzenie, czy gracz dotknął ziemi po aktualizacji pozycji
                if (player.y >= groundY_target_for_player_top) {
                    player.y = groundY_target_for_player_top;
                    player.isJumping = false;
                    player.velocityY = 0;
                }
            }
            // ============================================

            const isOnGround = (player.y >= groundY_target_for_player_top - 1 && player.y <= groundY_target_for_player_top + 1);

            player.isWalking = Math.abs(player.velocityX) > MIN_VELOCITY_FOR_WALK_ANIMATION && isOnGround;
            
            const isStationaryHorizontal = Math.abs(player.velocityX) < MIN_VELOCITY_FOR_WALK_ANIMATION;
            player.isIdle = !player.isWalking && !player.isJumping && isStationaryHorizontal && isOnGround;

            // Logika aktualizacji klatek animacji
            if (player.isWalking) {
                const speedFactor = Math.abs(player.velocityX / PLAYER_WALK_SPEED);
                player.animationFrame = (Number(player.animationFrame ?? 0) + (1 * speedFactor)) % ANIMATION_CYCLE_LENGTH;
                player.idleAnimationFrame = 0;
            } else if (player.isIdle) {
                player.animationFrame = 0;
                player.idleAnimationFrame = (Number(player.idleAnimationFrame ?? 0) + 1) % IDLE_ANIM_CYCLE_LENGTH;
            } else {
                // Gdy gracz skacze lub nie jest ani w ruchu ani w bezczynności (np. w powietrzu po skoku bez ruchu horyzontalnego)
                player.animationFrame = 0;
                player.idleAnimationFrame = 0;
            }

            // Aktualizuj również currentMouseX/Y dla innych graczy do śledzenia wzroku
            player.currentMouseX = playerInput.currentMouseX;
            player.currentMouseY = playerInput.currentMouseY;

            // --- NOWA LOGIKA: OBLICZANIE KOŃCA WĘDKI I FIZYKA SPŁAWIKA NA SERWERZE ---
            // ZAWSZE obliczaj pozycję końca wędki, jeśli gracz ma wędkę wyposażoną
            if (player.customizations && player.customizations.rightHandItem === 'rod') {
                const rodTip = calculateRodTipWorldPosition(player);
                player.rodTipWorldX = rodTip.x;
                player.rodTipWorldY = rodTip.y;

                if (player.hasLineCast) {
                    // Jeśli spławik nie jest zakotwiczony, stosuj grawitację
                    if (player.lineAnchorWorldY === null) {
                        player.floatVelocityY += FLOAT_GRAVITY;
                        player.floatWorldX += player.floatVelocityX;
                        player.floatWorldY += player.floatVelocityY;

                        // Sprawdź kolizję z wodą
                        if (player.floatWorldY + FLOAT_HITBOX_RADIUS >= WATER_TOP_Y_WORLD) {
                            player.floatWorldY = WATER_TOP_Y_WORLD - FLOAT_HITBOX_RADIUS; // Ustaw na powierzchni wody
                            player.floatVelocityY = 0;
                            player.floatVelocityX *= FLOAT_WATER_FRICTION; // Zmniejsz prędkość poziomą
                            player.lineAnchorWorldX = player.floatWorldX; // Zakotwicz spławik
                            player.lineAnchorWorldY = player.floatWorldY;
                        }
                    } else {
                        // Spławik jest zakotwiczony, ale wciąż może dryfować z niewielką prędkością
                        player.floatVelocityX *= FLOAT_WATER_FRICTION;
                        player.floatWorldX += player.floatVelocityX;
                        player.floatWorldY = player.lineAnchorWorldY; // Zakotwiczony na Y

                        if (Math.abs(player.floatVelocityX) < 0.1) {
                            player.floatVelocityX = 0;
                        }
                    }
                }
            } else {
                // Jeśli wędka nie jest wyposażona lub została zdjęta, zresetuj stan wędkowania
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
            // --- KONIEC LOGIKI WĘDKOWANIA NA SERWERZE ---
        }

        // Wyślij zaktualizowany stan WSZYSTKICH graczy w tym pokoju do WSZYSTKICH klientów w tym pokoju
        io.to(roomId).emit('playerMovedInRoom', Object.values(room.players));
    }
}, GAME_TICK_RATE); // Uruchamiaj pętlę gry 60 razy na sekundę

function getPublicRoomList() {
    const publicRooms = {};
    for (const roomId in rooms) {
        publicRooms[roomId] = {
            id: rooms[roomId].id,
            name: rooms[roomId].name,
            hostId: rooms[roomId].hostId,
            playerCount: Object.keys(rooms[roomId].players).length
        };
    }
    return publicRooms;
}

server.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);

});
