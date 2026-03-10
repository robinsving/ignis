const express = require("express");
const path = require("path");
const config = require("./config");
const { setupWebSocket } = require("./ws");

const app = express();

app.use(express.json({ limit: "50mb" }));

// --- Request logging ---
app.use((req, res, next) => {
  const start = Date.now();
  const origEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color =
      status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
    const reset = "\x1b[0m";
    const path =
      req.originalUrl.length > 80
        ? req.originalUrl.slice(0, 80) + "..."
        : req.originalUrl;
    console.log(
      `${color}${req.method} ${status}${reset} ${path} (${duration}ms)`,
    );
    origEnd.apply(this, args);
  };
  next();
});

// --- Routes ---
const fsRoutes = require("./routes/fs");
const vaultRoutes = require("./routes/vault");

app.use("/api/fs", fsRoutes);
app.use("/api/vault", vaultRoutes);

// Serve vault files for resource URLs (images, attachments, etc.)
app.use("/vault-files", express.static(config.vaultPath));

// --- Static serving ---
// dist/ has shim-loader.js + patched index.html (dev mode).
// In Docker, these live inside the obsidian assets dir instead.
app.use(express.static(path.join(__dirname, "..", "dist")));

// Serve obsidian assets (app.js, app.css, libs, fonts, etc.)
app.use(express.static(config.obsidianAssetsPath));

// --- Start ---
const server = app.listen(config.port, () => {
  console.log(
    `[obsidian-bridge] Server running on http://localhost:${config.port}`,
  );
  console.log(`[obsidian-bridge] Vault path: ${config.vaultPath}`);
});

setupWebSocket(server);
