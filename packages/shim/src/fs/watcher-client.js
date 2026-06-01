// Bridges WebSocket file events to the fs shim's metadata/content caches and fs.watch listeners.
// The WebSocket itself is owned by ws-client.js; this module is a consumer.

import { isRecentLocalOp } from "./echo-guard.js";

export function createWatcherClient(metadataCache, contentCache, fsWatch, wsClient) {
  function handleCreated(msg) {
    const { path, stat } = msg;

    if (!path || isRecentLocalOp(path)) {
      return;
    }

    if (stat) {
      metadataCache.set(path, {
        type: "file",
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
      });
    }

    contentCache.invalidate(path);
    fsWatch._dispatch("created", path);
  }

  function handleFolderCreated(msg) {
    const { path } = msg;

    if (!path || isRecentLocalOp(path)) {
      return;
    }

    metadataCache.set(path, { type: "directory" });
    fsWatch._dispatch("folder-created", path);
  }

  function handleModified(msg) {
    const { path, stat } = msg;

    if (!path || isRecentLocalOp(path)) {
      return;
    }

    if (stat) {
      metadataCache.set(path, {
        type: "file",
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
      });
    }

    contentCache.invalidate(path);
    fsWatch._dispatch("modified", path);
  }

  function handleDeleted(msg) {
    const { path } = msg;

    if (!path || isRecentLocalOp(path)) {
      return;
    }

    metadataCache.delete(path);
    contentCache.invalidate(path);
    fsWatch._dispatch("deleted", path);
  }

  wsClient.subscribe("created", handleCreated);
  wsClient.subscribe("folder-created", handleFolderCreated);
  wsClient.subscribe("modified", handleModified);
  wsClient.subscribe("deleted", handleDeleted);

  function connect(vaultId) {
    wsClient.connect(vaultId);
  }

  function disconnect() {
    wsClient.disconnect();
  }

  return {
    connect,
    disconnect,
  };
}
