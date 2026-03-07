// Shim for crypto.scrypt
// Delegates to window.scrypt which is already loaded by Obsidian's own scrypt.js

export function scrypt(password, salt, keylen, options, callback) {
  // Node signature: scrypt(password, salt, keylen, options, callback)
  // Obsidian's app.js checks for window.require("crypto") and uses it if available,
  // otherwise falls back to window.scrypt  -  so this shim just delegates to the latter.

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const N = options?.N || 32768;
  const r = options?.r || 8;
  const p = options?.p || 1;

  if (window.scrypt && window.scrypt.scrypt) {
    // Use the browser scrypt library already loaded by Obsidian
    const pwBytes = typeof password === 'string' ? new TextEncoder().encode(password) : password;
    const saltBytes = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;

    window.scrypt.scrypt(pwBytes, saltBytes, N, r, p, keylen)
      .then((result) => callback(null, new Uint8Array(result)))
      .catch((err) => callback(err));
  } else {
    callback(new Error('scrypt not available'));
  }
}
