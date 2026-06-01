# Changelog

All notable changes to this project will be documented in this file.

## [0.8.3] - Karm (2026-06-01)

### Added

- `WS_ORIGINS` env var to restrict allowed `Origin` headers on WebSocket connections.

### Fixed

- Ignis version is now rendered correctly.
- Tables in editing mode now render correctly in Firefox.

## [0.8.2] - Karm (2026-05-23)

### Fixed

- Various app menus crash when "Use native menus" enabled. Solved by forcing the setting off internally; the on-disk value is preserved across toggles.
- `/api/fs/rename` and `/api/fs/copyFile` reject missing path fields with 400 instead of silently resolving to the vault root.

## [0.8.1] - Karm (2026-05-17)

### Added

- "Available version" indicator in Ignis settings now links to the release page on GitHub.

### Fixed

- Update check no longer reports a new version available when only the SemVer build metadata differs.

## [0.8.0] - Karm (2026-05-16)

### Added

- Demo mode: per-session vaults, auto-cleanup, proxy allowlist, login blocking. See [examples/demo/](examples/demo/).
- No-op guard in the bridge plugin and headless-sync plugin when loaded outside Ignis.
- "Open workspace in new tab" command now loads the workspace preset rather than the per-tab live state.
- Real digests for `crypto.createHash` (SHA-1/SHA-256/SHA-512/MD5) via `@noble/hashes`.
- `LEGAL.md` with the full EU Software Directive rationale.

### Changed

- Obsidian pinned at 1.12.7.
- Entrypoint downloads `.asar.gz` instead of `.deb`. Smaller image, simpler extraction.
- FS shim path translation moved from the transport layer up to the shim's public surface, so caches and metadata operate only on physical paths.
- Readme cleanup.

### Fixed

- `navigator.vibrate` made conditional. Firefox setups with `dom.vibrator.enabled` off no longer hit a `TypeError`.
- Write coalescer no longer holds HTTP responses open for the full debounce window. Buffered writes return immediately with synthetic mtime/size; only the first/stale writes wait on disk.
- Prefetch race in workspaces-per-tab resolved by the path-translation refactor.

## [0.7.6] - Orm (2026-04-05)

### Changed

- file patching to in-flight injection

## [0.7.5] - Orm (2026-04-05)

### Added

- per tab workspaces
- self-host auth examples
- better documentation

## [0.7.4] - Orm (2026-03-30)

### Added

- guards against running Obsidian sync and headless sync simultaneously

### Changed

- improved status indicator for headless sync

## [0.7.3] - Orm (2026-03-30)

### Added

- status bar indicator for headless sync

## [0.7.2] - Orm (2026-03-29)

### Added

- utils shim

### Fixed

- right sidebar toggle with css overrides
- clipboard functionality

## [0.7.1] - Orm (2026-03-29)

### Added

- Server plugin system
- obsidian-headless integration via server plugin

## [0.6.4] - Slifer (2026-03-24)

### Added

- Context menu items for downloading files and folders

## [0.6.3] - Slifer (2026-03-24)

### Changed

- Use stack fingerprinting to identify caller context for file staging registry

## [0.6.2] - Slifer (2026-03-24)

### Added

- File watcher system with WebSocket-based live sync for external vault changes
- Real-time detection of file create, modify, delete, and rename operations
- Echo guard to suppress events from local operations (prevents feedback loops)
- Automatic reconnection with exponential backoff for WebSocket client

## [0.6.1] - Slifer (2026-03-24)

### Added

- `fetch()` shim that proxies cross-origin requests through `/api/proxy` to bypass CORS restrictions
- Automatic `Origin: app://obsidian.md` header injection for cross-origin requests to match Obsidian desktop app
- User-Agent forwarding from browser to proxy for cross-origin requests

### Fixed

- Obsidian Sync API authentication now works in browser (was blocked by CORS)
- Proxy response headers cleaned to exclude hop-by-hop headers (`content-encoding`, `transfer-encoding`, `content-length`, `connection`)

## [0.6.0] - Slifer (2026-03-23)

### Added

- `zlib` shim using `pako` library for compression/decompression operations (deflate, inflate, gzip, gunzip, etc.)
- File descriptor operations: `fs.open()`, `fs.read()`, `fs.close()`, `fs.fstat()` and sync variants
- `fs.promises.open()` returning FileHandle objects with `stat()`, `read()`, `close()` methods
- `showOpenDialog` electron dialog shim with browser file picker and vault upload
- `showOpenDialogSync` hacky workaround using file staging registry and two-step upload flow
- Enhanced `Buffer` shim with `alloc()`, `allocUnsafe()`, `byteLength()`, and `isEncoding()` methods

### Fixed

- `MessageDialog` modal dismiss error when confirm button clicked
- Dialog shim modal event ordering to prevent null reference errors

## [0.5.0] - Scatha (2026-03-22)

### Added

- Compression middleware (gzip/brotli) for API responses to reduce bandwidth
- Plugin installation prompt system with per-vault trust flags
- Versioning system with cache-busting query parameters on script URLs
- Option to install ignis-bridge plugin to vaults imported at runtime

### Changed

- Auto-creation of default vault now requires `AUTO_CREATE_DEFAULT=true` environment variable
- Script URLs (`ignis-ui.js`, `shim-loader.js`) now include version query params for automatic cache invalidation
- Cache headers: versioned assets cached for 1 year, non-versioned for 5 minutes

### Fixed

- Vault manager not displaying when no vaults exist
- `window.close()` now shows vault manager when no vault is configured

### Removed

- Unused `VAULT_PATH` environment variable fallback logic

## [0.4.0] - Gostir (2026-03-18)

### Added

- Vault management: create, rename, delete vaults
- Last active vault persistence: remembers which vault was open
- Plugin trust preservation: keeps plugin trust status when renaming vaults

### Changed

- Refactored vault operations into shared service

### Fixed

- Issues with dialogs and vault rename operations

---

_Changelog tracking started at version 0.4.0. For earlier versions, please refer to commit history._
