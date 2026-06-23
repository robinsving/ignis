import { vaultService } from "@ignis/services";
import InsecureContextNotice from "./components/layout/InsecureContextNotice.svelte";

function showVaultManager() {
  if (document.querySelector(".vault-manager-overlay")) return;

  new window.IgnisUI.VaultManager({
    target: document.body,
    props: { vaultService },
  });
}

function showMessageDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = new window.IgnisUI.MessageDialog({
      target: document.body,
      props: { title, message },
    });

    dialog.$on("confirm", () => {
      dialog.$destroy();
      resolve();
    });
  });
}

function showConfirmDialog(title, message, description, confirmText = "OK") {
  return new Promise((resolve) => {
    const dialog = new window.IgnisUI.ConfirmDialog({
      target: document.body,
      props: { title, message, description, confirmText },
    });

    dialog.$on("confirm", () => {
      dialog.$destroy();
      resolve(true);
    });

    dialog.$on("cancel", () => {
      dialog.$destroy();
      resolve(false);
    });
  });
}

function showPromptDialog(
  title,
  label,
  placeholder = "",
  value = "",
  confirmText = "OK",
) {
  return new Promise((resolve) => {
    const dialog = new window.IgnisUI.PromptDialog({
      target: document.body,
      props: { title, label, placeholder, value, confirmText },
    });

    dialog.$on("confirm", (event) => {
      dialog.$destroy();
      resolve(event.detail);
    });

    dialog.$on("cancel", () => {
      dialog.$destroy();
      resolve(null);
    });
  });
}

if (typeof window !== "undefined" && window.__ignis_registerUI) {
  window.__ignis_registerUI({
    showVaultManager,
    showMessageDialog,
    showConfirmDialog,
    showPromptDialog,
  });
} else if (typeof window !== "undefined") {
  console.warn(
    "[ignis] __ignis_registerUI not available; UI handlers not registered",
  );
}

// On a non-secure context the browser gates certain APIs causing certain features to break.
// Show a notice about the degraded experience and how to fix it.
function showInsecureContextNotice() {
  if (window.isSecureContext) {
    return;
  }

  if (document.getElementById("ignis-insecure-banner")) {
    return;
  }

  const notice = new InsecureContextNotice({ target: document.body });
  notice.$on("dismiss", () => notice.$destroy());
}

if (typeof window !== "undefined") {
  if (document.body) {
    showInsecureContextNotice();
  } else {
    window.addEventListener("DOMContentLoaded", showInsecureContextNotice, {
      once: true,
    });
  }
}
