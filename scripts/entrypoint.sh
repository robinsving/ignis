#!/bin/bash
set -e

# Create user with specified UID/GID
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Create group if GID doesn't exist, otherwise use existing
if ! getent group "$PGID" >/dev/null 2>&1; then
  groupadd -g "$PGID" ignis
else
  EXISTING_GROUP=$(getent group "$PGID" | cut -d: -f1)
  echo "[ignis] Using existing group $EXISTING_GROUP (GID $PGID)"
fi

# Create user if UID doesn't exist, otherwise use existing
if ! id -u "$PUID" >/dev/null 2>&1; then
  GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)
  useradd -u "$PUID" -g "$PGID" -m -s /bin/bash ignis 2>/dev/null || useradd -u "$PUID" -g "$GROUP_NAME" -M -N ignis
  RUN_USER="ignis"
else
  RUN_USER=$(id -un "$PUID")
  echo "[ignis] Using existing user $RUN_USER (UID $PUID)"
fi

# Fix ownership of volumes
chown -R "$PUID:$PGID" /vaults /app/obsidian-app

OBSIDIAN_DIR="/app/obsidian-app"
OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.4}"

if [ ! -f "$OBSIDIAN_DIR/index.html" ]; then
  echo "[ignis] First run. Downloading Obsidian v${OBSIDIAN_VERSION}..."

  curl -fSL "https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian_${OBSIDIAN_VERSION}_amd64.deb" \
    -o /tmp/obsidian.deb

  echo "[ignis] Extracting .deb..."
  mkdir -p /tmp/obsidian-deb /tmp/obsidian-pkg
  ar x /tmp/obsidian.deb --output=/tmp/obsidian-deb
  tar -xf /tmp/obsidian-deb/data.tar.xz -C /tmp/obsidian-pkg

  echo "[ignis] Unpacking asar..."
  npx --yes @electron/asar extract \
    /tmp/obsidian-pkg/opt/Obsidian/resources/obsidian.asar \
    "$OBSIDIAN_DIR"

  rm -rf /tmp/obsidian.deb /tmp/obsidian-deb /tmp/obsidian-pkg

  echo "[ignis] Obsidian v${OBSIDIAN_VERSION} ready."
else
  echo "[ignis] Obsidian already set up."
fi

# Always patch and copy latest bundles (they may have been updated between rebuilds)
node /app/scripts/patch-obsidian.js "$OBSIDIAN_DIR"
cp /app/dist/ignis-ui.js "$OBSIDIAN_DIR/ignis-ui.js"
cp /app/dist/shim-loader.js "$OBSIDIAN_DIR/shim-loader.js"
cp /app/images/favicon.png "$OBSIDIAN_DIR/favicon.png"

# Run as the determined user
exec gosu "$RUN_USER" node /app/server/index.js