const { Plugin, TFile, TFolder } = require("obsidian");
const { showFilePicker, addFileMenuItems, addFolderMenuItems } = require("./file-actions");
const { patchSettingsModal, unpatchSettingsModal } = require("./settings/inject");
const pluginRegistry = require("./plugin-registry");
const { initStatusBar } = require("./status-bar");

window.__obsidianAPI = require("obsidian");

class IgnisBridgePlugin extends Plugin {
  async onload() {
    console.log("[ignis-bridge] Plugin loaded");

    await pluginRegistry.refresh();
    patchSettingsModal(this);
    this._statusBarInterval = initStatusBar(this);

    this.addRibbonIcon("upload", "Upload file", () => {
      showFilePicker(this.app);
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile) {
          addFileMenuItems(menu, file);
        } else if (file instanceof TFolder) {
          addFolderMenuItems(menu, file, this.app);
        }
      }),
    );
  }

  onunload() {
    if (this._statusBarInterval) {
      clearInterval(this._statusBarInterval);
    }

    unpatchSettingsModal(this);
    console.log("[ignis-bridge] Plugin unloaded");
  }
}

module.exports = IgnisBridgePlugin;
