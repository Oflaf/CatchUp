#!/bin/bash
set -e

echo "Starting Game Server in background..."
npm start &

echo "Starting PeerJS Server in foreground..."
npx peerjs --port 10000 --path /peerjs

wait -n