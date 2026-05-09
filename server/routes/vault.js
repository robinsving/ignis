const express = require("express");
const fs = require("fs");
const config = require("../config");
const path = require("path");
const {
  isBridgePluginInstalled,
  getIgnisMeta,
  setIgnisMeta,
  installBridgePlugin,
} = require("../bridge-plugin");
const bootstrapRoutes = require("./bootstrap");

const router = express.Router();

// GET /api/vault/list - returns all discovered vaults (re-scans on each call)
router.get("/list", (req, res) => {
  config.refreshVaults();

  const list = Object.entries(config.vaults).map(([id, vaultPath]) => ({
    id,
    name: id,
    path: vaultPath,
  }));

  res.json(list);
});

// GET /api/vault/info?vault=<id> - returns info for a specific vault
router.get("/info", async (req, res) => {
  const vaultId = req.query.vault || config.defaultVaultId;
  const vaultPath = config.getVaultPath(vaultId);

  if (!vaultPath) {
    return res.status(404).json({ error: "Vault not found", id: vaultId });
  }

  const pluginInstalled = await isBridgePluginInstalled(vaultPath);
  const ignisMeta = await getIgnisMeta(vaultPath);

  res.json({
    id: vaultId,
    name: vaultId,
    path: vaultPath,
    platform: process.platform,
    version: config.obsidianVersion,
    ignisPlugin: {
      installed: pluginInstalled,
      prompted: ignisMeta.pluginPrompted || false,
    },
  });
});

// POST /api/vault/create { name } - create a new vault in VAULT_ROOT
router.post("/create", async (req, res) => {
  const name = req.body?.name;

  if (!name || /[\/\\:*?"<>|]/.test(name)) {
    return res.status(400).json({ error: "Invalid vault name" });
  }

  const vaultPath = path.join(config.vaultRoot, name);

  try {
    await fs.promises.mkdir(vaultPath, { recursive: false });
    await fs.promises.mkdir(path.join(vaultPath, ".obsidian"), {
      recursive: false,
    });

    await installBridgePlugin(vaultPath);

    config.refreshVaults();
    bootstrapRoutes.invalidateVault(name);

    res.json({ ok: true, id: name, path: vaultPath });
  } catch (e) {
    if (e.code === "EEXIST") {
      return res.status(409).json({ error: "Vault already exists" });
    }

    res.status(500).json({ error: e.message, code: e.code });
  }
});

// POST /api/vault/rename { vault, name } - rename a vault
router.post("/rename", async (req, res) => {
  const vaultId = req.body?.vault;
  const newName = req.body?.name;

  if (!newName || /[\/\\:*?"<>|]/.test(newName)) {
    return res.status(400).json({ error: "Invalid vault name" });
  }

  const vaultPath = config.getVaultPath(vaultId);

  if (!vaultPath) {
    return res.status(404).json({ error: "Vault not found" });
  }

  const newPath = path.join(config.vaultRoot, newName);

  try {
    await fs.promises.rename(vaultPath, newPath);

    config.refreshVaults();
    bootstrapRoutes.invalidateVault(vaultId);
    bootstrapRoutes.invalidateVault(newName);

    res.json({ ok: true, id: newName, path: newPath });
  } catch (e) {
    if (e.code === "ENOTEMPTY" || e.code === "EEXIST") {
      return res
        .status(409)
        .json({ error: "A vault with that name already exists" });
    }

    res.status(500).json({ error: e.message, code: e.code });
  }
});

// DELETE /api/vault/remove?vault=<id> - remove a vault from disk
router.delete("/remove", async (req, res) => {
  const vaultId = req.query.vault;
  const vaultPath = config.getVaultPath(vaultId);

  if (!vaultPath) {
    return res.status(404).json({ error: "Vault not found" });
  }

  try {
    await fs.promises.rm(vaultPath, { recursive: true });

    config.refreshVaults();
    bootstrapRoutes.invalidateVault(vaultId);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

// POST /api/vault/install-plugin { vault, dismiss } - install plugin or mark as prompted
router.post("/install-plugin", async (req, res) => {
  const vaultId = req.body?.vault;
  const dismiss = req.body?.dismiss || false;

  if (!vaultId) {
    return res.status(400).json({ error: "Missing vault ID" });
  }

  const vaultPath = config.getVaultPath(vaultId);

  if (!vaultPath) {
    return res.status(404).json({ error: "Vault not found" });
  }

  try {
    const meta = await getIgnisMeta(vaultPath);

    if (dismiss) {
      // User clicked "Don't Ask Again" or "Not Now"
      meta.pluginPrompted = true;
      await setIgnisMeta(vaultPath, meta);

      return res.json({ ok: true, prompted: true });
    } else {
      // User wants to install the plugin
      const installed = await installBridgePlugin(vaultPath);

      meta.pluginPrompted = true;
      await setIgnisMeta(vaultPath, meta);

      return res.json({ ok: true, installed, prompted: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

module.exports = router;
