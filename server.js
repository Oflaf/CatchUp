const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);

// === NOWA, POPRAWIONA KONFIGURACJA SOCKET.IO ===
const io = socketIo(server, {
  cors: {
    origin: "*", // Na produkcji warto to zawęzić do adresu Twojej strony
    methods: ["GET", "POST"]
  }
});
// ===============================================

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Konfiguracja Peer Server pozostaje taka sama jak w poprzedniej sugestii
const peerServer = ExpressPeerServer(server, {
    debug: true,
});

app.use('/peerjs', peerServer);


// === POCZĄTEK BLOKU DIAGNOSTYCZNEGO DLA PEER SERVER ===
peerServer.on('connection', (client) => {
    console.log(`[PeerServer] SUKCES: Klient połączył się z ID: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`[PeerServer] INFO: Klient rozłączył się z ID: ${client.getId()}`);
});

peerServer.on('error', (error) => {
    console.error(`[PeerServer] BŁĄD KRYTYCZNY:`, error);
});
// === KONIEC BLOKU DIAGNOSTYCZNEGO ===


// Reszta Twojego kodu socket.io bez zmian...
let activeHosts = {};

io.on('connection', (socket) => {
    console.log(`[Socket.IO] Połączono klienta sygnalizacyjnego: ${socket.id}`);
    // ... i tak dalej
    // ... cały Twój kod obsługi 'register-host', 'disconnect' itd.
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
    console.log(`Serwer SYGNALIZACYJNY I PEERJS działają na porcie ${PORT}`);
});