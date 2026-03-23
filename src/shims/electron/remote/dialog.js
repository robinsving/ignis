import {
  showMessageDialog,
  showConfirmDialog,
  showPromptDialog,
} from "../../../ui/bootstrap.js";
import { transport } from "../../fs/transport.js";

const IMPORTS_DIR = ".obsidian/imports";

let stagedFiles = [];

function buildAcceptString(filters) {
  if (!filters || filters.length === 0) {
    return "";
  }

  const extensions = filters.flatMap((f) => f.extensions || []);

  if (extensions.includes("*")) {
    return "";
  }

  return extensions.map((ext) => "." + ext).join(",");
}

function pickFiles(accept, multiple) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.style.display = "none";

    if (accept) {
      input.accept = accept;
    }

    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      input.remove();
      resolve(files);
    });

    // User closed the picker without selecting
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });

    document.body.appendChild(input);
    input.click();
  });
}

async function uploadToImports(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const targetPath = IMPORTS_DIR + "/" + file.name;

  await transport.writeFile(targetPath, bytes);

  return "/" + targetPath;
}

async function startWorkaroundFlow(options) {
  const properties = options?.properties || [];
  const multiple = properties.includes("multiSelections");
  const accept = buildAcceptString(options?.filters);

  const files = await pickFiles(accept, multiple);

  if (files.length === 0) {
    return;
  }

  const paths = [];

  for (const file of files) {
    const vaultPath = await uploadToImports(file);
    paths.push(vaultPath);
  }

  stagedFiles = paths;

  const names = paths.map((p) => p.split("/").pop()).join(", ");

  console.log("[shim:dialog] Files staged for next sync call:", paths);

  await showMessageDialog(
    "Files Ready",
    `Uploaded: ${names}\n\nPlease retry the action that brought you here. ` +
      "The files will be provided automatically.",
  );
}

export const dialogShim = {
  async showOpenDialog(browserWindow, options) {
    if (typeof browserWindow === "object" && !options) {
      options = browserWindow;
    }

    const properties = options?.properties || [];
    const multiple = properties.includes("multiSelections");
    const accept = buildAcceptString(options?.filters);

    console.log("[shim:dialog] showOpenDialog  -  opening browser file picker");

    const files = await pickFiles(accept, multiple);

    if (files.length === 0) {
      return { canceled: true, filePaths: [] };
    }

    const filePaths = [];

    for (const file of files) {
      const vaultPath = await uploadToImports(file);
      filePaths.push(vaultPath);
    }

    console.log("[shim:dialog] showOpenDialog  -  uploaded:", filePaths);
    return { canceled: false, filePaths };
  },

  showOpenDialogSync(browserWindow, options) {
    if (typeof browserWindow === "object" && !options) {
      options = browserWindow;
    }

    // If files were staged from a previous workaround, return them immediately
    if (stagedFiles.length > 0) {
      const paths = stagedFiles;
      stagedFiles = [];
      console.log(
        "[shim:dialog] showOpenDialogSync  -  returning staged files:",
        paths,
      );
      return paths;
    }

    console.warn(
      "[shim:dialog] showOpenDialogSync requires workaround in browser context",
    );

    // Fire-and-forget: show warning, then optionally start workaround flow
    showConfirmDialog(
      "Feature Not Available",
      "This action requires a native file picker which is not available in the browser.",
      "A workaround is available: upload your file first, then retry the action. " +
        "Would you like to proceed?",
      "Upload File",
    ).then((confirmed) => {
      if (confirmed) {
        startWorkaroundFlow(options);
      }
    });

    return undefined;
  },

  async showSaveDialog(browserWindow, options) {
    if (typeof browserWindow === "object" && !options) {
      options = browserWindow;
    }

    const defaultName =
      options?.defaultPath?.split(/[\/\\]/).pop() || "download";
    const name = await showPromptDialog(
      "Save File",
      "Save as:",
      "filename",
      defaultName,
      "Save",
    );

    if (!name) {
      return { canceled: true, filePath: undefined };
    }

    return { canceled: false, filePath: "/downloads/" + name };
  },

  async showMessageBox(browserWindow, options) {
    if (typeof browserWindow === "object" && !options) {
      options = browserWindow;
    }

    console.log("[shim:dialog] showMessageBox:", options);

    const message = options.message || "";
    const detail = options.detail || "";
    const buttons = options.buttons || ["OK"];
    const fullMessage = message + (detail ? "\n\n" + detail : "");

    if (buttons.length <= 1) {
      await showMessageDialog(options.title || "Message", fullMessage);
      return { response: 0, checkboxChecked: false };
    }

    const result = await showConfirmDialog(
      options.title || "Confirm",
      message,
      detail,
      buttons[0],
    );

    return {
      response: result ? 0 : 1,
      checkboxChecked: false,
    };
  },

  showErrorBox(title, content) {
    console.error("[shim:dialog] Error:", title, content);
    showMessageDialog(title, content);
  },
};
