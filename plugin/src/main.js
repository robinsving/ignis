const { Plugin, TFile, TFolder } = require("obsidian");
const {
  showFilePicker,
  addFileMenuItems,
  addFolderMenuItems,
} = require("./file-actions");
const {
  patchSettingsModal,
  unpatchSettingsModal,
} = require("./settings/inject");
const pluginRegistry = require("./plugin-registry");
const { initStatusBar } = require("./status-bar");
const { WorkspacePickerModal } = require("./workspace-picker");
const { startDemoGuards, stopDemoGuards } = require("./demo-guards");

window.__obsidianAPI = require("obsidian");

class IgnisBridgePlugin extends Plugin {
  async onload() {
    if (!window.__ignis) {
      console.log("[ignis-bridge] Not running in Ignis - plugin is a no-op.");
      return;
    }

    console.log("[ignis-bridge] Plugin loaded");

    await pluginRegistry.refresh();
    patchSettingsModal(this);
    startDemoGuards();
    this._statusBarInterval = initStatusBar(this);

    this.addRibbonIcon("upload", "Upload file", () => {
      showFilePicker(this.app);
    });

    this.addCommand({
      id: "open-workspace-in-new-tab",
      name: "Open workspace in new tab",
      callback: () => {
        new WorkspacePickerModal(this.app).open();
      },
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
    if (!window.__ignis) {
      return;
    }

    if (this._statusBarInterval) {
      clearInterval(this._statusBarInterval);
    }

    unpatchSettingsModal(this);
    stopDemoGuards();
    console.log("[ignis-bridge] Plugin unloaded");
  }
}

module.exports = IgnisBridgePlugin;
