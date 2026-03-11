FROM node:20-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  binutils \
  xz-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY build.js ./
COPY shims/ ./shims/
COPY scripts/ ./scripts/
COPY server/ ./server/

RUN npm run build:shims


ARG OBSIDIAN_VERSION=1.8.9
RUN curl -fSL "https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian_${OBSIDIAN_VERSION}_amd64.deb" \
  -o /tmp/obsidian.deb \
  && mkdir -p /tmp/obsidian-deb \
  && ar x /tmp/obsidian.deb --output=/tmp/obsidian-deb \
  && mkdir -p /tmp/obsidian-pkg \
  && tar -xf /tmp/obsidian-deb/data.tar.xz -C /tmp/obsidian-pkg \
  && rm -rf /tmp/obsidian.deb /tmp/obsidian-deb


RUN npx --yes @electron/asar extract \
  /tmp/obsidian-pkg/opt/Obsidian/resources/obsidian.asar \
  /build/obsidian-app \
  && rm -rf /tmp/obsidian-pkg

# Patch index.html
RUN node scripts/patch-obsidian.js /build/obsidian-app

RUN cp dist/shim-loader.js /build/obsidian-app/shim-loader.js

# Production image
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server/ ./server/
COPY --from=build /build/obsidian-app ./obsidian-app

ENV PORT=8080
ENV VAULT_PATH=/vault
ENV OBSIDIAN_ASSETS_PATH=/app/obsidian-app

EXPOSE 8080

VOLUME /vault

CMD ["node", "server/index.js"]
