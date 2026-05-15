# Architecture

Ignis runs Obsidian in a browser by replacing its Electron backend with a shim layer that routes Node.js and Electron API calls to an Express server over HTTP and WebSocket.

## Overview

```
Browser                          Server
┌──────────────────────┐         ┌──────────────────────┐
│ Obsidian (unmodified)│         │ Express              │
│         ↕            │  HTTP   │   /api/fs/*          │
│ Shim layer           │ <────>  │   /api/vault/*       │
│   fs, electron, etc. │   WS    │   /api/plugins/*     │
│         ↕            │ <────>  │   /api/ext/:plugin/* │
│ Bridge plugin        │         │ Ignis plugins        │
└──────────────────────┘         └──────────────────────┘
                                          ↕
                                    Filesystem (vaults/)
```

The shim layer makes Obsidian think it's running in Electron. The bridge plugin adds Ignis-specific features inside Obsidian.

## Shim Layer

### Loading

The server serves its own `index.html` (in `server/assets/`) rather than Obsidian's. At startup it reads Obsidian's `index.html` once to discover which scripts Obsidian expects, then embeds that list in our HTML as a JSON array. The client-side HTML loads the shim loader and UI bundle first (non-deferred), then a small inline script dynamically injects Obsidian's scripts in order. Obsidian's files are never modified, read into responses, or transformed in transit.

The shim loader replaces the module system and makes a blocking HTTP request to fetch the vault's directory tree into memory. The request has to be blocking because Obsidian makes synchronous filesystem calls during page load, before the event loop is running, so the cache has to already be populated.

### Modules

| Module               | Implementation                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| `fs` / `original-fs` | HTTP transport + client-side metadata/content caches                              |
| `electron`           | ipcRenderer dispatcher, webFrame stubs                                            |
| `@electron/remote`   | Partial: clipboard (browser API), shell, dialog, Menu, BrowserWindow, nativeTheme |
| `path`               | path-browserify                                                                   |
| `crypto`             | Web Crypto (randomBytes, createHash, scrypt)                                      |
| `url`                | Browser URL API wrapper                                                           |
| `process`            | Platform/version stubs                                                            |
| `utils`              | Utility functions                                                                 |

Unknown modules return an empty proxy and log a warning. The shim exposes two console helpers, one showing everything that has been accessed and one showing what is missing.

### Filesystem

On page load the server returns the full directory tree, which gets cached in memory with paths, sizes, and modification times. Sync filesystem calls hit the cache rather than the network. File contents are cached in an LRU cache after first read.

Writes go through a server-side write coalescer (`server/write-coalescer.js`) designed for slow filesystems like rclone FUSE mounts. The first write to a file goes to disk immediately. Subsequent writes within a configurable window (default 5 seconds, `WRITE_COALESCE_MS`) are buffered in memory; the timer resets on each write. After the window elapses with no new writes, the buffered data is flushed to disk. Reads for pending paths serve the buffered content so clients never see stale data. All pending writes are flushed on graceful shutdown.

Sync calls use synchronous XHR to ensure blocking behavior. Async calls use fetch. Everything goes through a transport layer that handles vault ID injection, base64 encoding for binary files, and mapping HTTP error codes back to Node errno values.

### Translation registry

The shim has a registry (`src/shims/fs/transforms.js`) for hooks applied at the public shim surface, before caches or transport see the path. Three hook types:

- **Path resolvers** map a logical path to a physical path. Used by the workspaces shim to redirect reads and writes of `.obsidian/workspace.json` to `.obsidian/workspace.<name>.json` based on the `?workspace=` URL parameter, so each browser tab can hold a separate layout.
- **Read transforms** post-process bytes returned by a read (cache hit or transport miss). Used to mask the Obsidian Sync setting in `core-plugins.json` when headless-sync is active for the vault, and to override the `active` field on reads of `workspaces.json` so each tab sees its own workspace as selected.
- **Write transforms** pre-process bytes before a write hits the cache or transport. Used to override the `active` field on writes to `workspaces.json` so cross-tab disk state stays canonical.

All hooks are synchronous and registered at module load. Translation happens once at the shim entry; downstream layers (content cache, metadata cache, transport) operate only on resolved physical paths and as-stored bytes. This keeps cache keys coherent with what transport actually reads and writes, so prefetch and on-demand fetches share the same cache slot.

### IPC

IPC is implemented as a synchronous dispatcher that maps channel names to handlers.

### Obsidian Plugin Compatibility

Obsidian evals plugin code with its own require that checks its internal module map first, then falls back to the window-level require, which is the shim. Plugins that use the filesystem, path utilities, or crypto get the shim implementations without any changes. Plugins that need child processes or native addons won't work (for now)*.

__child_process may be shimmable, not yet explored__

## Vaults

Any subdirectory under the vault root is treated as a vault. The active vault is selected via a `?vault=` URL parameter. Without the queryparam, the last active vault is loaded, or the first discovered.

## Server

An Express server that handles filesystem operations, vault management, static file serving, and plugin route dispatch.

**Route groups:**
- `/api/fs/*`  - filesystem operations (read, write, stat, tree, mkdir, etc.)
- `/api/vault/*`  - vault CRUD and config
- `/api/plugins/*`  - Ignis plugin management (list, enable, disable) __WIP__
- `/api/ext/:pluginId/*`  - routes registered by individual Ignis plugins

**WebSocket:** A file watcher monitors vault directories and pushes change events to connected clients, keeping the client-side metadata and content caches in sync. The websocket is also used by the headless-sync plugin to report status.

**Bridge plugin auto-install:** On server startup and vault creation, the server copies the ignis-bridge plugin into each vault's `.obsidian/plugins/` directory.

## Plugins

Three things are called "plugin" in this project.

### Obsidian Plugins

Standard community and core Obsidian plugins. They work through the shim layer with no Ignis involvement beyond providing fs, path, and crypto.

### Bridge Plugin (ignis-bridge)

An Obsidian plugin auto-installed into every vault by the server. Source lives in `plugin/`, built to `plugin/main.js`.

It adds file actions to Obsidian's UI: file download, folder ZIP download, and file upload via ribbon icon and context menu. It also injects custom settings tabs into Obsidian's settings modal by monkey-patching `app.setting.onOpen`, currently providing an Ignis plugin management tab.

Not user-installable through Obsidian's plugin browser. Managed entirely by the server.

### Ignis Plugins

A basic plugin system for extending the server. Still early, the core lifecycle works but the API surface is minimal and likely to change.

An Ignis plugin is a Node.js package under `server/plugins/<name>/` that exports an id, name, and a `register` function. On load it receives a context object with access to config, the WebSocket server, a file watcher, an Express router, a logger, and a persistent data directory. Plugins are enabled and disabled per vault, with state persisted in `data/plugin-config.json`.

When enabled, a plugin's Express router is mounted at `/api/ext/<pluginId>/`. A plugin can also optionally bundle an Obsidian plugin, a directory containing a standard Obsidian plugin (manifest.json, main.js) that gets auto-installed into the vault on enable and removed on disable. This bridges the server and client sides: the Ignis plugin handles server logic and routes, while the bundled Obsidian plugin provides the in-app UI or behavior.