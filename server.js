const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet'); // Upewnij się, że jest zainstalowany: npm install helmet

const app = express();
const server = http.createServer(app);

// Poprawna konfiguracja Socket.IO z CORS
const io = socketIo(server, {
  cors: {
    origin: "*", // Zezwól na połączenia z dowolnego źródła
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000; // Domyślny port

app.use(express.static('public'));

// --- Nagłówki bezpieczeństwa i konfiguracja Helmet ---
// Używamy standardowej konfiguracji dla contentSecurityPolicy.
// Zapewnia podstawowe bezpieczeństwo i zezwala na połączenia WebSocket.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            // Domyślna polityka: tylko z tego samego źródła
            defaultSrc: ["'self'"], 
            // Pozwala na skrypty z tego samego źródła oraz inline skrypty
            scriptSrc: ["'self'", "'unsafe-inline'"], 
            // Pozwala na połączenia (w tym WebSockets) z tego samego źródła i dowolnego źródła (*)
            connectSrc: ["'self'", "*"], 
            // Pozwala na ładowanie obrazów z tego samego źródła oraz jako data URIs
            imgSrc: ["'self'", "data:"], 
            // Można dodać inne dyrektywy według potrzeb
            // 'upgrade-insecure-requests' zazwyczaj nie jest konieczne, jeśli nie masz problemów z HTTPS
        },
    },
    // Wyłączamy HSTS, jeśli nie używasz HTTPS lub nie masz pewności co do konfiguracji
    hsts: false, 
}));
// --- Koniec nagłówków bezpieczeństwa ---

// --- Endpoint do sprawdzania stanu serwera (Health Check) ---
app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy and running!');
});
// ------------------------------------------------------------

let activeHosts = {};

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
    console.log(`INFO: Railway assigned port: ${process.env.PORT || 'undefined'}`);
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