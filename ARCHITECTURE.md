# Architecture

This document covers how the shim layer is structured.

## Loading

The index file is patched to run the shim loader first. It replaces the module system and makes a blocking HTTP request to fetch the vault's directory tree into memory. The request has to be blocking because Obsidian makes synchronous filesystem calls during page load, before the event loop is running, so the cache has to already be populated.

## Shims

| Module               | Implementation                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| `fs` / `original-fs` | HTTP transport + client-side metadata/content caches                              |
| `electron`           | ipcRenderer dispatcher, webFrame stubs                                            |
| `@electron/remote`   | Partial: clipboard (browser API), shell, dialog, Menu, BrowserWindow, nativeTheme |
| `path`               | path-browserify                                                                   |
| `crypto`             | Web Crypto (randomBytes, createHash, scrypt)                                      |
| `url`                | Browser URL API wrapper                                                           |
| `process`            | Platform/version stubs                                                            |

Unknown modules return an empty proxy and log a warning. The shim exposes two console helpers, one showing everything that has been accessed and one showing what is missing.

## Filesystem

On page load the server returns the full directory tree, which gets cached in memory with paths, sizes, and modification times. Sync filesystem calls hit the cache rather than the network. File contents are cached after first read and written through immediately on writes.

Sync calls use synchronous XHR, to ensure blocking behavior. Async calls use fetch. Everything goes through a transport layer that handles vault ID injection, base64 encoding for binary files, and mapping HTTP error codes back to Node errno values.

## IPC

IPC is faked with a synchronous dispatcher that maps channel names to handlers.

## Vaults

Any subdirectory under the vault root is treated as a vault. The active vault is selected via a URL parameter. A custom vault manager modal replaces Obsidian's native startup screen.

## Plugins

Obsidian evals plugin code with its own require that checks its internal module map first, then falls back to the window-level require, which is our shim. Plugins that use the filesystem, path utilities, or crypto get our implementations without any changes. Plugins that need child processes or native addons won't work.

## Server

A simple Express server that handles filesystem operations, vault management, and static file serving.
