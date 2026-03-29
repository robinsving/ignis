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
    default:
      return "disconnected";
  }
}

const STATUS_LABELS = {
  connected: "Ignis server: Connected",
  connecting: "Ignis server: Connecting...",
  disconnected: "Ignis server: Disconnected",
};

function initStatusBar(plugin) {
  const item = plugin.addStatusBarItem();
  item.addClass("ignis-statusbar-item");

  const dot = item.createEl("span", {
    cls: "ignis-statusbar-dot",
  });

  item.setAttribute("aria-label", "Ignis: Checking...");
  item.setAttribute("data-tooltip-position", "top");

  const update = () => {
    const status = getWsStatus();
    dot.className = `ignis-statusbar-dot ignis-statusbar-${status}`;
    item.setAttribute("aria-label", STATUS_LABELS[status] || "Ignis: Unknown");
  };

  update();

  const interval = setInterval(update, 3000);

  return interval;
}

module.exports = { initStatusBar };
