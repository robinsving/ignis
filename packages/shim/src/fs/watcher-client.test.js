import { describe, it, expect, vi } from "vitest";
import { createWatcherClient } from "./watcher-client.js";
import { markLocalOp } from "./echo-guard.js";

function makeDeps() {
  const store = new Map();

  const metadataCache = {
    get: (p) => store.get(p) || null,
    set: (p, m) => store.set(p, m),
    delete: (p) => store.delete(p),
    has: (p) => store.has(p),
    keys: () => [...store.keys()],
  };

  const contentCache = {
    invalidate: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    get: () => null,
  };

  const fsWatch = { _dispatch: vi.fn() };
  const wsClient = { subscribe: vi.fn(), onReconnect: vi.fn() };
  const transport = { fetchTree: vi.fn() };

  const client = createWatcherClient(
    metadataCache,
    contentCache,
    fsWatch,
    wsClient,
    transport,
  );

  return { store, metadataCache, contentCache, fsWatch, wsClient, transport, client };
}

describe("watcher-client reconcile", () => {
  it("adds a file present in the tree but missing from the cache", () => {
    const d = makeDeps();

    d.client.reconcile({ "new.md": { type: "file", size: 5, mtime: 100, ctime: 50 } });

    expect(d.store.get("new.md")).toMatchObject({ type: "file", size: 5 });
    expect(d.contentCache.invalidate).toHaveBeenCalledWith("new.md");
    expect(d.fsWatch._dispatch).toHaveBeenCalledWith("created", "new.md");
  });

  it("adds a directory as a folder", () => {
    const d = makeDeps();

    d.client.reconcile({ newdir: { type: "directory" } });

    expect(d.store.get("newdir")).toEqual({ type: "directory" });
    expect(d.fsWatch._dispatch).toHaveBeenCalledWith("folder-created", "newdir");
  });

  it("modifies a file whose mtime or size changed", () => {
    const d = makeDeps();
    d.store.set("a.md", { type: "file", size: 1, mtime: 10 });

    d.client.reconcile({ "a.md": { type: "file", size: 2, mtime: 20, ctime: 5 } });

    expect(d.store.get("a.md")).toMatchObject({ size: 2, mtime: 20 });
    expect(d.fsWatch._dispatch).toHaveBeenCalledWith("modified", "a.md");
  });

  it("is a no-op for an unchanged file", () => {
    const d = makeDeps();
    d.store.set("a.md", { type: "file", size: 1, mtime: 10 });

    d.client.reconcile({ "a.md": { type: "file", size: 1, mtime: 10, ctime: 5 } });

    expect(d.fsWatch._dispatch).not.toHaveBeenCalled();
  });

  it("deletes a cache entry absent from the tree and preserves the root", () => {
    const d = makeDeps();
    d.store.set("", { type: "directory" });
    d.store.set("gone.md", { type: "file", size: 1, mtime: 10 });
    d.store.set("keep.md", { type: "file", size: 1, mtime: 10 });

    d.client.reconcile({ "keep.md": { type: "file", size: 1, mtime: 10, ctime: 5 } });

    expect(d.store.has("gone.md")).toBe(false);
    expect(d.store.has("")).toBe(true);
    expect(d.fsWatch._dispatch).toHaveBeenCalledWith("deleted", "gone.md");
    expect(d.fsWatch._dispatch).not.toHaveBeenCalledWith("deleted", "keep.md");
  });

  it("skips a path with a recent local op", () => {
    const d = makeDeps();
    const p = "recent-local-op-reconcile.md";
    markLocalOp(p);

    d.client.reconcile({ [p]: { type: "file", size: 5, mtime: 100, ctime: 50 } });

    expect(d.store.has(p)).toBe(false);
    expect(d.fsWatch._dispatch).not.toHaveBeenCalled();
  });
});
