#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Node/npx is in PATH if using NVM
if [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_NODE=$(ls "$HOME/.nvm/versions/node" | tail -n 1)
  export PATH="$HOME/.nvm/versions/node/$LATEST_NODE/bin:$PATH"
fi

if [ ! -d "dist-electron/linux-unpacked" ]; then
  echo "==> Building frontend and linux-unpacked..."
  npx electron-builder --linux --dir
fi

STAGING="/tmp/pyshield_deb_staging"
rm -rf "$STAGING"
mkdir -p "$STAGING/DEBIAN"
mkdir -p "$STAGING/opt/pyshield-studio"
mkdir -p "$STAGING/usr/bin"
mkdir -p "$STAGING/usr/share/applications"

# Copy unpacked app
cp -a dist-electron/linux-unpacked/* "$STAGING/opt/pyshield-studio/"

# Create launcher script in /usr/bin
cat << "EOF" > "$STAGING/usr/bin/pyshield-studio"
#!/bin/sh
exec "/opt/pyshield-studio/pyshield-studio" "$@"
EOF
chmod 0755 "$STAGING/usr/bin/pyshield-studio"

# Copy icons
for size in 16x16 32x32 48x48 64x64 128x128 256x256 512x512; do
  mkdir -p "$STAGING/usr/share/icons/hicolor/$size/apps"
  cp "electron/icons/$size.png" "$STAGING/usr/share/icons/hicolor/$size/apps/pyshield-studio.png"
done

# Create desktop file
cat << "EOF" > "$STAGING/usr/share/applications/pyshield-studio.desktop"
[Desktop Entry]
Name=PyShield Studio
Exec=/opt/pyshield-studio/pyshield-studio %U
Terminal=false
Type=Application
Icon=pyshield-studio
StartupWMClass=pyshield-studio
Comment=PyShield Studio - Offline Proctored Python Notebook & Security IDE
Categories=Development;IDE;
EOF

# Create Debian control file
INSTALLED_SIZE=$(du -sk "$STAGING/opt" | cut -f1)
cat << EOF > "$STAGING/DEBIAN/control"
Package: pyshield-studio
Version: 1.0.1
Section: devel
Priority: optional
Architecture: amd64
Installed-Size: $INSTALLED_SIZE
Maintainer: PyShield Team <support@pyshield.dev>
Homepage: https://github.com/yash12345-ctrl/PyShield-Studio
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Description: PyShield Studio - Offline Proctored Python Notebook & Security IDE
 PyShield Studio provides a secure, monitored environment for running and developing
 Python code with offline kernel execution and automated exam proctoring.
EOF

# Set sandbox permissions and create postinst script
chmod 4755 "$STAGING/opt/pyshield-studio/chrome-sandbox" 2>/dev/null || true

cat << "EOF" > "$STAGING/DEBIAN/postinst"
#!/bin/sh
set -e
if [ -f "/opt/pyshield-studio/chrome-sandbox" ]; then
  chmod 4755 "/opt/pyshield-studio/chrome-sandbox" || true
fi
EOF
chmod 0755 "$STAGING/DEBIAN/postinst"

# Build DEB using native dpkg-deb
mkdir -p dist-electron
dpkg-deb --build --root-owner-group "$STAGING" "dist-electron/pyshield-studio_1.0.1_amd64.deb"

rm -rf "$STAGING"
echo "==> Debian package generated successfully at dist-electron/pyshield-studio_1.0.1_amd64.deb"
