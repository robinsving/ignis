const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function getVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
  );
  const semver = pkg.version;

  let hash;
  try {
    hash = execSync("git rev-parse --short=7 HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch (e) {
    hash = Date.now().toString(36).slice(-7);
  }

  return `${semver}-${hash}`;
}

module.exports = { getVersion };
