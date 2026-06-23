import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prefetchVaultContent } from "./indexer-prefetch.js";

const MB = 1024 * 1024;

// Every selection rule.
const tree = {
  ".obsidian/app.json": { type: "file", size: 100 },
  ".obsidian/community-plugins.json": { type: "file", size: 50 },
  ".obsidian/plugins/big/main.js": { type: "file", size: 2 * MB },
  ".obsidian/plugins/big/manifest.json": { type: "file", size: 80 },
  ".obsidian/plugins/big/styles.css": { type: "file", size: 200 },
  ".obsidian/plugins/big/data.json": { type: "file", size: 300 * 1024 },
  "Note.md": { type: "file", size: 100 },
  "Big.md": { type: "file", size: 600 * 1024 },
  "plugins/fake/main.js": { type: "file", size: 100 },
  somedir: { type: "directory" },
};

const PRIORITY_BYTES = 100 + 50 + 2 * MB + 80 + 200;

let fetchCalls;

function makeCache() {
  const store = new Map();
  return { store, set: (path, content) => store.set(path, content) };
}

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = vi.fn(async (url, init) => {
    const paths = JSON.parse(init.body).paths;
    fetchCalls.push(paths);

    const files = {};

    for (const p of paths) {
      files[p] = "content:" + p;
    }

    return { ok: true, json: async () => ({ files }) };
  });
});

afterEach(() => {
  delete globalThis.fetch;
  vi.restoreAllMocks();
});

describe("prefetchVaultContent slicing", () => {
  it("fetches the priority slice before the bulk slice", async () => {
    const result = prefetchVaultContent("v", tree, makeCache());
    await result.bulk;

    expect(fetchCalls.length).toBe(2);
    const [priorityPaths, bulkPaths] = fetchCalls;

    expect(priorityPaths).toEqual(
      expect.arrayContaining([
        ".obsidian/app.json",
        ".obsidian/community-plugins.json",
        ".obsidian/plugins/big/main.js",
        ".obsidian/plugins/big/manifest.json",
        ".obsidian/plugins/big/styles.css",
      ]),
    );
    expect(priorityPaths).not.toContain("Note.md");

    expect(bulkPaths).toEqual(
      expect.arrayContaining(["Note.md", "plugins/fake/main.js"]),
    );
  });

  it("anchors the plugin predicate to .obsidian, so a bare plugins/ path is bulk", async () => {
    const result = prefetchVaultContent("v", tree, makeCache());
    await result.bulk;

    expect(fetchCalls[0]).not.toContain("plugins/fake/main.js");
    expect(fetchCalls[1]).toContain("plugins/fake/main.js");
  });

  it("leaves plugin data.json to the bulk slice, not priority", async () => {
    const result = prefetchVaultContent("v", tree, makeCache());
    await result.bulk;

    expect(fetchCalls[0]).not.toContain(".obsidian/plugins/big/data.json");
    expect(fetchCalls[1]).toContain(".obsidian/plugins/big/data.json");
  });

  it("caps the priority slice at its own byte budget", async () => {
    // Three 4MB plugin entry files: two fit the 10MB priority budget, the third is dropped.
    const bigTree = {
      ".obsidian/plugins/a/main.js": { type: "file", size: 4 * MB },
      ".obsidian/plugins/b/main.js": { type: "file", size: 4 * MB },
      ".obsidian/plugins/c/main.js": { type: "file", size: 4 * MB },
    };

    const result = prefetchVaultContent("v", bigTree, makeCache());
    await result.bulk;

    expect(fetchCalls[0].length).toBe(2);
  });

  it("drops a bulk file over the 512KB per-file cap", async () => {
    const result = prefetchVaultContent("v", tree, makeCache());
    await result.bulk;

    expect(fetchCalls.flat()).not.toContain("Big.md");
  });

  it("reports priority byte progress from zero up to the slice total", async () => {
    const onProgress = vi.fn();
    const result = prefetchVaultContent("v", tree, makeCache(), { onProgress });
    await result.priority;

    expect(onProgress).toHaveBeenCalledWith(0, PRIORITY_BYTES);
    expect(onProgress).toHaveBeenLastCalledWith(PRIORITY_BYTES, PRIORITY_BYTES);
  });

  it("caches returned content under its path", async () => {
    const cache = makeCache();
    const result = prefetchVaultContent("v", tree, cache);
    await result.bulk;

    expect(cache.store.get(".obsidian/app.json")).toBe(
      "content:.obsidian/app.json",
    );
    expect(cache.store.get("Note.md")).toBe("content:Note.md");
  });

  it("resolves both promises without fetching when there is no vault", async () => {
    const result = prefetchVaultContent("", tree, makeCache());

    await result.priority;
    await result.bulk;

    expect(fetchCalls.length).toBe(0);
  });

  it("resolves the priority promise even when a batch fails", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 }));

    const result = prefetchVaultContent("v", tree, makeCache());

    await expect(result.priority).resolves.toBeUndefined();
  });
});
