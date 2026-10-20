#!/usr/bin/env bash
# PyShield Studio Desktop App Launcher
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXECUTABLE="$DIR/frontend/dist-electron/linux-unpacked/pyshield-studio"

if [ -f "$EXECUTABLE" ]; then
    echo "Launching PyShield Studio Desktop App..."
    "$EXECUTABLE" "$@" &
else
    echo "PyShield Studio executable not found. Running through Electron directly..."
    export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
    cd "$DIR/frontend" && npm run electron:start
fi
