import { showVaultManager } from "../ui/vault-manager.js";

const listeners = new Map();

const syncHandlers = {
  vault: () => window.__vaultConfig || { id: "default-vault", path: "/" },
  version: () => "1.8.9",
  "is-dev": () => false,
  "file-url": () =>
    "/vault-files/" + encodeURIComponent(window.__currentVaultId || "") + "/",
  "disable-update": () => true,
  update: () => "",
  "disable-gpu": () => false,
  frame: () => null,
  "set-icon": () => null,
  "get-icon": () => null,
  relaunch: () => {
    window.location.reload();
    return null;
  },
  starter: () => {
    showVaultManager();
    return null;
  },
  help: () => {
    window.open("https://help.obsidian.md/", "_blank");
    return null;
  },
  sandbox: () => null,
  "copy-asar": () => false,
  "check-update": () => null,
  "vault-list": () => {
    const result = {};
    for (const v of window.__vaultList || []) {
      result[v.id] = {
        path: "/" + v.id,
        ts: Date.now(),
        open: v.id === (window.__currentVaultId || ""),
      };
    }
    return result;
  },
  "vault-open": (vaultPath, newWindow) => {
    const id = (vaultPath || "").replace(/^\/+/, "");
    const vault = (window.__vaultList || []).find((v) => v.id === id);
    if (!vault && id) {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/vault/create", false);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({ name: id }));
      if (xhr.status >= 400) return "Failed to create vault";
    }
    const target = window.parent !== window ? window.parent : window;
    target.location.href = "/?vault=" + encodeURIComponent(id);
    return true;
  },
  "vault-remove": (vaultPath) => {
    const id = (vaultPath || "").replace(/^\/+/, "");
    const xhr = new XMLHttpRequest();
    xhr.open(
      "DELETE",
      "/api/vault/remove?vault=" + encodeURIComponent(id),
      false,
    );
    xhr.send();
    return xhr.status < 400;
  },
  "vault-move": (oldPath, newPath) => {
    return "Moving vaults is not supported in the web version";
  },
  "vault-message": () => null,
  "get-default-vault-path": () => "/My Vault",
  "get-documents-path": () => "/",
  "desktop-dir": () => "/desktop",
  "documents-dir": () => "/documents",
  resources: () => "",
};

export const ipcRenderer = {
  send(channel, ...args) {
    console.log("[shim:ipcRenderer] send:", channel, args);

    if (channel === "context-menu") {
      queueMicrotask(() =>
        ipcRenderer._emit("context-menu", {
          webContentsId: 1,
          editFlags: { canCut: true, canCopy: true, canPaste: true },
        }),
      );
      return;
    }
  },

  sendSync(channel, ...args) {
    console.log("[shim:ipcRenderer] sendSync:", channel, args);
    if (syncHandlers[channel]) {
      return syncHandlers[channel](...args);
    }
    console.warn("[shim:ipcRenderer] Unhandled sendSync channel:", channel);
    return null;
  },

  on(channel, listener) {
    if (!listeners.has(channel)) {
      listeners.set(channel, []);
    }
    listeners.get(channel).push(listener);
    return ipcRenderer;
  },

  once(channel, listener) {
    const wrapped = (...args) => {
      ipcRenderer.removeListener(channel, wrapped);
      listener(...args);
    };
    return ipcRenderer.on(channel, wrapped);
  },

  removeListener(channel, listener) {
    const arr = listeners.get(channel);
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx >= 0) arr.splice(idx, 1);
    }
    return ipcRenderer;
  },

  removeAllListeners(channel) {
    if (channel) {
      listeners.delete(channel);
    } else {
      listeners.clear();
    }
    return ipcRenderer;
  },

  _emit(channel, ...args) {
    const arr = listeners.get(channel);
    if (arr) {
      for (const fn of arr) {
        fn({}, ...args);
      }
    }
  },
};
