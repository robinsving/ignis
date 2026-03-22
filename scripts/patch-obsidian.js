#!/usr/bin/env node
// Patches the extracted Obsidian asar for browser use:
//   1. Removes Content-Security-Policy meta tag
//   2. Injects shim-loader.js script (non-deferred, before all other scripts)
//   3. Injects favicon link

const fs = require("fs");
const path = require("path");
const { getVersion } = require("../server/version");

const asarDir = process.argv[2];
if (!asarDir) {
  console.error("Usage: node patch-obsidian.js <extracted-asar-dir>");
  process.exit(1);
}

function patchHtml(filePath, version) {
  const backupPath = filePath + ".orig";

  if (!fs.existsSync(filePath) && !fs.existsSync(backupPath)) {
    console.warn(`[patch] Skipping (not found): ${filePath}`);
    return;
  }

  // Create backup of the original on first patch; restore from it on subsequent runs
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`[patch] Backed up original: ${backupPath}`);
  } else {
    fs.copyFileSync(backupPath, filePath);
  }

  let html = fs.readFileSync(filePath, "utf-8");

  // Remove CSP meta tag
  html = html.replace(
    /\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>\s*/g,
    "\n",
  );

  // Inject favicon into <head>
  html = html.replace(
    "</head>",
    '  <link rel="icon" type="image/png" href="favicon.png">\n</head>',
  );

  // Inject ignis scripts before the first <script> tag
  html = html.replace(
    '<script type="text/javascript"',
    `<script type="text/javascript" src="ignis-ui.js?v=${version}"></script>\n` +
      `<script type="text/javascript" src="shim-loader.js?v=${version}"></script>\n` +
      '<script type="text/javascript"',
  );

  fs.writeFileSync(filePath, html);
  console.log(`[patch] Patched ${filePath}`);
}

const version = getVersion();
patchHtml(path.join(asarDir, "index.html"), version);
console.log(`[patch] Injected version: ${version}`);
