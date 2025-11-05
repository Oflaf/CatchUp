const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;



app.use(express.static('public'));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"], 
            scriptSrc: ["'self'", "'unsafe-inline'"], 
            connectSrc: ["'self'", "*"], 
            imgSrc: ["'self'", "data:"], 
        },
    },
    hsts: false, 
}));

app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy and running!');
});

// === SEKCJA ZARZĄDZANIA STANEM SERWERA ===
let activeHosts = {};
// NOWE STAŁE: Konfiguracja mechanizmu Heartbeat
const HEARTBEAT_TIMEOUT = 30000;        // 30 sekund - czas, po którym host bez sygnału jest uznawany za nieaktywnego
const HEARTBEAT_CHECK_INTERVAL = 10000; // 10 sekund - jak często serwer sprawdza nieaktywnych hostów
// =========================================

io.on('connection', (socket) => {
    console.log(`[Socket.IO] Połączono klienta sygnalizacyjnego: ${socket.id}`);
    socket.emit('roomListUpdate', activeHosts);

    socket.on('register-host', (roomData) => {
        console.log(`[Socket.IO] Host zarejestrował pokój: ${roomData.name} z Peer ID: ${roomData.peerId}`);
        activeHosts[roomData.peerId] = {
            peerId: roomData.peerId,
            name: roomData.name,
            playerCount: 1, 
            biome: roomData.biome,
            worldWidth: roomData.worldWidth,
            villageType: roomData.villageType,
            hostSocketId: socket.id,
            lastHeartbeat: Date.now() // ZMIANA: Zapisujemy czas rejestracji jako pierwsze "bicie serca"
        };
        io.emit('roomListUpdate', activeHosts);
    });
    
    // NOWA SEKCJA: Nasłuchiwanie na sygnał "życia" od hosta
    socket.on('heartbeat', () => {
        // Znajdujemy hosta na podstawie ID gniazda, które wysłało sygnał.
        // Jest to bezpieczniejsze niż poleganie na danych od klienta.
        const hostPeerId = Object.keys(activeHosts).find(
            peerId => activeHosts[peerId].hostSocketId === socket.id
        );

        if (hostPeerId && activeHosts[hostPeerId]) {
            // Jeśli host istnieje, aktualizujemy jego czas ostatniego sygnału
            activeHosts[hostPeerId].lastHeartbeat = Date.now();
        }
    });
    // =========================================================
    
    socket.on('notify-join', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount++;
            io.emit('roomListUpdate', activeHosts);
        }
    });
    
    socket.on('notify-leave', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount--;
            // Usuniemy pokój tylko jeśli host się rozłączy, a nie gdy ostatni gracz wyjdzie
            // To zapobiega usuwaniu pustego pokoju, w którym host czeka na graczy.
            // Mechanizm disconnect i heartbeat są teraz głównymi sposobami czyszczenia.
        }
    });

    socket.on('host-closing-room', (data) => {
        if (data && data.peerId && activeHosts[data.peerId]) {
            console.log(`[Socket.IO] Host ${activeHosts[data.peerId].name} (${data.peerId}) explicitly closed the room. Removing.`);
            delete activeHosts[data.peerId];
            // Poinformuj wszystkich pozostałych klientów o zaktualizowanej liście pokoi
            io.emit('roomListUpdate', activeHosts);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Rozłączono klienta sygnalizacyjnego: ${socket.id}`);
        const hostPeerId = Object.keys(activeHosts).find(
            peerId => activeHosts[peerId].hostSocketId === socket.id
        );
        if (hostPeerId) {
            console.log(`[Socket.IO] Host ${activeHosts[hostPeerId].name} (${hostPeerId}) rozłączył się. Usuwanie pokoju.`);
            delete activeHosts[hostPeerId];
            io.emit('roomListUpdate', activeHosts);
        }
    });
});

// NOWA SEKCJA: Pętla sprawdzająca i czyszcząca nieaktywnych hostów
setInterval(() => {
    const now = Date.now();
    let hasListChanged = false; // Flaga, aby wysyłać aktualizację tylko, gdy coś się zmieni

    for (const hostPeerId in activeHosts) {
        // Sprawdzamy, czy czas od ostatniego sygnału przekroczył nasz limit
        if (now - activeHosts[hostPeerId].lastHeartbeat > HEARTBEAT_TIMEOUT) {
            console.log(`[Heartbeat] Host ${activeHosts[hostPeerId].name} (${hostPeerId}) przekroczył limit czasu. Usuwanie pokoju.`);
            delete activeHosts[hostPeerId];
            hasListChanged = true;
        }
    }

    // Jeśli usunęliśmy jakichś hostów, poinformuj wszystkich klientów o nowej liście
    if (hasListChanged) {
        console.log('[Heartbeat] Zaktualizowana lista pokoi została wysłana do wszystkich klientów.');
        io.emit('roomListUpdate', activeHosts);
    }
}, HEARTBEAT_CHECK_INTERVAL);
// =================================================================

server.listen(PORT, () => {
    console.log(`Serwer SYGNALIZACYJNY Socket.IO działa na porcie ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('Otrzymano sygnał SIGTERM. Zamykam serwer...');
    server.close(() => {
        console.log('Serwer HTTP zamknięty.');
        process.exit(0);
    });
});

process.on('SIGINT', () => { 
    console.log('Otrzymano sygnał SIGINT. Zamykam serwer...');
    server.close(() => {
        console.log('Serwer HTTP zamknięty.');
        process.exit(0);
    });
});