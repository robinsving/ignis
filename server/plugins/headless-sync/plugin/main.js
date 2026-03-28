var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// server/plugins/headless-sync/plugin/src/api.js
var require_api = __commonJS({
  "server/plugins/headless-sync/plugin/src/api.js"(exports2, module2) {
    var BASE = "/api/ext/headless-sync";
    async function fetchJson(path, opts = {}) {
      const res = await fetch(`${BASE}${path}`, opts);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      return res.json();
    }
    function post(path, body) {
      return fetchJson(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }
    function getStatus() {
      return fetchJson("/status");
    }
    function login(token, email, name) {
      return post("/login", { token, email, name });
    }
    function logout() {
      return post("/logout", {});
    }
    function getRemoteVaults() {
      return fetchJson("/remote-vaults");
    }
    function setupSync(vaultId, remoteVault, opts = {}) {
      return post("/setup", { vaultId, remoteVault, ...opts });
    }
    function startSync(vaultId) {
      return post("/start", { vaultId });
    }
    function stopSync(vaultId) {
      return post("/stop", { vaultId });
    }
    function getVaults() {
      return fetchJson("/vaults");
    }
    function getLogs(vaultId, limit = 100) {
      return fetchJson(`/logs?vaultId=${encodeURIComponent(vaultId)}&limit=${limit}`);
    }
    module2.exports = {
      getStatus,
      login,
      logout,
      getRemoteVaults,
      setupSync,
      startSync,
      stopSync,
      getVaults,
      getLogs
    };
  }
});

// server/plugins/headless-sync/plugin/src/auth.js
var require_auth = __commonJS({
  "server/plugins/headless-sync/plugin/src/auth.js"(exports2, module2) {
    var api2 = require_api();
    function getObsidianSyncToken() {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          const val = JSON.parse(localStorage.getItem(key));
          if ((val == null ? void 0 : val.token) && (val == null ? void 0 : val.email) && (val == null ? void 0 : val.name)) {
            return val;
          }
        } catch {
        }
      }
      return null;
    }
    function triggerLogin(app) {
      const aboutTab = app.setting.settingTabs.find((t) => t.id === "about");
      if (!aboutTab || !aboutTab.accountSetting) {
        return false;
      }
      const loginBtn = aboutTab.accountSetting.controlEl.querySelector("button");
      if (!loginBtn) {
        return false;
      }
      loginBtn.click();
      return true;
    }
    async function sendTokenToServer(tokenData) {
      return api2.login(tokenData.token, tokenData.email, tokenData.name);
    }
    function waitForLogin(callback, timeoutMs = 6e4) {
      const interval = 2e3;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += interval;
        const token = getObsidianSyncToken();
        if (token) {
          clearInterval(timer);
          callback(token);
          return;
        }
        if (elapsed >= timeoutMs) {
          clearInterval(timer);
          callback(null);
        }
      }, interval);
      return () => clearInterval(timer);
    }
    module2.exports = {
      getObsidianSyncToken,
      triggerLogin,
      sendTokenToServer,
      waitForLogin
    };
  }
});

