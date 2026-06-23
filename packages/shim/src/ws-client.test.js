import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWsClient } from "./ws-client.js";

let sockets;

beforeEach(() => {
  sockets = [];

  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      sockets.push(this);
    }
    send() {}
    close() {}
  }

  FakeWebSocket.OPEN = 1;
  globalThis.WebSocket = FakeWebSocket;
  globalThis.window = { location: { protocol: "http:", host: "localhost" } };
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.WebSocket;
  delete globalThis.window;
});

describe("ws-client reconnect", () => {
  it("fires onReconnect on a re-open but not on the first open", () => {
    const client = createWsClient();
    const onReconnect = vi.fn();
    client.onReconnect(onReconnect);

    client.connect("v1");
    sockets[0].onopen();
    expect(onReconnect).not.toHaveBeenCalled();

    sockets[0].onclose();
    vi.advanceTimersByTime(2000);
    sockets[1].onopen();

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("stops firing after unsubscribe", () => {
    const client = createWsClient();
    const onReconnect = vi.fn();
    const off = client.onReconnect(onReconnect);

    client.connect("v1");
    sockets[0].onopen();
    off();

    sockets[0].onclose();
    vi.advanceTimersByTime(2000);
    sockets[1].onopen();

    expect(onReconnect).not.toHaveBeenCalled();
  });
});
