const path = require("path");

module.exports = {
  port: process.env.PORT || 8080,
  vaultPath: process.env.VAULT_PATH || path.join(__dirname, "..", "test-vault"),
  obsidianAssetsPath:
    process.env.OBSIDIAN_ASSETS_PATH ||
    path.join(__dirname, "..", "investigation", "obsidian.asar.unpacked"),
};
