#!/bin/bash
set -e

# Uruchom główny serwer gry w tle. 
# On automatycznie użyje portu $PORT (10000)
echo "Starting Game Server..."
npm start &

# Uruchom serwer PeerJS na INNYM, wewnętrznym porcie, np. 9000
echo "Starting PeerJS Server..."
npx peerjs --port 9000 --path /peerjs

# Czekaj na zakończenie procesu PeerJS
wait -n
