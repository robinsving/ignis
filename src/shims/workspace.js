import { fsShim } from "./fs/index.js";
import {
  registerPathResolver,
  registerReadTransform,
  registerWriteTransform,
} from "./fs/transforms.js";

const WORKSPACE_PATH = ".obsidian/workspace.json";
const WORKSPACES_PATH = ".obsidian/workspaces.json";

// Redirect workspace.json to a per-name file when a workspace is active in this tab.
registerPathResolver(
  (path) => path === WORKSPACE_PATH && !!window.__workspaceName,
  () => `.obsidian/workspace.${window.__workspaceName}.json`,
);

// Keep workspaces.json's active field at the canonical value on disk so other tabs see a stable state.
registerWriteTransform(WORKSPACES_PATH, (content) => {
  const original = window.__originalActiveWorkspace;

  if (!original || !window.__workspaceName) {
    return content;
  }

  if (typeof content !== "string") {
    return content;
  }

  try {
    const parsed = JSON.parse(content);

    if (parsed.active !== original) {
      parsed.active = original;
      return JSON.stringify(parsed);
    }
  } catch {}

  return content;
});

function setWorkspaceParam(name) {
  const url = new URL(window.location.href);

  if (name) {
    url.searchParams.set("workspace", name);
  } else {
    url.searchParams.delete("workspace");
  }

  history.replaceState(null, "", url.toString());
}

export function resolveWorkspaceName() {
  try {
    const vaultParam = window.__currentVaultId
      ? "?vault=" + encodeURIComponent(window.__currentVaultId)
      : "";

    const sep = vaultParam ? "&" : "?";

    // If no param provided, check if workspaces plugin is enabled before resolving.
    if (!window.__workspaceName) {
      const coreXhr = new XMLHttpRequest();

      coreXhr.open(
        "GET",
        "/api/fs/readFile" + vaultParam + sep + "path=.obsidian/core-plugins.json&encoding=utf-8",
        false,
      );
      coreXhr.send();

      if (coreXhr.status !== 200) {
        return;
      }

      const corePlugins = JSON.parse(coreXhr.responseText);

      if (!corePlugins.workspaces) {
        return;
      }
    }

    // Read workspaces.json to get the active field.
    const xhr = new XMLHttpRequest();

    xhr.open(
      "GET",
      "/api/fs/readFile" + vaultParam + sep + "path=.obsidian/workspaces.json&encoding=utf-8",
      false,
    );
    xhr.send();

    if (xhr.status !== 200) {
      return;
    }

    const workspaces = JSON.parse(xhr.responseText);

    // Always store the original active value for the write transform.
    if (workspaces.active) {
      window.__originalActiveWorkspace = workspaces.active;
    }

    // If no param was provided, seed from the active workspace.
    if (!window.__workspaceName && workspaces.active) {
      window.__workspaceName = workspaces.active;
      setWorkspaceParam(workspaces.active);
      console.log("[ignis] Workspace resolved from active:", workspaces.active);
    }
  } catch (e) {
    console.warn("[ignis] Failed to resolve workspace name:", e);
  }
}

export function initWorkspacePatch() {
  const observer = new MutationObserver(() => {
    if (!document.querySelector(".workspace")) {
      return;
    }

    const plugin =
      window.app &&
      window.app.internalPlugins &&
      window.app.internalPlugins.plugins &&
      window.app.internalPlugins.plugins.workspaces;

    if (!plugin || !plugin.enabled || !plugin.instance) {
      return;
    }

    observer.disconnect();

    const instance = plugin.instance;
    const origLoad = instance.loadWorkspace.bind(instance);
    const origSave = instance.saveWorkspace.bind(instance);

    instance.loadWorkspace = function (name) {
      window.__workspaceName = name;
      setWorkspaceParam(name);
      fsShim.invalidate(WORKSPACE_PATH);
      return origLoad(name);
    };

    instance.saveWorkspace = function (name) {
      // Grab the current layout before changing __workspaceName.
      let currentLayout = null;

      try {
        currentLayout = fsShim.readFileSync(WORKSPACE_PATH, "utf-8");
      } catch {}

      window.__workspaceName = name;
      setWorkspaceParam(name);
      fsShim.invalidate(WORKSPACE_PATH);
      const result = origSave(name);

      // Write the layout to the new workspace file so it exists on disk immediately.
      if (currentLayout) {
        fsShim.writeFileSync(WORKSPACE_PATH, currentLayout, "utf-8");
      }

      return result;
    };

    // Override the active field on reads so the menu matches this tab's workspace.
    registerReadTransform(WORKSPACES_PATH, (data) => {
      if (!window.__workspaceName) {
        return data;
      }

      let text =
        typeof data === "string" ? data : new TextDecoder().decode(data);

      try {
        const parsed = JSON.parse(text);

        if (parsed.active !== window.__workspaceName) {
          parsed.active = window.__workspaceName;
          return JSON.stringify(parsed);
        }
      } catch {}

      return data;
    });

    // Relay watcher events for workspaces.json to the plugin's config change handler,
    // so creating/deleting workspaces in one tab updates the menu in other tabs.
    fsShim.watch(".obsidian", (eventType, filename) => {
      if (filename === "workspaces.json") {
        plugin.loadData().then((data) => {
          if (data) {
            instance.workspaces = data.workspaces || {};
          }
        });
      }
    });

    console.log("[ignis] Workspaces plugin patched, workspace:", window.__workspaceName || "(none)");
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
