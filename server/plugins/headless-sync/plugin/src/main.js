const { Plugin } = require("obsidian");
const { HeadlessSyncSettingTab } = require("./settings-tab");
const { WsListener } = require("./ws-listener");
const api = require("./api");

class IgnisHeadlessSyncPlugin extends Plugin {
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
      },
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
      },
    });

    this.addCommand({
      id: "show-status",
      name: "Show sync status",
      callback: () => {
        this.app.setting.open();
        this.app.setting.openTabById("ignis-headless-sync");
      },
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
}

module.exports = IgnisHeadlessSyncPlugin;
