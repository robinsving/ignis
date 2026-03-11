import { MetadataCache } from "./metadata-cache.js";
import { ContentCache } from "./content-cache.js";
import { transport } from "./transport.js";
import { createFsPromises } from "./promises.js";
import { createFsSync } from "./sync.js";
import { createFsWatch } from "./watch.js";
import { constants } from "./constants.js";

const metadataCache = new MetadataCache();
const contentCache = new ContentCache();

const fsPromises = createFsPromises(metadataCache, contentCache, transport);
const fsSync = createFsSync(metadataCache, contentCache, transport);
const fsWatch = createFsWatch(transport);

export const fsShim = {
  promises: fsPromises,

  existsSync: fsSync.existsSync,
  readFileSync: fsSync.readFileSync,
  writeFileSync: fsSync.writeFileSync,
  unlinkSync: fsSync.unlinkSync,
  accessSync: fsSync.accessSync,
  statSync: fsSync.statSync,
  readdirSync: fsSync.readdirSync,

  watch: fsWatch.watch,
  constants,

  _metadataCache: metadataCache,
  _contentCache: contentCache,

  async _init(basePath) {
    const tree = await transport.fetchTree(basePath);
    metadataCache.populate(tree);
    console.log(`[shim:fs] Initialized with ${metadataCache.size} entries`);
  },
};
