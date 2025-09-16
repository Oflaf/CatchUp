const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Prosta baza danych w pamięci do przechowywania aktywnych hostów (pokoi)
let activeHosts = {};

io.on('connection', (socket) => {
    console.log(`Połączono klienta sygnalizacyjnego: ${socket.id}`);

    // Wyślij nowo podłączonemu graczowi aktualną listę pokoi
    socket.emit('roomListUpdate', activeHosts);

    // Host rejestruje swój pokój
    socket.on('register-host', (roomData) => {
        // roomData powinna zawierać { peerId, name, biome, worldWidth, villageType }
        console.log(`Host zarejestrował pokój: ${roomData.name} z Peer ID: ${roomData.peerId}`);
        activeHosts[roomData.peerId] = {
            peerId: roomData.peerId,
            name: roomData.name,
            playerCount: 1, // Zaczyna od 1 (host)
            biome: roomData.biome,
            worldWidth: roomData.worldWidth,
            villageType: roomData.villageType,
            hostSocketId: socket.id // Przechowujemy ID socketa na wypadek rozłączenia
        };
        // Powiadom wszystkich o nowym pokoju
        io.emit('roomListUpdate', activeHosts);
    });
    
    // Klient informuje serwer, że dołączył do hosta (w celu aktualizacji playerCount)
    socket.on('notify-join', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount++;
            io.emit('roomListUpdate', activeHosts);
        }
    });
    
    // Klient informuje, że opuścił hosta
    socket.on('notify-leave', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount--;
            // Jeśli host jest sam i się rozłączy, usuwamy pokój
            // Ale główna logika usuwania jest przy rozłączeniu hosta
            if (activeHosts[hostPeerId].playerCount <= 0) {
                 delete activeHosts[hostPeerId];
            }
            io.emit('roomListUpdate', activeHosts);
        }
    });

    // Gdy host się rozłączy (zamknie kartę)
    socket.on('disconnect', () => {
        console.log(`Rozłączono klienta sygnalizacyjnego: ${socket.id}`);
        // Znajdź czy ten socket był hostem
        const hostPeerId = Object.keys(activeHosts).find(
            peerId => activeHosts[peerId].hostSocketId === socket.id
        );

        if (hostPeerId) {
            console.log(`Host ${activeHosts[hostPeerId].name} (${hostPeerId}) rozłączył się. Usuwanie pokoju.`);
            delete activeHosts[hostPeerId];
            // Powiadom wszystkich, że pokój został usunięty
            io.emit('roomListUpdate', activeHosts);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Serwer SYGNALIZACYJNY działa na porcie ${PORT}`);
});