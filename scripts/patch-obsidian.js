#!/usr/bin/env node
// Patches the extracted Obsidian asar for browser use:
//   1. Removes Content-Security-Policy meta tag
//   2. Injects shim-loader.js script (non-deferred, before all other scripts)

const fs = require("fs");
const path = require("path");

const asarDir = process.argv[2];
if (!asarDir) {
  console.error("Usage: node patch-obsidian.js <extracted-asar-dir>");
  process.exit(1);
}

const indexPath = path.join(asarDir, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error(`Not found: ${indexPath}`);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf-8");

// Remove CSP meta tag
html = html.replace(
  /\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>\s*/g,
  "\n",
);

// Inject shim-loader before the first <script> tag
html = html.replace(
  '<script type="text/javascript"',
  '<!-- Shim loader MUST load before everything else (no defer) -->\n' +
    '<script type="text/javascript" src="shim-loader.js"></script>\n' +
    '<script type="text/javascript"',
);

fs.writeFileSync(indexPath, html);
console.log(`[patch] Patched ${indexPath}`);
