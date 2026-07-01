/**
 * =============================================================================
 * vite.config.ts  (browser-gliner prototype)
 * =============================================================================
 * Standalone Vite config for the isolated prototype. Root is this folder.
 * `server.fs.allow` is widened to the repo root so the harness can import,
 * READ-ONLY:
 *   - ../../tests/traps/manifest-v1.json
 *   - ../../api/_shared/sanitization/{patterns,allowlist,compoundRisk}.ts
 * It writes nothing to production paths. Deleting this folder fully reverts.
 *
 * INPUT FILES:  none at config time.
 * OUTPUT FILES: dist/ (only if `npm run build` is used; dev server is in-memory).
 * =============================================================================
 */
import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

export default defineConfig({
  root: here,
  server: {
    port: 5199,
    fs: { allow: [repoRoot] },
  },
  // onnxruntime-web ships large prebuilt wasm/mjs; don't let Vite try to
  // pre-bundle/transform them.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
