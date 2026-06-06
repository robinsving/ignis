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


mkdir -p /app/data
chown -R "$PUID:$PGID" /vaults /app/obsidian-app /app/data

OBSIDIAN_DIR="/app/obsidian-app"
OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.7}"

if [ ! -f "$OBSIDIAN_DIR/index.html" ]; then
  echo "[ignis] First run. Downloading Obsidian v${OBSIDIAN_VERSION}..."

  curl -fSL "https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian-${OBSIDIAN_VERSION}.asar.gz" \
    -o /tmp/obsidian.asar.gz

  echo "[ignis] Unpacking asar..."
  gunzip /tmp/obsidian.asar.gz
  npx --yes @electron/asar extract /tmp/obsidian.asar "$OBSIDIAN_DIR"

  rm -f /tmp/obsidian.asar

  echo "[ignis] Obsidian v${OBSIDIAN_VERSION} ready."
else
  echo "[ignis] Obsidian already set up."
fi


# Install obsidian-headless (ob CLI) if not already present.
# Not included in the image for legal reasons - installed at runtime.
if ! command -v ob &>/dev/null; then
  echo "[ignis] Installing obsidian-headless..."

  if npm install -g --prefix /usr/local obsidian-headless --silent 2>/dev/null; then
    OB_VERSION=$(ob --version 2>/dev/null)

    if [ -n "$OB_VERSION" ]; then
      echo "[ignis] obsidian-headless $OB_VERSION installed."
    else
      echo "[ignis] WARNING: obsidian-headless installed but 'ob' command not working."
    fi
  else
    echo "[ignis] WARNING: Failed to install obsidian-headless. Headless sync will not be available."
  fi
else
  echo "[ignis] obsidian-headless $(ob --version 2>/dev/null) available."
fi

# Run as the determined user
exec gosu "$RUN_USER" node /app/apps/ignis-server/server/index.js