# Ignis Server

The self-hosted Docker variant of Ignis. For the project overview, feature list, and what works / what doesn't, see the [root README](../../README.md).

## Contents

- [Authentication](#authentication)
- [Setup with Docker Compose](#setup-with-docker-compose)
- [Volumes](#volumes)
- [Environment Variables](#environment-variables)
- [Migrating an existing vault](#migrating-an-existing-vault)
- [Upgrading Obsidian](#upgrading-obsidian)
- [Backups](#backups)

## Authentication

Ignis has **no built-in authentication** and serves plain HTTP by default. Both authentication and TLS termination are expected to be handled by whatever you put in front of it.

If you are exposing Ignis to the internet, **you should really** put an authentication layer in front of it. Options include:

- A reverse proxy with Basic Auth (nginx, Caddy, Traefik)
- An SSO proxy like Authelia, Authentik, or OAuth2 Proxy
- A VPN (Tailscale, WireGuard)
- Cloudflare Application Tunnel

Example configurations for Basic Auth and Authelia are in [`examples/`](examples).

> [!CAUTION]
> Do not run Ignis on a public network without auth. Anyone with the URL can read and write your vault files.

## Setup with Docker Compose

Example `docker-compose.yml`:

```yaml
services:
  ignis:
    image: nobbe/ignis:latest
    ports:
      - "8080:8080"
    environment:
      - OBSIDIAN_VERSION=1.12.7
      - PUID=1000
      - PGID=1000
    volumes:
      - ./vaults:/vaults
      - ./data:/app/data
      - obsidian-app:/app/obsidian-app
    restart: unless-stopped

volumes:
  obsidian-app:
```

Then `docker compose up -d`. On first start the container downloads Obsidian from the official source and installs the Obsidian Headless CLI. This takes a minute or two.

To build from source instead of pulling the image, clone the repo and run `docker compose up` against the [`docker-compose.yml`](docker-compose.yml) in this directory.

## Volumes

| Mount | Description |
| ----- | ----------- |
| `/vaults` | Vault storage. Each subdirectory is a vault. |
| `/app/data` | State persistence for various Ignis-specific functionality: plugin management, headless sync config, etc. |
| `/app/obsidian-app` | Cached Obsidian assets. Persisting this avoids re-downloading on container recreate. |

## Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `PORT` | Server listen port | `8080` |
| `VAULT_ROOT` | Path to vault storage inside the container | `/vaults` |
| `DATA_ROOT` | Path to persistent data (plugin config, sync state, auth tokens) | `/app/data` |
| `OBSIDIAN_VERSION` | Obsidian version to download | `1.12.7` |
| `OBSIDIAN_ASSETS_PATH` | Where the extracted Obsidian app files live. Override if you're pointing at a pre-extracted directory instead of letting the entrypoint download. | `/app/obsidian-app` |
| `AUTO_CREATE_DEFAULT` | When `true`, creates a "My Vault" vault on startup if no vaults exist. Useful for fresh installs. | `false` |
| `PUID` | User ID for file ownership | `1000` |
| `PGID` | Group ID for file ownership | `1000` |
| `WRITE_COALESCE_MS` | Debounce window (ms) for rapid writes. Useful for slow filesystems (rclone, NFS, SMB). Set to `0` to disable. | `5000` |
| `WS_ORIGINS` | Comma-separated allowlist of `Origin` headers accepted on the WebSocket endpoint. When unset, any origin is accepted. | unset |

Demo mode adds its own set of env vars (per-session vaults, auto-cleanup, proxy allowlist, login blocking). See [`examples/demo/`](examples/demo/) if you want to run a public demo deployment.

## Migrating an existing vault

Each subdirectory of `/vaults` is treated as a separate vault, so dropping in an existing Obsidian vault directory will make it available in Ignis.

## Upgrading Obsidian

Obsidian releases can include changes that break the compatibility shim. Each Ignis release pins a known-working Obsidian version through the `OBSIDIAN_VERSION` env var, so the recommended path is to wait for an Ignis release that bumps the version, pull the new image, and restart.

If you want to try a newer Obsidian version before Ignis updates, set `OBSIDIAN_VERSION` in your compose file. The entrypoint will download that version on next start, but there is no guarantee it will work cleanly with the current shim.

## Backups

Vault data lives as ordinary files in `/vaults`. Back it up however you back up other server-side data; Ignis does not provide a built-in backup mechanism.
