// Batch pre-fetch of vault content into ContentCache.
// Pulls text file contents in batches via /api/fs/batch-read and drops them into ContentCache so Obsidian's startup reads hit the cache instead of fetching each file individually.
// The priority slice (.obsidian configs and plugin entry files) is fetched first and its promise resolves once it lands, so boot can wait for those reads to be warm.
// The bulk slice (everything else) streams afterward without blocking boot.

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".csv",
  ".css",
  ".js",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".html",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".svg",
]);

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB total across both slices
const MAX_FILE_BYTES = 512 * 1024; // skip bulk files larger than 512 KB
// Plugin main.js bundles can run a few MB and Obsidian needs them at boot, so the priority slice accepts larger files than the bulk slice.
const PRIORITY_MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
// Cap the priority slice's share of the total so a heavy config or plugin set cannot starve the bulk slice.
const PRIORITY_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const BATCH_SIZE = 50;
// Number of batch-reads in flight at once, capped to the browser's per-origin connection pool (about six on HTTP/1.1).
const BATCH_CONCURRENCY = 6;

function isTextPath(path) {
  const dot = path.lastIndexOf(".");

  if (dot < 0) {
    return false;
  }

  return TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

// The core boot-critical files: root-level .obsidian configs and each plugin's entry files.
function isPriorityPath(path) {
  if (!path.startsWith(".obsidian/")) {
    return false;
  }

  // Root-level configs only (app.json, appearance.json, core-plugins.json, workspace.json, etc.).
  if (/^\.obsidian\/[^/]+\.json$/.test(path)) {
    return true;
  }

  return /^\.obsidian\/plugins\/[^/]+\/(main\.js|manifest\.json|styles\.css)$/.test(
    path,
  );
}

function isDataJsonPath(path) {
  return /^\.obsidian\/plugins\/[^/]+\/data\.json$/.test(path);
}

function collectSlice(entries, predicate, perFileCap, budget) {
  const files = [];
  let bytes = 0;

  for (const [path, entry] of entries) {
    if (entry.type !== "file" || !isTextPath(path) || !predicate(path)) {
      continue;
    }

    const size = entry.size || 0;

    if (size === 0 || size > perFileCap) {
      continue;
    }

    if (bytes + size > budget) {
      continue;
    }

    files.push({ path, size });
    bytes += size;
  }

  return { files, bytes };
}

function selectPrefetchTargets(tree) {
  // Tree key order matches directory traversal (the server walk emits parent before children).
  const entries = Object.entries(tree);

  // Admit the core boot files first, then each plugin's data.json into the leftover budget, so data.json never evicts a core file.
  const core = collectSlice(
    entries,
    isPriorityPath,
    PRIORITY_MAX_FILE_BYTES,
    PRIORITY_MAX_BYTES,
  );

  const data = collectSlice(
    entries,
    isDataJsonPath,
    PRIORITY_MAX_FILE_BYTES,
    PRIORITY_MAX_BYTES - core.bytes,
  );

  const priority = {
    files: [...core.files, ...data.files],
    bytes: core.bytes + data.bytes,
  };

  // Bulk is everything the priority slice did not admit, so a file dropped from priority by a cap or the budget still gets a chance in bulk.
  const admitted = new Set(priority.files.map((f) => f.path));

  const bulk = collectSlice(
    entries,
    (path) => !admitted.has(path),
    MAX_FILE_BYTES,
    MAX_BYTES - priority.bytes,
  );

  return { priority, bulk };
}

async function fetchBatch(vaultId, paths) {
  const res = await fetch("/api/fs/batch-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault: vaultId, paths }),
  });

  if (!res.ok) {
    throw new Error("batch-read failed: " + res.status);
  }

  return res.json();
}

async function runBatches(vaultId, slice, contentCache, label, onProgress) {
  if (slice.files.length === 0) {
    return;
  }

  const t0 = Date.now();
  let cached = 0;
  let received = 0;

  // Report the total up front so the splash shows the target before the first batch lands.
  if (onProgress) {
    onProgress(0, slice.bytes);
  }

  const batches = [];

  for (let i = 0; i < slice.files.length; i += BATCH_SIZE) {
    batches.push(slice.files.slice(i, i + BATCH_SIZE));
  }

  // Several workers pull batches off a shared cursor until all batches are processed or one fails.
  let cursor = 0;
  let aborted = false;

  async function worker() {
    while (!aborted) {
      const idx = cursor++;

      if (idx >= batches.length) {
        return;
      }

      const batch = batches[idx];

      let result;

      try {
        result = await fetchBatch(
          vaultId,
          batch.map((f) => f.path),
        );
      } catch (e) {
        console.warn(`[ignis] Prefetch ${label} batch failed:`, e.message);
        aborted = true;
        return;
      }

      for (const [path, content] of Object.entries(result.files || {})) {
        if (typeof content === "string") {
          contentCache.set(path, content);
          cached++;
        }
      }

      if (onProgress) {
        for (const f of batch) {
          received += f.size;
        }

        onProgress(received, slice.bytes);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(BATCH_CONCURRENCY, batches.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const ms = Date.now() - t0;

  console.log(
    `[ignis] Prefetched ${label} ${cached}/${slice.files.length} files (${(slice.bytes / 1024).toFixed(0)} KB) in ${ms}ms`,
  );
}

// Returns { priority, bulk }: a promise for each slice.
// The priority promise resolves once the boot-critical files have landed (or were abandoned on a batch failure), so it is always safe to await.
export function prefetchVaultContent(
  vaultId,
  tree,
  contentCache,
  options = {},
) {
  if (!vaultId || !tree) {
    return { priority: Promise.resolve(), bulk: Promise.resolve() };
  }

  const { priority, bulk } = selectPrefetchTargets(tree);

  const priorityDone = runBatches(
    vaultId,
    priority,
    contentCache,
    "priority",
    options.onProgress,
  );

  // Bulk streams after the priority slice so it does not contend for the connection pool while boot is waiting on priority.
  // It runs regardless of how priority settled and swallows its own rejection, since init.js discards this promise.
  const bulkDone = priorityDone
    .catch(() => {})
    .then(() => runBatches(vaultId, bulk, contentCache, "bulk"))
    .catch((e) => {
      console.warn("[ignis] Prefetch bulk failed:", e && e.message);
    });

  return { priority: priorityDone, bulk: bulkDone };
}
