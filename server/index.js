const express = require("express");
const path = require("path");
const compression = require("compression");
const config = require("./config");
const { setupWebSocket } = require("./ws");
const watcher = require("./watcher");
const { updateBridgePluginInAllVaults } = require("./bridge-plugin");

const ANSI_RED = "\x1b[31m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_RESET = "\x1b[0m";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(compression());

// logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  const origEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const color =
      status >= 500 ? ANSI_RED : status >= 400 ? ANSI_YELLOW : ANSI_GREEN;

    const path =
      req.originalUrl.length > 80
        ? req.originalUrl.slice(0, 80) + "..."
        : req.originalUrl;

    console.log(
      `${color}${req.method} ${status}${ANSI_RESET} ${path} (${duration}ms)`,
    );

    origEnd.apply(this, args);
  };

  next();
});

const fsRoutes = require("./routes/fs");
const vaultRoutes = require("./routes/vault");
const proxyRoutes = require("./routes/proxy");
const versionRoutes = require("./routes/version");

app.use("/api/fs", fsRoutes);
app.use("/api/vault", vaultRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/version", versionRoutes);

// Serve vault files for resource URLs (images, attachments, etc.)
// Vault ID is the first path segment: /vault-files/<vault-id>/path/to/file
app.use("/vault-files", (req, res, next) => {
  // Extract vault ID from the first path segment
  const parts = req.path.split("/").filter(Boolean);

  if (parts.length === 0) {
    return res.status(400).json({ error: "Missing vault ID" });
  }

  const vaultId = decodeURIComponent(parts[0]);
  const vaultPath = config.getVaultPath(vaultId);

  if (!vaultPath) {
    return res.status(404).json({ error: "Vault not found" });
  }

  // Rewrite req.url to strip the vault ID prefix, then serve statically
  req.url = "/" + parts.slice(1).join("/");
  express.static(vaultPath)(req, res, next);
});

// Serve dist files with cache headers based on version param
app.use((req, res, next) => {
  if (req.path.match(/\/(ignis-ui|shim-loader)\.js$/)) {
    if (req.query.v) {
      // Versioned assets - cache for 1 year
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      // No version param - short cache for dev/fallback
      res.setHeader("Cache-Control", "public, max-age=300");
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, "..", "dist")));

app.use(express.static(config.obsidianAssetsPath));

const server = app.listen(config.port, async () => {
  console.log(`[ignis] Server running on http://localhost:${config.port}`);
  console.log(`[ignis] Vault root: ${config.vaultRoot}`);
  console.log(`[ignis] Vaults: ${Object.keys(config.vaults).join(", ")}`);

  await updateBridgePluginInAllVaults(config.vaultRoot);
});

const wss = setupWebSocket(server);

async function gracefulShutdown(signal) {
  console.log(`\n[ignis] Received ${signal}, shutting down gracefully...`);

  await shutdownPlugins();

  server.close(() => {
    console.log("[ignis] Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[ignis] Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
