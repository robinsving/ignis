const { PluginSettingTab, Setting, Notice } = require("obsidian");
const api = require("./api");
const auth = require("./auth");

class HeadlessSyncSettingTab extends PluginSettingTab {
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
      serverStatus = await api.getStatus();
    } catch (e) {
      containerEl.createEl("p", {
        text: "Failed to connect to Headless Sync server plugin.",
        cls: "mod-warning",
      });
      return;
    }

    if (!serverStatus.installed) {
      containerEl.createEl("p", {
        text: "obsidian-headless (ob CLI) is not installed on the server. Install it to enable sync.",
        cls: "mod-warning",
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
      // State C: connected to server
      new Setting(containerEl)
        .setName("Obsidian Sync account")
        .setDesc(
          `Signed in as ${serverStatus.name || "unknown"} (${serverStatus.email || "unknown"})`,
        )
        .addButton((btn) => {
          btn
            .setButtonText("Disconnect")
            .setWarning()
            .onClick(async () => {
              try {
                await api.logout();
                new Notice("Disconnected from Headless Sync");
                this.display();
              } catch (e) {
                new Notice(`Failed to disconnect: ${e.message}`);
              }
            });
        });
    } else if (localToken) {
      // State B: signed into Obsidian, not connected to server
      new Setting(containerEl)
        .setName("Obsidian Sync account detected")
        .setDesc(`${localToken.name} (${localToken.email})`)
        .addButton((btn) => {
          btn
            .setButtonText("Use this account for Headless Sync")
            .setCta()
            .onClick(async () => {
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
      // State A: not signed into Obsidian
      new Setting(containerEl)
        .setName("Obsidian Sync account")
        .setDesc("Sign in to your Obsidian account to enable sync.")
        .addButton((btn) => {
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
    const vaultId = this.app.vault.getName();

    let vaultsData;

    try {
      vaultsData = await api.getVaults();
    } catch (e) {
      containerEl.createEl("p", {
        text: `Failed to load sync state: ${e.message}`,
        cls: "mod-warning",
      });
      return;
    }

    const vaultState = vaultsData.vaults.find((v) => v.vaultId === vaultId);

    containerEl.createEl("h3", { text: "Vault sync" });

    if (!vaultState) {
      new Setting(containerEl)
        .setName("Sync not configured")
        .setDesc("This vault has not been linked to a remote vault yet.")
        .addButton((btn) => {
          btn
            .setButtonText("Set up sync")
            .setCta()
            .onClick(() => {
              new Notice("Vault picker coming soon.");
            });
        });

      return;
    }

    // Show current sync config
    new Setting(containerEl)
      .setName("Remote vault")
      .setDesc(vaultState.remoteVault || "unknown");

    new Setting(containerEl)
      .setName("Sync mode")
      .setDesc(vaultState.config?.mode || "bidirectional");

    // Sync controls
    const statusText =
      vaultState.status === "running"
        ? "Sync is running"
        : vaultState.status === "error"
          ? `Error: ${vaultState.error}`
          : "Sync is stopped";

    new Setting(containerEl)
      .setName("Status")
      .setDesc(statusText)
      .addButton((btn) => {
        if (vaultState.status === "running") {
          btn.setButtonText("Stop sync").setWarning().onClick(async () => {
            try {
              await api.stopSync(vaultId);
              new Notice("Sync stopped");
              this.display();
            } catch (e) {
              new Notice(`Failed to stop: ${e.message}`);
            }
          });
        } else {
          btn.setButtonText("Start sync").setCta().onClick(async () => {
            try {
              await api.startSync(vaultId);
              new Notice("Sync started");
              this.display();
            } catch (e) {
              new Notice(`Failed to start: ${e.message}`);
            }
          });
        }
      });

    // Log viewer
    await this.renderLogs(containerEl, vaultId);
  }

  async renderLogs(containerEl, vaultId) {
    containerEl.createEl("h3", { text: "Recent logs" });

    let logsData;

    try {
      logsData = await api.getLogs(vaultId, 50);
    } catch (e) {
      containerEl.createEl("p", {
        text: `Failed to load logs: ${e.message}`,
        cls: "mod-warning",
      });
      return;
    }

    const logContainer = containerEl.createDiv("ignis-log-viewer");

    if (logsData.logs.length === 0) {
      logContainer.createEl("p", {
        text: "No log entries yet.",
        cls: "setting-item-description",
      });
    } else {
      for (const entry of logsData.logs) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        logContainer.createEl("div", {
          text: `[${time}] ${entry.line}`,
          cls: "ignis-log-entry",
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
}

module.exports = { HeadlessSyncSettingTab };
