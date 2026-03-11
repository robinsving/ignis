export const clipboardShim = {
  readText() {
    // TODO: maintain a local mirror updated via async reads
    return "";
  },

  writeText(text) {
    navigator.clipboard.writeText(text).catch((e) => {
      console.warn("[shim:clipboard] writeText failed:", e);
    });
  },

  readHTML() {
    return "";
  },

  writeHTML(html) {
    console.log("[shim:clipboard] writeHTML (stub)");
  },

  readImage() {
    return { isEmpty: () => true, toPNG: () => new Uint8Array(0) };
  },

  writeImage(image) {
    console.log("[shim:clipboard] writeImage (stub)");
  },

  has(format) {
    return false;
  },

  read(format) {
    return "";
  },

  clear() {
    navigator.clipboard.writeText("").catch(() => {});
  },
};
