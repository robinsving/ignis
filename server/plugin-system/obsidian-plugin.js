const fs = require("fs");
const path = require("path");

async function readManifestId(sourceDir) {
  const manifestPath = path.join(sourceDir, "manifest.json");
  const content = await fs.promises.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(content);

  if (!manifest.id) {
    throw new Error(`No "id" in manifest.json at ${sourceDir}`);
  }

  return manifest.id;
}

async function installObsidianPlugin(sourceDir, vaultPath) {
  const pluginId = await readManifestId(sourceDir);

  const obsidianDir = path.join(vaultPath, ".obsidian");

  try {
    await fs.promises.access(obsidianDir);
  } catch {
    return { installed: false, pluginId };
  }

  const targetDir = path.join(obsidianDir, "plugins", pluginId);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const files = await fs.promises.readdir(sourceDir);

  for (const file of files) {
    const srcPath = path.join(sourceDir, file);
    const stat = await fs.promises.stat(srcPath);

    if (stat.isFile()) {
      await fs.promises.copyFile(srcPath, path.join(targetDir, file));
    }
  }

  const pluginsConfigFile = path.join(obsidianDir, "community-plugins.json");
  let plugins = [];

  try {
    const content = await fs.promises.readFile(pluginsConfigFile, "utf-8");
    plugins = JSON.parse(content);
  } catch {
    plugins = [];
  }

  if (!plugins.includes(pluginId)) {
    plugins.push(pluginId);
    await fs.promises.writeFile(pluginsConfigFile, JSON.stringify(plugins));
  }

  return { installed: true, pluginId };
}

async function removeObsidianPlugin(sourceDir, vaultPath) {
  const pluginId = await readManifestId(sourceDir);

  const obsidianDir = path.join(vaultPath, ".obsidian");

  try {
    await fs.promises.access(obsidianDir);
  } catch {
    return { removed: false, pluginId };
  }

  const targetDir = path.join(obsidianDir, "plugins", pluginId);

  try {
    await fs.promises.rm(targetDir, { recursive: true });
  } catch {
    // Already gone
  }

  const pluginsConfigFile = path.join(obsidianDir, "community-plugins.json");

  try {
    const content = await fs.promises.readFile(pluginsConfigFile, "utf-8");
    let plugins = JSON.parse(content);
    plugins = plugins.filter((id) => id !== pluginId);
    await fs.promises.writeFile(pluginsConfigFile, JSON.stringify(plugins));
  } catch {
    // No config file or parse error  -  nothing to remove from
  }

  return { removed: true, pluginId };
}

async function isObsidianPluginInstalled(pluginId, vaultPath) {
  const pluginDir = path.join(vaultPath, ".obsidian", "plugins", pluginId);
  const manifestPath = path.join(pluginDir, "manifest.json");
  const mainPath = path.join(pluginDir, "main.js");

  try {
    await fs.promises.access(manifestPath);
    await fs.promises.access(mainPath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  installObsidianPlugin,
  removeObsidianPlugin,
  isObsidianPluginInstalled,
};
