export const dialogShim = {
  async showOpenDialog(browserWindow, options) {
    // TODO: implement custom modal with server-side file listing
    console.log("[shim:dialog] showOpenDialog (stub):", options);
    return { canceled: true, filePaths: [] };
  },

  async showSaveDialog(browserWindow, options) {
    // TODO: implement custom modal
    console.log("[shim:dialog] showSaveDialog (stub):", options);
    return { canceled: true, filePath: undefined };
  },

  async showMessageBox(browserWindow, options) {
    if (typeof browserWindow === "object" && !options) {
      options = browserWindow;
    }
    console.log("[shim:dialog] showMessageBox:", options);

    const message = options.message || "";
    const detail = options.detail || "";
    const buttons = options.buttons || ["OK"];

    if (buttons.length <= 1) {
      alert(message + (detail ? "\n\n" + detail : ""));
      return { response: 0, checkboxChecked: false };
    }

    const result = confirm(
      message +
        (detail ? "\n\n" + detail : "") +
        '\n\n[OK] = "' +
        buttons[0] +
        '", [Cancel] = "' +
        buttons[1] +
        '"',
    );
    return {
      response: result ? 0 : 1,
      checkboxChecked: false,
    };
  },

  showErrorBox(title, content) {
    console.error("[shim:dialog] Error:", title, content);
    alert(title + "\n\n" + content);
  },
};
