export const appShim = {
  getPath(name) {
    const paths = {
      userData: "/.obsidian",
      home: "/",
      documents: "/documents",
      desktop: "/desktop",
      temp: "/tmp",
      appData: "/.obsidian",
    };
    return paths[name] || "/";
  },

  getVersion() {
    return "1.8.9";
  },

  getName() {
    return "Obsidian";
  },

  getLocale() {
    return navigator.language || "en-US";
  },

  isPackaged: true,

  quit() {
    console.log("[shim:app] quit (stub)");
  },

  relaunch() {
    window.location.reload();
  },

  whenReady() {
    return Promise.resolve();
  },

  on() {},
  once() {},
  removeListener() {},
};
