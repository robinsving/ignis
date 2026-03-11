export function createFsWatch(transport) {
  const watchers = new Map(); // path -> Set<listener>

  return {
    watch(path, options, listener) {
      if (typeof options === "function") {
        listener = options;
        options = {};
      }

      if (!watchers.has(path)) {
        watchers.set(path, new Set());
      }
      watchers.get(path).add(listener);

      // TODO: send watch subscription to server via transport

      // Return a watcher-like object
      return {
        close() {
          const set = watchers.get(path);
          if (set) {
            set.delete(listener);
            if (set.size === 0) {
              watchers.delete(path);
              // TODO: send unwatch to server
            }
          }
        },
        on() {
          return this;
        },
        once() {
          return this;
        },
        removeListener() {
          return this;
        },
      };
    },

    // Internal: called when transport receives a file-change event
    _dispatch(eventType, filePath) {
      for (const [watchPath, listeners] of watchers) {
        if (filePath === watchPath || filePath.startsWith(watchPath + "/")) {
          const relativeName = filePath.slice(watchPath.length + 1) || filePath;
          for (const fn of listeners) {
            try {
              fn(eventType, relativeName);
            } catch (e) {
              console.error("[shim:fs:watch] Listener error:", e);
            }
          }
        }
      }
    },
  };
}
