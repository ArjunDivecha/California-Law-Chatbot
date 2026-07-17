/**
 * =============================================================================
 * SCRIPT NAME: scripts/build-desktop-sidecar.mjs
 * =============================================================================
 *
 * DESCRIPTION:
 * Builds the fully self-contained sidecar payload for the packaged Tauri
 * .app. Steps:
 *
 *   1. esbuild-bundles desktop-server.mjs (and its whole TS/ESM import
 *      graph — express, agent loop, tools, policy engine) into ONE CommonJS
 *      file. Output goes to src-tauri/desktop-resources/api/_lib/ — two
 *      directory levels deep ON PURPOSE: api/_lib/skills.ts resolves the
 *      agents/ directory as `__dirname/../../agents/california-legal`, and
 *      in a CJS bundle __dirname is the bundle's own directory.
 *   2. better-sqlite3 stays EXTERNAL (its `bindings` loader breaks when
 *      bundled) — the package plus its runtime deps (bindings,
 *      file-uri-to-path) and prebuilt .node addon are copied into a real
 *      node_modules/ next to the bundle so require() resolves normally.
 *   3. Copies agents/ (skills + agent.json) and dist/ (built front end)
 *      into desktop-resources/.
 *   4. Copies the current Node runtime binary to
 *      src-tauri/binaries/node-<target-triple> (Tauri externalBin), which
 *      the bundle ships as Contents/MacOS/node.
 *
 * INPUT FILES (relative to repo root):
 * - desktop-server.mjs, desktop-env.mjs, api/**, services/**, agents/**
 * - dist/            (run `yarn build` first — enforced)
 * - node_modules/better-sqlite3, node_modules/bindings,
 *   node_modules/file-uri-to-path
 * - process.execPath (the running Node binary)
 *
 * OUTPUT FILES (relative to repo root):
 * - src-tauri/desktop-resources/api/_lib/desktop-server.cjs
 * - src-tauri/desktop-resources/api/_lib/node_modules/**
 * - src-tauri/desktop-resources/agents/**
 * - src-tauri/desktop-resources/dist/**
 * - src-tauri/binaries/node-aarch64-apple-darwin (or host triple)
 *
 * USAGE: node scripts/build-desktop-sidecar.mjs   (wired as `yarn desktop:bundle`)
 * =============================================================================
 */

import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, copyFileSync, chmodSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd();
const RES = join(ROOT, 'src-tauri', 'desktop-resources');
const BUNDLE_DIR = join(RES, 'api', '_lib');

if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.error('❌ dist/index.html missing — run `yarn build` first.');
  process.exit(1);
}

rmSync(RES, { recursive: true, force: true });
mkdirSync(BUNDLE_DIR, { recursive: true });

// 1. Bundle the server (TS + ESM → single CJS).
await build({
  entryPoints: [join(ROOT, 'desktop-server.mjs')],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outfile: join(BUNDLE_DIR, 'desktop-server.cjs'),
  // better-sqlite3: bindings-based native addon, shipped as real node_modules.
  // gliner/onnxruntime: browser-side ML NER reached only via a dynamic
  // import in services/sanitization/glinerWebClient.ts — never called on the
  // server (the server PII backstop is the deterministic regex pipeline).
  // Left external so a hypothetical server-side call fails loudly.
  external: ['better-sqlite3', 'gliner', 'onnxruntime-web', 'onnxruntime-web/webgl', 'onnxruntime-node', 'onnxruntime-common'],
  sourcemap: false,
  logLevel: 'warning',
  // CJS output lowers import.meta to {} — api/_lib/skills.ts needs
  // import.meta.url to locate agents/. Shim it to the bundle's own path.
  inject: [join(ROOT, 'scripts', 'import-meta-url-shim.js')],
  define: { 'import.meta.url': 'import_meta_url' },
});

// 2. Ship better-sqlite3 (+ its runtime deps) as a real node_modules.
const NM = join(BUNDLE_DIR, 'node_modules');
for (const pkg of ['better-sqlite3', 'bindings', 'file-uri-to-path']) {
  cpSync(join(ROOT, 'node_modules', pkg), join(NM, pkg), {
    recursive: true,
    dereference: true,
  });
}
// Trim the fat: the compiled addon is all we need from build/.
rmSync(join(NM, 'better-sqlite3', 'build', 'Release', 'obj'), { recursive: true, force: true });
rmSync(join(NM, 'better-sqlite3', 'deps'), { recursive: true, force: true });

// Sign the native addon with Developer ID + secure timestamp. Tauri signs
// the app and externalBins but NOT files under bundle.resources, and Apple
// notarization rejects any unsigned Mach-O in the bundle (verified: the
// 2026-07-17 submission failed on exactly this file). Signing here means
// the addon enters the bundle already signed and survives re-bundling.
const SIGN_ID =
  process.env.DESKTOP_SIGN_IDENTITY ||
  'Developer ID Application: Arjun Divecha (P8U4R52G69)';
const addon = join(NM, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
try {
  execSync(
    `codesign --force --timestamp --options runtime --sign "${SIGN_ID}" "${addon}"`,
    { stdio: 'inherit' },
  );
} catch (e) {
  console.error(
    `❌ codesign of ${addon} failed — a notarized build is impossible without it. ` +
      'Set DESKTOP_SIGN_IDENTITY or install the Developer ID certificate.',
  );
  process.exit(1);
}

// 3. App resources: agent skills + built front end.
cpSync(join(ROOT, 'agents'), join(RES, 'agents'), { recursive: true });
cpSync(join(ROOT, 'dist'), join(RES, 'dist'), { recursive: true });

// 4. Node runtime as a Tauri externalBin (target-triple suffix required).
const triple = execSync('rustc --print host-tuple || rustc -vV | sed -n "s/host: //p"', {
  shell: '/bin/zsh',
})
  .toString()
  .trim()
  .split('\n')[0];
const BIN_DIR = join(ROOT, 'src-tauri', 'binaries');
mkdirSync(BIN_DIR, { recursive: true });
const nodeDest = join(BIN_DIR, `node-${triple}`);
copyFileSync(process.execPath, nodeDest);
chmodSync(nodeDest, 0o755);

console.log('✅ sidecar payload ready:');
console.log('   bundle:   src-tauri/desktop-resources/api/_lib/desktop-server.cjs');
console.log('   agents:   src-tauri/desktop-resources/agents/');
console.log('   dist:     src-tauri/desktop-resources/dist/');
console.log(`   node bin: src-tauri/binaries/node-${triple}`);
