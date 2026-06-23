const path = require("path");

/**
 * Encode a filename for use in Content-Disposition header.
 * Handles non-ASCII characters and special characters to prevent header injection.
 * Uses RFC 5987 encoding for filename* parameter when needed.
 */
function encodeContentDispositionFilename(filename) {
  // The \x00-\x7F range bounds the ASCII set; matching its control-character low end is intentional.
  // eslint-disable-next-line no-control-regex
  const hasNonASCII = /[^\x00-\x7F]/.test(filename);

  // Escape quotes and backslashes in ASCII filename
  const escapedFilename = filename.replace(/["\\]/g, function (match) {
    if (match === '"') return '\\"';
    if (match === "\\") return "\\\\";
    return match;
  });

  // Remove any control characters that could cause header injection
  // eslint-disable-next-line no-control-regex
  const sanitizedFilename = escapedFilename.replace(/[\x00-\x1F\x7F]/g, "");

  if (!hasNonASCII) {
    // Simple ASCII filename - use standard format
    return `attachment; filename="${sanitizedFilename}"`;
  }

  // Non-ASCII filename - use RFC 5987 encoding
  // Encode using percent-encoding for UTF-8
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()]/g, function (c) {
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    })
    .replace(/\*/g, "%2A");

  // Provide both filename (ASCII fallback) and filename* (UTF-8 encoded)
  // For fallback, replace non-ASCII with underscores
  const asciiFallback = filename
    // Control-character code points are intentional here; this regex bounds the ASCII set.
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, "_")
    .replace(/["\\]/g, function (match) {
      if (match === '"') return '\\"';
      if (match === "\\") return "\\\\";
      return match;
    });

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

// Resolve a client-provided path to an absolute path within a vault.
// Strips leading slashes so paths from the client are always treated as relative to the vault root.
// Rejects nullish input so missing-field bugs in callers don't silently target the vault root.
function resolveVaultPath(vaultRoot, relativePath) {
  if (relativePath === null || relativePath === undefined) {
    return null;
  }

  const cleaned = relativePath.replace(/^\/+/, "");
  const resolved = path.resolve(vaultRoot, cleaned);

  const resolvedRoot = path.resolve(vaultRoot);

  if (
    resolved !== resolvedRoot &&
    !resolved.startsWith(resolvedRoot + path.sep)
  ) {
    return null;
  }
  return resolved;
}

module.exports = { encodeContentDispositionFilename, resolveVaultPath };
