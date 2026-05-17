<section>
  <p align="center">
      <img src="images/ignis.png" alt="Ignis logo" width="200" height="200">
  </p>

  <h3 align="center">Ignis</h3>

  <p align="center">
    Run Obsidian in the browser. No remote desktop required.
  </p>

  <p align="center">
    <a href="https://ignis-demo.thiefling.com">Try the live demo</a>
  </p>
</section>

## What is this

Ignis is a compatibility shim that provides browser-compatible implementations of the Electron APIs used by Obsidian, allowing Obsidian to run in a standard browser while keeping your vault on the server. Obsidian is not included in or distributed with this project. The Docker container downloads Obsidian directly from its official source on first run.

## Why

While Obsidian's local-first approach works well for most users, options for accessing your own Obsidian installation remotely have been limited to VNC-based solutions with poor user experience. Ignis provides an alternative for users who want to access their own copy of Obsidian from a browser, in a close-to-native format.

## Project Status

What started as an experiment turned out to be more viable than expected, and the project has grown into a usable browser-based client with multi-vault support, file upload and download, workspaces opened across browser tabs, and live sync between tabs. I now use it as my everyday Obsidian instance and intend to maintain it for the foreseeable future.

Plugin compatibility depends on what APIs a plugin uses; most plugins built on Obsidian's plugin API work, anything requiring Node native modules or `child_process` doesn't. See [What doesn't work](#what-doesnt-work) for the full list of known limitations.

## What works

- All core editor features: markdown, canvas, bases, and the command palette.
- Context menus throughout the UI.
- Image rendering, inline image URLs, and image paste from the clipboard.
- Print to PDF, via a hidden popup iframe.
- Mobile UI auto-activates when the window is under 600 px wide.
- Themes and CSS snippets.
- Most community plugins built on Obsidian's plugin API.
- Cross-origin plugin requests via `requestUrl` and `fetch`, proxied through the server.
- Obsidian Sync, in self-hosted deployments with a logged-in browser tab open.

## What doesn't work

- Plugins that depend on Node native modules or `child_process` won't load.
- Streaming `zlib` classes (`createGzip`, `createDeflate`, etc.) aren't implemented. The synchronous and callback variants work via `pako`.
- The synchronous file picker (`dialog.showOpenDialogSync`), used by plugins like Importer, has a staged-files workaround: the shim asks you to pick once and serves the result on retry. Usable but rough.
- `safeStorage` is passthrough by design: `isEncryptionAvailable()` returns `false` and `encrypt`/`decrypt` are no-ops. Anything plugins store via `safeStorage` ends up as plaintext on disk. A server-side encrypted option is planned but not yet implemented; until then, treat anything `safeStorage` produces the same as anything else in the vault.

Compatibility for specific community plugins is tracked in [Issue #9](https://github.com/Nystik-gh/ignis/issues/9).

## What Ignis adds on top of default Obsidian features

**Vaults.**
- Custom UI for Obsidian's multi-vault support, allowing create, open, switch, rename, and delete. 
- Different vaults can be loaded in different browser tabs.

**Files.**
- File upload from the local machine via a ribbon icon, right-click on a folder -> Upload file, or drag-and-drop into the UI. 
- File and folder download via right-click any note -> **Download**, or any folder -> **Download as ZIP**.

**Multi-tab and workspaces.**
- Live file sync between browser tabs via WebSocket: open the same vault in two tabs and edits propagate within a second. 
- Saved workspaces can be opened in separate browser tabs via a `?workspace=` URL parameter, so each tab can hold a different layout of the same vault.
- The bridge plugin adds an "Open workspace in tab" command to the command palette.

**Server-side sync.** 
- Obsidian Headless is implemented as a server-side plugin that performs continuous sync without needing an active browser tab. Only one of Obsidian Sync or Obsidian Headless can run per vault.

**Server-side integration.** 
- Adds a plugin system inside the server itself, separate from Obsidian's community plugin system (WIP).
- Ignis-specific settings appear as their own tabs inside Obsidian's Settings modal.
- Status bar indicators surface server state and headless sync activity.

## Roadmap

**Planned:**
- Server parameter configuration from the Ignis settings panel (LRU cache size, write coalesce window, etc.)
- Continued shim work to support more community plugins.
- Server-side plugin system improvements.

**Eventually:**
- Multi-user support with OIDC for self-hosted shared deployments.
- Built-in auth, so a reverse proxy isn't required for basic protected use.

## Performance

A few design decisions worth knowing about for someone evaluating Ignis against large vaults or slow storage:

- A pre-compressed bootstrap response delivers vault info, vault list, metadata tree, and plugin list in a single call.
- Indexer pre-fetch warms the content cache so Obsidian's startup index hits cache instead of the network.
- An LRU content cache (50 MB by default) keeps memory use bounded regardless of vault size, so Ignis doesn't hold the whole vault in memory.
- Write coalescing debounces rapid writes for slow filesystems (rclone, FUSE, NFS, SMB).

## Browser compatibility

Tested in Chrome, Brave, and Firefox, with limited testing in Safari.

## Authentication

Ignis has **no built-in authentication** and serves plain HTTP by default. Both authentication and TLS termination are expected to be handled by whatever you put in front of it.

If you are exposing Ignis to the internet, **you should really** put an authentication layer in front of it. Options include:

- A reverse proxy with Basic Auth (nginx, Caddy, Traefik)
- An SSO proxy like Authelia, Authentik, or OAuth2 Proxy
- A VPN (Tailscale, WireGuard)
- Cloudflare Application Tunnel

Example for Basic Auth, and Authelia can be found [here](examples).

> [!CAUTION]
> Do not run Ignis on a public network without auth. Anyone with the url can read and write your vault files.



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

Then `docker compose up -d`. On first start the container downloads Obsidian from the official source and installs Obsidian Headless CLI. This takes a minute or two.

To build from source instead of pulling the image, clone the repo and replace `image: nobbe/ignis:latest` with `build: .`.

### Volumes

| Mount | Description |
| ----- | ----------- |
| `/vaults` | Vault storage. Each subdirectory is a vault. |
| `/data` | state persistence for various ignis specific functionality, plugin management, headless sync config, etc |
| `/app/obsidian-app` | Cached Obsidian assets. Persisting this avoids re-downloading on container recreate. |

### Environment Variables

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

Demo mode adds its own set of env vars (per-session vaults, auto-cleanup, proxy allowlist, login blocking). See [examples/demo/](examples/demo/) if you want to run a public demo deployment.

### Migrating an existing vault

Each subdirectory of `/vaults` is treated as a separate vault, so dropping in an existing Obsidian vault directory will make it available in Ignis.

### Upgrading Obsidian

Obsidian releases can include changes that break the compatibility shim. Each Ignis release pins a known-working Obsidian version through the `OBSIDIAN_VERSION` env var, so the recommended path is to wait for an Ignis release that bumps the version, pull the new image, and restart.

If you want to try a newer Obsidian version before Ignis updates, set `OBSIDIAN_VERSION` in your compose file. The entrypoint will download that version on next start, but there's no guarantee it'll work cleanly with the current shim.

### Backups

Vault data lives as ordinary files in `/vaults`. Back it up however you back up other server-side data; Ignis doesn't provide a built in backup mechanism.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, especially on how to report plugin compatibility issues. Check the [open issues](https://github.com/Nystik-gh/ignis/issues) for things to work on.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for details on the shim layer, plugin system, and server internals.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Legal Notice

Ignis is not affiliated with, endorsed by, or associated with Dynalist Inc. or Obsidian. It is an independently developed interoperability tool and contains no Obsidian source code, binaries, or assets. No part of Obsidian is distributed or included in this repository; the Docker container downloads Obsidian directly from its official source at runtime.

This work falls under the interoperability provisions of [Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng) (the EU Software Directive), Article 6. See [LEGAL.md](LEGAL.md) for the full rationale.

This project exists because its author uses Obsidian daily and wants to access it from a browser. There is no intent to harm Obsidian, Dynalist Inc., or their business. If you are a representative of Dynalist Inc. and wish to discuss this project, please reach out: ignis@thiefling.com