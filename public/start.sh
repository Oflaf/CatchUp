#!/bin/bash

# Ten skrypt uruchamia DWA serwery jednocześnie

# 1. Uruchom swój serwer gry w TLE (znak '&' na końcu).
# To sprawi, że będzie on działał, a skrypt przejdzie do następnej komendy.
echo "Uruchamianie serwera gry w tle..."
npm run start &

# 2. Uruchom serwer PeerJS na PIERWSZYM PLANIE.
# Ten proces utrzyma kontener Render przy życiu.
echo "Uruchamianie serwera PeerJS na porcie 10000..."
npx peerjs --port 10000 --path /peerjs