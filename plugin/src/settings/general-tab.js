const { Setting } = require("obsidian");

const GITHUB_URL = "https://github.com/Nystik-gh/ignis";
const GITHUB_API_LATEST =
  "https://api.github.com/repos/Nystik-gh/ignis/releases/latest";

function getVersion(app) {
  try {
    const manifest = app.plugins.getPlugin("ignis-bridge")?.manifest;
    return manifest?.version || "unknown";
  } catch {
    return "unknown";
  }
}

async function checkForUpdate(currentVersion) {
  try {
    const res = await fetch(GITHUB_API_LATEST);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const latest = data.tag_name?.replace(/^v/, "");

    if (latest && latest !== currentVersion) {
      return latest;
    }

    return null;
  } catch {
    return null;
  }
}

function display(containerEl, app) {
  const version = getVersion(app);

  const header = containerEl.createDiv("ignis-header");

  const logo = header.createEl("img", {
    cls: "ignis-header-logo",
    attr: { src: "/assets/ignis.webp", alt: "Ignis" },
  });

  const info = header.createDiv("ignis-header-info");
  info.createEl("div", { text: "Ignis", cls: "ignis-header-title" });
  info.createEl("div", {
    text: "Obsidian server bridge",
    cls: "ignis-header-subtitle",
  });

  const right = header.createDiv("ignis-header-right");

  const versionCol = right.createDiv("ignis-header-version-col");
  versionCol.createEl("span", {
    text: `Version ${version}`,
    cls: "ignis-header-version",
  });

  const updateIndicator = versionCol.createEl("span", {
    text: "Checking...",
    cls: "ignis-update-indicator",
  });

  const githubLink = right.createEl("a", {
    cls: "ignis-github-link",
    href: GITHUB_URL,
    attr: { target: "_blank", "aria-label": "GitHub" },
  });

  const githubIcon = githubLink.createEl("img", {
    cls: "ignis-github-icon",
    attr: { src: "/assets/github.svg", alt: "GitHub" },
  });

  checkForUpdate(version).then((latestVersion) => {
    if (latestVersion) {
      updateIndicator.textContent = `v${latestVersion} available`;
      updateIndicator.addClass("ignis-update-available");
    } else {
      updateIndicator.textContent = "Up to date";
    }
  });

  addServerStatus(containerEl);
}

function getWsStatus() {
  const ws = window.__ignisWs;

  if (!ws) {
    return "disconnected";
  }

  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return "connecting";
    case WebSocket.OPEN:
      return "connected";
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      return "disconnected";
    default:
      return "disconnected";
  }
}

function statusLabel(status) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "disconnected":
      return "Disconnected";
    default:
      return "Unknown";
  }
}

function addServerStatus(containerEl) {
  const status = getWsStatus();

  const setting = new Setting(containerEl).setName("Server status");

  const dotEl = setting.controlEl.createEl("span", {
    cls: `ignis-status-dot ignis-status-${status}`,
  });

  const labelEl = setting.controlEl.createEl("span", {
    text: statusLabel(status),
    cls: "ignis-status-label",
  });

  const update = () => {
    const s = getWsStatus();
    dotEl.className = `ignis-status-dot ignis-status-${s}`;
    labelEl.textContent = statusLabel(s);
  };

  const pollInterval = setInterval(update, 3000);

  const observer = new MutationObserver(() => {
    if (!containerEl.isConnected) {
      clearInterval(pollInterval);
      observer.disconnect();
    }
  });

  observer.observe(containerEl.parentElement || document.body, {
    childList: true,
    subtree: true,
  });
}

module.exports = { display };
