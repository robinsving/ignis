const fs = require("fs");
const path = require("path");
const {
  installObsidianPlugin,
  isObsidianPluginInstalled,
} = require("./plugin-system/obsidian-plugin");

const BRIDGE_PLUGIN_ID = "ignis-bridge";
const BRIDGE_PLUGIN_DIR = path.join(__dirname, "..", "plugin");

// .ignis metadata helpers

async function getIgnisMeta(vaultPath) {
  const metaFile = path.join(vaultPath, ".ignis", "meta.json");

  try {
    const content = await fs.promises.readFile(metaFile, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function setIgnisMeta(vaultPath, data) {
  const ignisDir = path.join(vaultPath, ".ignis");
  const metaFile = path.join(ignisDir, "meta.json");

  await fs.promises.mkdir(ignisDir, { recursive: true });
  await fs.promises.writeFile(metaFile, JSON.stringify(data, null, 2));
}

// Bridge plugin install/check

async function isBridgePluginInstalled(vaultPath) {
  return isObsidianPluginInstalled(BRIDGE_PLUGIN_ID, vaultPath);
}

async function installBridgePlugin(vaultPath) {
  const result = await installObsidianPlugin(BRIDGE_PLUGIN_DIR, vaultPath);
  return result.installed;
}

async function updateBridgePluginInAllVaults(vaultRoot) {
  if (!(await fs.promises.stat(vaultRoot).catch(() => null))) {
    return;
  }

  const entries = await fs.promises.readdir(vaultRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const vaultPath = path.join(vaultRoot, entry.name);
    const installed = await installBridgePlugin(vaultPath);

    if (installed) {
      console.log(`[ignis] Installed bridge plugin in vault: ${entry.name}`);
    }
  }
}

module.exports = {
  installBridgePlugin,
  updateBridgePluginInAllVaults,
  isBridgePluginInstalled,
  getIgnisMeta,
  setIgnisMeta,
};
