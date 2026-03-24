import { installRequire } from "./require.js";
import { installGlobals } from "./globals.js";
import { initialize } from "./init.js";
import { fsShim } from "./fs/index.js";

installGlobals(); // process, Buffer, window overrides (before require so Buffer is available)
installRequire(); // shim registry, window.require
initialize(); // vault config, metadata cache, plugin prompt

// Connect file watcher WebSocket after everything is initialized
if (window.__currentVaultId) {
  fsShim._watcherClient.connect(window.__currentVaultId);
}

console.log("[ignis] Shim loader initialized");
