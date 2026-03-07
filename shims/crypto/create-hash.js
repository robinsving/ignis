// Shim for crypto.createHash
// Obsidian uses createHash('SHA256') for signature verification (main process only)
// and possibly for content hashing in the renderer.
// Uses SubtleCrypto where possible.

export function createHash(algorithm) {
  const alg = algorithm.toUpperCase().replace('-', '');
  const subtleAlg = alg === 'SHA256' ? 'SHA-256' : alg === 'SHA1' ? 'SHA-1' : alg === 'SHA512' ? 'SHA-512' : alg;

  let inputData = new Uint8Array(0);

  return {
    update(data) {
      if (typeof data === 'string') {
        data = new TextEncoder().encode(data);
      }
      // Concatenate
      const merged = new Uint8Array(inputData.length + data.length);
      merged.set(inputData);
      merged.set(data, inputData.length);
      inputData = merged;
      return this;
    },

    // Note: digest is sync in Node but we may need async.
    // For now provide sync hex/base64 via a simple JS implementation.
    // TODO: evaluate if any sync call sites exist; if not, make this async.
    digest(encoding) {
      // Fallback: simple sync hash (for SHA-256 only)
      // This is a placeholder  -  swap in a proper sync implementation if needed
      console.warn('[shim:crypto] createHash.digest  -  using placeholder');
      const hash = simpleHash(inputData);
      if (encoding === 'hex') return hash;
      if (encoding === 'base64') return btoa(hash);
      return hash;
    },

    // Async alternative for contexts that can await
    async digestAsync(encoding) {
      const hashBuffer = await crypto.subtle.digest(subtleAlg, inputData);
      const hashArray = new Uint8Array(hashBuffer);
      if (encoding === 'hex') {
        return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      if (encoding === 'base64') {
        return btoa(String.fromCharCode(...hashArray));
      }
      return hashArray;
    },
  };
}

// Very basic placeholder hash  -  not cryptographic, just for bootstrapping
function simpleHash(data) {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