// server/plugins/headless-sync/plugin/src/settings-tab.js
var require_settings_tab = __commonJS({
  "server/plugins/headless-sync/plugin/src/settings-tab.js"(exports2, module2) {
    var { PluginSettingTab, Setting, Notice } = require("obsidian");
    var api2 = require_api();
    var auth = require_auth();
    var HeadlessSyncSettingTab2 = class extends PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this._cancelWait = null;
      }
      async display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Headless Sync" });
        let serverStatus;
        try {
          serverStatus = await api2.getStatus();
        } catch (e) {
          containerEl.createEl("p", {
            text: "Failed to connect to Headless Sync server plugin.",
            cls: "mod-warning"
          });
          return;
        }
        if (!serverStatus.installed) {
          containerEl.createEl("p", {
            text: "obsidian-headless (ob CLI) is not installed on the server. Install it to enable sync.",
            cls: "mod-warning"
          });
          return;
        }
        this.renderAuthSection(containerEl, serverStatus);
        if (serverStatus.authenticated) {
          await this.renderSyncSection(containerEl);
        }
      }
      renderAuthSection(containerEl, serverStatus) {
        const localToken = auth.getObsidianSyncToken();
        if (serverStatus.authenticated) {
          new Setting(containerEl).setName("Obsidian Sync account").setDesc(
            `Signed in as ${serverStatus.name || "unknown"} (${serverStatus.email || "unknown"})`
          ).addButton((btn) => {
            btn.setButtonText("Disconnect").setWarning().onClick(async () => {
              try {
                await api2.logout();
                new Notice("Disconnected from Headless Sync");
                this.display();
              } catch (e) {
                new Notice(`Failed to disconnect: ${e.message}`);
              }
            });
          });
        } else if (localToken) {
          new Setting(containerEl).setName("Obsidian Sync account detected").setDesc(`${localToken.name} (${localToken.email})`).addButton((btn) => {
            btn.setButtonText("Use this account for Headless Sync").setCta().onClick(async () => {
              try {
                await auth.sendTokenToServer(localToken);
                new Notice("Connected to Headless Sync");
                this.display();
              } catch (e) {
                new Notice(`Failed to connect: ${e.message}`);
              }
            });
          });
        } else {
          new Setting(containerEl).setName("Obsidian Sync account").setDesc("Sign in to your Obsidian account to enable sync.").addButton((btn) => {
            btn.setButtonText("Log in to Obsidian Sync").onClick(() => {
              const triggered = auth.triggerLogin(this.app);
              if (!triggered) {
                new Notice("Could not open login dialog. Try logging in from Settings > General.");
                return;
              }
              this._cancelWait = auth.waitForLogin((token) => {
                this._cancelWait = null;
                if (token) {
                  new Notice(`Detected login: ${token.name}`);
                  this.display();
                }
              });
            });
          });
        }
      }
      async renderSyncSection(containerEl) {
        var _a;
        const vaultId = this.app.vault.getName();
        let vaultsData;
        try {
          vaultsData = await api2.getVaults();
        } catch (e) {
          containerEl.createEl("p", {
            text: `Failed to load sync state: ${e.message}`,
            cls: "mod-warning"
          });
          return;
        }
        const vaultState = vaultsData.vaults.find((v) => v.vaultId === vaultId);
        containerEl.createEl("h3", { text: "Vault sync" });
        if (!vaultState) {
          new Setting(containerEl).setName("Sync not configured").setDesc("This vault has not been linked to a remote vault yet.").addButton((btn) => {
            btn.setButtonText("Set up sync").setCta().onClick(() => {
              new Notice("Vault picker coming soon.");
            });
          });
          return;
        }
        new Setting(containerEl).setName("Remote vault").setDesc(vaultState.remoteVault || "unknown");
        new Setting(containerEl).setName("Sync mode").setDesc(((_a = vaultState.config) == null ? void 0 : _a.mode) || "bidirectional");
        const statusText = vaultState.status === "running" ? "Sync is running" : vaultState.status === "error" ? `Error: ${vaultState.error}` : "Sync is stopped";
        new Setting(containerEl).setName("Status").setDesc(statusText).addButton((btn) => {
          if (vaultState.status === "running") {
            btn.setButtonText("Stop sync").setWarning().onClick(async () => {
              try {
                await api2.stopSync(vaultId);
                new Notice("Sync stopped");
                this.display();
              } catch (e) {
                new Notice(`Failed to stop: ${e.message}`);
              }
            });
          } else {
            btn.setButtonText("Start sync").setCta().onClick(async () => {
              try {
                await api2.startSync(vaultId);
                new Notice("Sync started");
                this.display();
              } catch (e) {
                new Notice(`Failed to start: ${e.message}`);
              }
            });
          }
        });
        await this.renderLogs(containerEl, vaultId);
      }
      async renderLogs(containerEl, vaultId) {
        containerEl.createEl("h3", { text: "Recent logs" });
        let logsData;
        try {
          logsData = await api2.getLogs(vaultId, 50);
        } catch (e) {
          containerEl.createEl("p", {
            text: `Failed to load logs: ${e.message}`,
            cls: "mod-warning"
          });
          return;
        }
        const logContainer = containerEl.createDiv("ignis-log-viewer");
        if (logsData.logs.length === 0) {
          logContainer.createEl("p", {
            text: "No log entries yet.",
            cls: "setting-item-description"
          });
        } else {
          for (const entry of logsData.logs) {
            const time = new Date(entry.timestamp).toLocaleTimeString();
            logContainer.createEl("div", {
              text: `[${time}] ${entry.line}`,
              cls: "ignis-log-entry"
            });
          }
        }
      }
      hide() {
        if (this._cancelWait) {
          this._cancelWait();
          this._cancelWait = null;
        }
        super.hide();
      }
    };
    module2.exports = { HeadlessSyncSettingTab: HeadlessSyncSettingTab2 };
  }
});

