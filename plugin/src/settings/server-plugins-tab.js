const { Setting, Notice } = require("obsidian");

function getVaultId() {
  return window.__currentVaultId || "";
}

async function fetchPlugins() {
  const res = await fetch("/api/plugins");

  if (!res.ok) {
    throw new Error("Failed to fetch plugins");
  }

  return res.json();
}

async function togglePlugin(pluginId, enable, app) {
  const action = enable ? "enable" : "disable";
  const vaultId = getVaultId();

  const res = await fetch(`/api/plugins/${pluginId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault: vaultId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to ${action} plugin`);
  }

  return res.json();
}

async function activateBundledPlugin(bundledPluginId, enable, app) {
  if (!bundledPluginId) {
    return;
  }

  const plugins = app.plugins;

  if (enable) {
    await plugins.loadManifests();
    await plugins.enablePluginAndSave(bundledPluginId);
  } else {
    await plugins.disablePluginAndSave(bundledPluginId);
  }
}

function display(containerEl, app) {
  containerEl.createEl("h2", { text: "Ignis Core Plugins" });

  const descEl = containerEl.createEl("p", {
    text:
      "Ignis plugins extend server functionality and run alongside your vaults. " +
      "They are separate from Obsidian's built-in plugins.",
    cls: "ignis-plugins-description",
  });

  const loadingEl = containerEl.createEl("p", { text: "Loading plugins..." });

  fetchPlugins()
    .then((plugins) => {
      loadingEl.remove();

      if (plugins.length === 0) {
        containerEl.createEl("p", {
          text: "No server plugins available.",
          cls: "setting-item-description",
        });
        return;
      }

      const vaultId = getVaultId();

      for (const plugin of plugins) {
        const enabled = plugin.enabledVaults.includes(vaultId);

        new Setting(containerEl)
          .setName(plugin.name)
          .setDesc(plugin.description || "")
          .addToggle((toggle) => {
            toggle.setValue(enabled);
            toggle.onChange(async (value) => {
              try {
                await togglePlugin(plugin.id, value, app);
                await activateBundledPlugin(
                  plugin.bundledPluginId,
                  value,
                  app,
                );

                new Notice(
                  `${plugin.name} ${value ? "enabled" : "disabled"} for this vault.`,
                );
              } catch (e) {
                new Notice(`Failed: ${e.message}`);
                toggle.setValue(!value);
              }
            });
          });
      }
    })
    .catch((e) => {
      loadingEl.setText("Failed to load plugins.");
      console.error("[ignis-bridge] Server plugins error:", e);
    });
}

module.exports = { display };
