const fs = require("fs");
const path = require("path");

// .ignis metadata helpers
async function getIgnisMeta(vaultPath) {
  const ignisDir = path.join(vaultPath, ".ignis");
  const metaFile = path.join(ignisDir, "meta.json");

  try {
    const content = await fs.promises.readFile(metaFile, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return {};
  }
}

async function setIgnisMeta(vaultPath, data) {
  const ignisDir = path.join(vaultPath, ".ignis");
  const metaFile = path.join(ignisDir, "meta.json");

  await fs.promises.mkdir(ignisDir, { recursive: true });
  await fs.promises.writeFile(metaFile, JSON.stringify(data, null, 2));
}

async function checkPluginInstalled(vaultPath) {
  const pluginDir = path.join(
    vaultPath,
    ".obsidian",
    "plugins",
    "ignis-bridge",
  );
  const manifestPath = path.join(pluginDir, "manifest.json");
  const mainPath = path.join(pluginDir, "main.js");

  try {
    await fs.promises.access(manifestPath);
    await fs.promises.access(mainPath);
    return true;
  } catch (e) {
    return false;
  }
}

async function installPluginInVault(vaultPath) {
  const obsidianDir = path.join(vaultPath, ".obsidian");
  const pluginDir = path.join(obsidianDir, "plugins", "ignis-bridge");

  if (!(await fs.promises.stat(obsidianDir).catch(() => null))) {
    return false;
  }

  if (!(await fs.promises.stat(pluginDir).catch(() => null))) {
    await fs.promises.mkdir(pluginDir, { recursive: true });

    const pluginSrcDir = path.join(__dirname, "..", "plugin");
    await fs.promises.copyFile(
      path.join(pluginSrcDir, "manifest.json"),
      path.join(pluginDir, "manifest.json"),
    );
    await fs.promises.copyFile(
      path.join(pluginSrcDir, "main.js"),
      path.join(pluginDir, "main.js"),
    );
  }

  const pluginsConfig = path.join(obsidianDir, "community-plugins.json");
  let plugins = [];

  if (await fs.promises.stat(pluginsConfig).catch(() => null)) {
    try {
      plugins = JSON.parse(await fs.promises.readFile(pluginsConfig, "utf8"));
    } catch (e) {
      plugins = [];
    }
  }

  if (!plugins.includes("ignis-bridge")) {
    plugins.push("ignis-bridge");
    await fs.promises.writeFile(pluginsConfig, JSON.stringify(plugins));
    return true;
  }

  return false;
}

async function installPluginInAllVaults(vaultRoot) {
  if (!(await fs.promises.stat(vaultRoot).catch(() => null))) {
    return;
  }

  const entries = await fs.promises.readdir(vaultRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const vaultPath = path.join(vaultRoot, entry.name);
      const installed = await installPluginInVault(vaultPath);

      if (installed) {
        console.log(`[ignis] Installed plugin in vault: ${entry.name}`);
      }
    }
  }
}

module.exports = {
  installPluginInVault,
  installPluginInAllVaults,
  getIgnisMeta,
  setIgnisMeta,
  checkPluginInstalled,
};