// server/plugins/headless-sync/plugin/src/ws-listener.js
var require_ws_listener = __commonJS({
  "server/plugins/headless-sync/plugin/src/ws-listener.js"(exports2, module2) {
    var CHANNEL = "plugin:headless-sync";
    var POLL_INTERVAL = 3e3;
    var WsListener2 = class {
      constructor() {
        this._callbacks = /* @__PURE__ */ new Map();
        this._handler = null;
        this._pollTimer = null;
        this._currentWs = null;
      }
      start() {
        this._attachToWs();
        this._pollTimer = setInterval(() => {
          this._attachToWs();
        }, POLL_INTERVAL);
      }
      stop() {
        if (this._pollTimer) {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
        }
        this._detachFromWs();
      }
      on(type, callback) {
        if (!this._callbacks.has(type)) {
          this._callbacks.set(type, []);
        }
        this._callbacks.get(type).push(callback);
      }
      off(type, callback) {
        const list = this._callbacks.get(type);
        if (!list) {
          return;
        }
        const idx = list.indexOf(callback);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
      }
      _attachToWs() {
        const ws = window.__ignisWs;
        if (!ws || ws === this._currentWs) {
          return;
        }
        this._detachFromWs();
        this._currentWs = ws;
        this._handler = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.channel !== CHANNEL) {
              return;
            }
            const listeners = this._callbacks.get(msg.type);
            if (listeners) {
              for (const cb of listeners) {
                cb(msg.payload);
              }
            }
          } catch {
          }
        };
        ws.addEventListener("message", this._handler);
      }
      _detachFromWs() {
        if (this._currentWs && this._handler) {
          this._currentWs.removeEventListener("message", this._handler);
        }
        this._currentWs = null;
        this._handler = null;
      }
    };
    module2.exports = { WsListener: WsListener2 };
  }
});

// server/plugins/headless-sync/plugin/src/main.js
var { Plugin } = require("obsidian");
var { HeadlessSyncSettingTab } = require_settings_tab();
var { WsListener } = require_ws_listener();
var api = require_api();
var IgnisHeadlessSyncPlugin = class extends Plugin {
  async onload() {
    this.wsListener = new WsListener();
    this.wsListener.start();
    this.wsListener.on("sync-status", (payload) => {
      if (payload.vaultId === this.app.vault.getName()) {
        console.log("[ignis-headless-sync] Status update:", payload.status);
      }
    });
    this.addSettingTab(new HeadlessSyncSettingTab(this.app, this));
    this.addCommand({
      id: "start-sync",
      name: "Start server-side sync",
      callback: async () => {
        try {
          await api.startSync(this.app.vault.getName());
        } catch (e) {
          console.error("[ignis-headless-sync] Start failed:", e.message);
        }
      }
    });
    this.addCommand({
      id: "stop-sync",
      name: "Stop server-side sync",
      callback: async () => {
        try {
          await api.stopSync(this.app.vault.getName());
        } catch (e) {
          console.error("[ignis-headless-sync] Stop failed:", e.message);
        }
      }
    });
    this.addCommand({
      id: "show-status",
      name: "Show sync status",
      callback: () => {
        this.app.setting.open();
        this.app.setting.openTabById("ignis-headless-sync");
      }
    });
    console.log("[ignis-headless-sync] Loaded");
  }
  onunload() {
    if (this.wsListener) {
      this.wsListener.stop();
      this.wsListener = null;
    }
    console.log("[ignis-headless-sync] Unloaded");
  }
};
module.exports = IgnisHeadlessSyncPlugin;
