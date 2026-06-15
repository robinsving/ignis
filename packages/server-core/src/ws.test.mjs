import { describe, it, expect, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { heartbeatSweep } = require("./ws.js");

function fakeSocket(isAlive) {
  return { isAlive, ping: vi.fn(), terminate: vi.fn() };
}

describe("ws heartbeat sweep", () => {
  it("terminates a socket that has not ponged since the last sweep", () => {
    const dead = fakeSocket(false);

    heartbeatSweep([dead]);

    expect(dead.terminate).toHaveBeenCalledTimes(1);
    expect(dead.ping).not.toHaveBeenCalled();
  });

  it("pings a live socket and marks it pending until its next pong", () => {
    const alive = fakeSocket(true);

    heartbeatSweep([alive]);

    expect(alive.ping).toHaveBeenCalledTimes(1);
    expect(alive.terminate).not.toHaveBeenCalled();
    expect(alive.isAlive).toBe(false);
  });

  it("terminates the dead and pings the live in the same sweep", () => {
    const dead = fakeSocket(false);
    const alive = fakeSocket(true);

    heartbeatSweep(new Set([dead, alive]));

    expect(dead.terminate).toHaveBeenCalledTimes(1);
    expect(dead.ping).not.toHaveBeenCalled();
    expect(alive.ping).toHaveBeenCalledTimes(1);
    expect(alive.terminate).not.toHaveBeenCalled();
    expect(alive.isAlive).toBe(false);
  });
});
