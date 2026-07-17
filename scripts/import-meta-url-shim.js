/**
 * =============================================================================
 * SCRIPT NAME: scripts/import-meta-url-shim.js
 * =============================================================================
 * DESCRIPTION:
 * esbuild inject-shim for CJS output: replaces `import.meta.url` (which
 * esbuild lowers to `{}` in CommonJS) with a file:// URL derived from the
 * bundle's __filename. Wired via `inject` + `define` in
 * scripts/build-desktop-sidecar.mjs. api/_lib/skills.ts depends on this to
 * resolve the agents/ directory relative to the bundle location.
 * INPUT/OUTPUT FILES: none (build-time shim, compiled into the bundle).
 * =============================================================================
 */
export var import_meta_url = require('node:url').pathToFileURL(__filename).href;
