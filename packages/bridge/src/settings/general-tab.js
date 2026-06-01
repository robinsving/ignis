const { Setting } = require("obsidian");

const GITHUB_URL = "https://github.com/Nystik-gh/ignis";
const GITHUB_API_LATEST =
  "https://api.github.com/repos/Nystik-gh/ignis/releases/latest";

function getVersion() {
  return window.__ignis?.version || "unknown";
}

// SemVer build metadata (`+xyz`) is informational and ignored for precedence.
function stripBuildMetadata(version) {
  return (version || "").split("+")[0];
}

async function checkForUpdate(currentVersion) {
  try {
    const res = await fetch(GITHUB_API_LATEST);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const latest = stripBuildMetadata(data.tag_name?.replace(/^v/, ""));
    const current = stripBuildMetadata(currentVersion);

    if (latest && latest !== current) {
      return { version: latest, url: data.html_url };
    }

    return null;
  } catch {
    return null;
  }
}

function display(containerEl, app) {
  const version = getVersion();

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

  const updateIndicator = versionCol.createEl("a", {
    text: "Checking...",
    cls: "ignis-update-indicator",
    attr: { target: "_blank", rel: "noopener noreferrer" },
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

  checkForUpdate(version).then((latest) => {
    if (latest) {
      updateIndicator.textContent = `v${latest.version} available`;
      updateIndicator.addClass("ignis-update-available");
      updateIndicator.href = latest.url;
    } else {
      updateIndicator.textContent = "Up to date";
    }
  });

  addServerStatus(containerEl);
}

const STATUS_LABELS = {
  open: "Connected",
  connecting: "Connecting...",
  closed: "Disconnected",
};

const STATUS_DOT_CLASSES = {
  open: "ignis-status-connected",
  connecting: "ignis-status-connecting",
  closed: "ignis-status-disconnected",
};

function addServerStatus(containerEl) {
  const ws = window.__ignis.ws;

  const setting = new Setting(containerEl).setName("Server status");

  const dotEl = setting.controlEl.createEl("span", {
    cls: "ignis-status-dot",
  });

  const labelEl = setting.controlEl.createEl("span", {
    cls: "ignis-status-label",
  });

  function render(state) {
    dotEl.className = `ignis-status-dot ${STATUS_DOT_CLASSES[state] || STATUS_DOT_CLASSES.closed}`;
    labelEl.textContent = STATUS_LABELS[state] || STATUS_LABELS.closed;
  }

  render(ws.isOpen() ? "open" : "closed");

  const unsub = ws.onStateChange(render);

  // Detach when the settings tab DOM goes away.
  const observer = new MutationObserver(() => {
    if (!containerEl.isConnected) {
      unsub();
      observer.disconnect();
    }
  });

  observer.observe(containerEl.parentElement || document.body, {
    childList: true,
    subtree: true,
  });
}

module.exports = { display };
