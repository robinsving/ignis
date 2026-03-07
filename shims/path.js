// Path shim  -  delegates to path-browserify (bundled via esbuild alias)
// Configured for posix mode since vault paths are normalized to forward slashes.

import pathBrowserify from 'path';

export const pathShim = pathBrowserify;
