/**
 * =============================================================================
 * tailwind.config.cjs — Tailwind CSS build-time configuration
 * =============================================================================
 *
 * WHAT THIS DOES:
 * Tells Tailwind which source files to scan for class names so the build-time
 * compiler (PostCSS) emits exactly the utilities the app uses. This replaces
 * the runtime cdn.tailwindcss.com Play CDN, removing a third-party-JS
 * supply-chain dependency from the client.
 *
 * PINNED TO TAILWIND v3 ON PURPOSE: the app was developed against the v3 Play
 * CDN (which applies v3 Preflight + v3 defaults). Do NOT upgrade to Tailwind
 * v4 without a full visual re-verification — v4 changes the default reset,
 * color palette, and config format and would silently alter the UI.
 *
 * INPUT  (scanned for class names): index.html + all app .ts/.tsx/.js/.jsx
 *        source (node_modules, dist, and server-only api/ are excluded).
 * OUTPUT: consumed by postcss.config.cjs -> dist/assets/*.css at build time.
 *
 * NO CUSTOM THEME: the previous Play CDN tag carried no inline `tailwind.config`,
 * so the app relies on stock Tailwind defaults. Keep `theme.extend` empty to
 * match that exactly.
 * =============================================================================
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './**/*.{ts,tsx,js,jsx}',
    '!./node_modules/**',
    '!./dist/**',
    '!./api/**',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
