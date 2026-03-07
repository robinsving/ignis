// Shim for crypto.randomBytes
// Uses Web Crypto API under the hood

export function randomBytes(size) {
  const buf = new Uint8Array(size);
  crypto.getRandomValues(buf);

  // Add Buffer-like convenience methods
  buf.toString = function(encoding) {
    if (encoding === 'hex') {
      return Array.from(this).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (encoding === 'base64') {
      return btoa(String.fromCharCode(...this));
    }
    return new TextDecoder().decode(this);
  };

  return buf;
}
