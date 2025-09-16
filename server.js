const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
// NIE MA TUTAJ 'const { ExpressPeerServer } = require('peer');'

const app = express();
const server = http.createServer(app);

// Poprawna konfiguracja Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Zmień na konkretny adres, jeśli wiesz co robisz
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;

app.use(express.static('public'));

// CAŁA SEKCJĘ Z 'peerServer' MUSIAŁO ZOSTAĆ USUNIĘTA.
// NIE MA TU ŻADNYCH LINI DO DEFINIOWANIA I PODPINANIA peerServer.

// Reszta kodu socket.io:
let activeHosts = {};

io.on('connection', (socket) => {
    console.log(`[Socket.IO] Połączono klienta sygnalizacyjnego: ${socket.id}`);

    socket.emit('roomListUpdate', activeHosts);

    socket.on('register-host', (roomData) => {
        console.log(`[Socket.IO] Host zarejestrował pokój: ${roomData.name} z Peer ID: ${roomData.peerId}`);
        activeHosts[roomData.peerId] = {
            peerId: roomData.peerId, name: roomData.name, playerCount: 1,
            biome: roomData.biome, worldWidth: roomData.worldWidth, villageType: roomData.villageType,
            hostSocketId: socket.id
        };
        io.emit('roomListUpdate', activeHosts);
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
            if (activeHosts[hostPeerId].playerCount <= 0) {
                 delete activeHosts[hostPeerId];
            }
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


server.listen(PORT, () => {
    console.log(`Serwer SYGNALIZACYJNY Socket.IO działa na porcie ${PORT}`);
});