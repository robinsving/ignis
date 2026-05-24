// Virtual plugin source served from memory; the fs shim's read path checks here before disk.

function normalize(p) {
  return (p || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

const virtualFiles = new Map();

export function setVirtualFile(path, content) {
  virtualFiles.set(normalize(path), content);
}

export function removeVirtualFile(path) {
  virtualFiles.delete(normalize(path));
}

export function getVirtualFile(path) {
  return virtualFiles.get(normalize(path));
}

export function hasVirtualFile(path) {
  return virtualFiles.has(normalize(path));
}
