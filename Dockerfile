# Build shim-loader.js
FROM node:20-slim AS build

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY build.js ./
COPY src/ ./src/

RUN npm run build

# Production image. No Obsidian code included.
# On first run, the entrypoint downloads and patches Obsidian.
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl binutils xz-utils gosu \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server/ ./server/
COPY scripts/ ./scripts/
COPY images/ ./images/
COPY plugin/ ./plugin/
COPY --from=build /build/dist ./dist

RUN chmod +x /app/scripts/entrypoint.sh

ENV PORT=8080
ENV VAULT_ROOT=/vaults
ENV OBSIDIAN_VERSION=1.12.4
ENV OBSIDIAN_ASSETS_PATH=/app/obsidian-app
ENV PUID=1000
ENV PGID=1000

EXPOSE 8080

VOLUME /vaults
VOLUME /app/obsidian-app

ENTRYPOINT ["/app/scripts/entrypoint.sh"]