const { WebSocketServer } = require("ws");
const url = require("url");
const watcher = require("./watcher");

function setupWebSocket(server, opts = {}) {
  const { getVaultPath } = opts;

  if (typeof getVaultPath !== "function") {
    throw new Error("setupWebSocket: opts.getVaultPath is required");
  }

  const wss = new WebSocketServer({ server, path: "/ws" });

  // Plugin-registered message handlers: type -> handler(msg, ws)
  wss.messageHandlers = new Map();

  wss.on("connection", (ws, req) => {
    const params = new url.URL(req.url, "http://localhost").searchParams;
    const vaultId = params.get("vault");

    if (!vaultId || !getVaultPath(vaultId)) {
      ws.close(4001, "Invalid or missing vault ID");
      return;
    }

    const vaultPath = getVaultPath(vaultId);
    console.log(`[ws] Client connected to vault: ${vaultId}`);

    // Start watching this vault (no-op if already watching)
    watcher.startWatching(vaultId, vaultPath);

    // Per-client listener that forwards events over WebSocket
    const listener = (event) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(event));
      }
    };

    watcher.addListener(vaultId, listener);

    // Dispatch incoming messages to registered handlers
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data);
        const handler = wss.messageHandlers.get(msg.type);

        if (handler) {
          handler(msg, ws);
        }
      } catch {}
    });

    ws.on("close", () => {
      console.log(`[ws] Client disconnected from vault: ${vaultId}`);
      watcher.removeListener(vaultId, listener);
    });
  });

  return wss;
}

module.exports = { setupWebSocket };
