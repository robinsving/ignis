const generalTab = require("./general-tab");
const serverPluginsTab = require("./server-plugins-tab");

function createNavEl(tab, setting) {
  const nav = document.createElement("div");
  nav.className = "vertical-tab-nav-item tappable";

  const title = document.createElement("div");
  title.className = "vertical-tab-nav-item-title";
  title.textContent = tab.name;
  nav.appendChild(title);

  const chevron = document.createElement("div");
  chevron.className = "vertical-tab-nav-item-chevron";
  nav.appendChild(chevron);

  nav.addEventListener("click", () => {
    setting.openTab(tab);
  });

  return nav;
}

function createTab(id, name, displayFn, app) {
  const tab = {
    id,
    name,
    containerEl: createDiv("vertical-tab-content"),
    navEl: null,

    display() {
      this.containerEl.empty();
      displayFn(this.containerEl, app);
    },

    hide() {
      this.containerEl.empty();
    },
  };

  return tab;
}

function createGroup(name) {
  const group = document.createElement("div");
  group.className = "vertical-tab-header-group";

  const title = document.createElement("div");
  title.className = "vertical-tab-header-group-title";
  title.textContent = name;
  group.appendChild(title);

  const items = document.createElement("div");
  items.className = "vertical-tab-header-group-items";
  group.appendChild(items);

  return { group, items };
}

function injectIgnisSettings(setting, app) {
  const ignis = createGroup("Ignis");

  const tabs = [
    createTab("ignis-general", "General", generalTab.display, app),
    createTab(
      "ignis-core-plugins",
      "Core plugins",
      serverPluginsTab.display,
      app,
    ),
  ];

  for (const tab of tabs) {
    tab.navEl = createNavEl(tab, setting);
    ignis.items.appendChild(tab.navEl);
  }

  setting.tabHeadersEl.appendChild(ignis.group);

  const corePlugins = createGroup("Ignis Core Plugins");
  setting.tabHeadersEl.appendChild(corePlugins.group);
}

function patchSettingsModal(plugin) {
  const original = plugin.app.setting.onOpen;
  const app = plugin.app;
  plugin._originalOnOpen = original;

  plugin.app.setting.onOpen = function () {
    original.call(this);
    injectIgnisSettings(this, app);
  };
}

function unpatchSettingsModal(plugin) {
  if (plugin._originalOnOpen) {
    plugin.app.setting.onOpen = plugin._originalOnOpen;
  }
}

module.exports = { patchSettingsModal, unpatchSettingsModal };
