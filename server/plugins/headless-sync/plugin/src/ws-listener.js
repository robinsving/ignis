const CHANNEL = "plugin:headless-sync";
const POLL_INTERVAL = 3000;

class WsListener {
  constructor() {
    this._callbacks = new Map();
    this._handler = null;
    this._pollTimer = null;
    this._currentWs = null;
  }

  start() {
    this._attachToWs();

    this._pollTimer = setInterval(() => {
      this._attachToWs();
    }, POLL_INTERVAL);
  }

  stop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    this._detachFromWs();
  }

  on(type, callback) {
    if (!this._callbacks.has(type)) {
      this._callbacks.set(type, []);
    }

    this._callbacks.get(type).push(callback);
  }

  off(type, callback) {
    const list = this._callbacks.get(type);

    if (!list) {
      return;
    }

    const idx = list.indexOf(callback);

    if (idx !== -1) {
      list.splice(idx, 1);
    }
  }

  _attachToWs() {
    const ws = window.__ignisWs;

    if (!ws || ws === this._currentWs) {
      return;
    }

    this._detachFromWs();
    this._currentWs = ws;

    this._handler = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.channel !== CHANNEL) {
          return;
        }

        const listeners = this._callbacks.get(msg.type);

        if (listeners) {
          for (const cb of listeners) {
            cb(msg.payload);
          }
        }
      } catch {}
    };

    ws.addEventListener("message", this._handler);
  }

  _detachFromWs() {
    if (this._currentWs && this._handler) {
      this._currentWs.removeEventListener("message", this._handler);
    }

    this._currentWs = null;
    this._handler = null;
  }
}

module.exports = { WsListener };
