#!/bin/bash
set -e

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

exec node /app/server/index.js
