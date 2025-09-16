const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// Poprawna konfiguracja Socket.IO z CORS
const io = socketIo(server, {
  cors: {
    origin: "*", // Zezwól na połączenia z dowolnego źródła (na produkcję warto to ograniczyć)
    methods: ["GET", "POST"]
  }
});

// Użyj portu zdefiniowanego przez Railway (process.env.PORT) lub domyślnie 3000
// Railway zazwyczaj ustawia PORT na wyższą wartość, np. 8080.
const PORT = process.env.PORT || 8080;

app.use(express.static('public'));

// --- Endpoint do sprawdzania stanu serwera (Health Check) ---
// Pomaga Railway wiedzieć, że aplikacja działa poprawnie.
app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy and running!');
});
// ------------------------------------------------------------

let activeHosts = {};

io.on('connection', (socket) => {
    console.log(`[Socket.IO] Połączono klienta sygnalizacyjnego: ${socket.id}`);

    // Wysyłamy aktualną listę hostów do nowego klienta
    socket.emit('roomListUpdate', activeHosts);

    // Obsługa rejestracji nowego hosta
    socket.on('register-host', (roomData) => {
        console.log(`[Socket.IO] Host zarejestrował pokój: ${roomData.name} z Peer ID: ${roomData.peerId}`);
        activeHosts[roomData.peerId] = {
            peerId: roomData.peerId,
            name: roomData.name,
            playerCount: 1, // Początkowo 1 gracz (sam host)
            biome: roomData.biome,
            worldWidth: roomData.worldWidth,
            villageType: roomData.villageType,
            hostSocketId: socket.id // Zapisujemy ID socketu hosta do późniejszego usuwania
        };
        // Informujemy wszystkich o zmianie listy pokoi
        io.emit('roomListUpdate', activeHosts);
    });
    
    // Obsługa powiadomienia o dołączeniu gracza do pokoju
    socket.on('notify-join', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount++;
            io.emit('roomListUpdate', activeHosts); // Aktualizujemy listę dla wszystkich
        }
    });
    
    // Obsługa powiadomienia o opuszczeniu pokoju przez gracza
    socket.on('notify-leave', (hostPeerId) => {
        if(activeHosts[hostPeerId]) {
            activeHosts[hostPeerId].playerCount--;
            // Jeśli liczba graczy spadnie do 0, usuwamy pokój z listy
            if (activeHosts[hostPeerId].playerCount <= 0) {
                 delete activeHosts[hostPeerId];
            }
            io.emit('roomListUpdate', activeHosts); // Aktualizujemy listę dla wszystkich
        }
    });

    // Obsługa rozłączenia klienta sygnalizacyjnego
    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Rozłączono klienta sygnalizacyjnego: ${socket.id}`);
        
        // Sprawdzamy, czy rozłączony socket należał do hosta
        const hostPeerId = Object.keys(activeHosts).find(
            peerId => activeHosts[peerId].hostSocketId === socket.id
        );

        // Jeśli rozłączony socket był hostem, usuwamy jego pokój z listy
        if (hostPeerId) {
            console.log(`[Socket.IO] Host ${activeHosts[hostPeerId].name} (${hostPeerId}) rozłączył się. Usuwanie pokoju.`);
            delete activeHosts[hostPeerId];
            io.emit('roomListUpdate', activeHosts); // Informujemy wszystkich o usunięciu pokoju
        }
    });
});

// --- Uruchomienie serwera ---
server.listen(PORT, () => {
    console.log(`Serwer SYGNALIZACYJNY Socket.IO działa na porcie ${PORT}`);
    // Dodatkowy log, aby zobaczyć, jaki port faktycznie został użyty
    console.log(`INFO: Railway assigned port: ${process.env.PORT || 'undefined'}`);
});

// --- Obsługa sygnałów zamykania procesu (Graceful Shutdown) ---
// To pomaga aplikacji zamknąć się poprawnie, zamiast być nagle ubijaną.
process.on('SIGTERM', () => {
    console.log('Otrzymano sygnał SIGTERM. Zamykam serwer...');
    server.close(() => {
        console.log('Serwer HTTP zamknięty.');
        process.exit(0); // Zakończ proces z kodem 0 (sukces)
    });
});

process.on('SIGINT', () => { // Sygnał zamykania np. przez Ctrl+C w konsoli
    console.log('Otrzymano sygnał SIGINT. Zamykam serwer...');
    server.close(() => {
        console.log('Serwer HTTP zamknięty.');
        process.exit(0);
    });
});