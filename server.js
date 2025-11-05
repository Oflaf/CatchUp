'use strict';

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

app.use(express.static('public'));
app.use(helmet({
    contentSecurityPolicy: { /* ... Twoje zasady ... */ },
    hsts: false, 
}));

app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy and running!');
});

// === SEKCJA ZARZĄDZANIA STANEM SERWERA ===
let activeHosts = {};
const HEARTBEAT_TIMEOUT = 30000;
const HEARTBEAT_CHECK_INTERVAL = 10000;

io.on('connection', (socket) => {
    // ... cała Twoja logika io.on('connection') ...
    console.log(`[Socket.IO] Połączono klienta sygnalizacyjnego: ${socket.id}`);
    socket.emit('roomListUpdate', activeHosts);

    socket.on('register-host', (roomData) => {
        console.log(`[Socket.IO] Host zarejestrował pokój: ${roomData.name} z Peer ID: ${roomData.peerId}`);
        activeHosts[roomData.peerId] = {
            peerId: roomData.peerId, name: roomData.name, playerCount: 1, 
            biome: roomData.biome, worldWidth: roomData.worldWidth, villageType: roomData.villageType,
            hostSocketId: socket.id, lastHeartbeat: Date.now()
        };
        io.emit('roomListUpdate', activeHosts);
    });
    
    socket.on('heartbeat', () => {
        const hostPeerId = Object.keys(activeHosts).find(
            peerId => activeHosts[peerId].hostSocketId === socket.id
        );
        if (hostPeerId && activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].lastHeartbeat = Date.now();
        }
    });
    
    socket.on('notify-join', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount++;
            io.emit('roomListUpdate', activeHosts);
        }
    });
    
    socket.on('notify-leave', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount--;
        }
    });

    socket.on('host-closing-room', (data) => {
        if (data && data.peerId && activeHosts[data.peerId]) {
            console.log(`[Socket.IO] Host ${activeHosts[data.peerId].name} (${data.peerId}) explicitly closed the room. Removing.`);
            delete activeHosts[data.peerId];
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

setInterval(() => {
    const now = Date.now();
    let hasListChanged = false;
    for (const hostPeerId in activeHosts) {
        if (now - activeHosts[hostPeerId].lastHeartbeat > HEARTBEAT_TIMEOUT) {
            console.log(`[Heartbeat] Host ${activeHosts[hostPeerId].name} (${hostPeerId}) przekroczył limit czasu. Usuwanie pokoju.`);
            delete activeHosts[hostPeerId];
            hasListChanged = true;
        }
    }
    if (hasListChanged) {
        console.log('[Heartbeat] Zaktualizowana lista pokoi została wysłana do wszystkich klientów.');
        io.emit('roomListUpdate', activeHosts);
    }
}, HEARTBEAT_CHECK_INTERVAL);

// Użyj portu zdefiniowanego przez Render, a lokalnie 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serwer GRY działa na porcie ${PORT}`);
});

// 6. Obsługa poprawnego zamykania
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