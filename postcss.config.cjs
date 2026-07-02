/**
 * =============================================================================
 * postcss.config.cjs — PostCSS pipeline for the Vite build
 * =============================================================================
 *
 * WHAT THIS DOES:
 * Runs Tailwind (per tailwind.config.cjs) and Autoprefixer over index.css at
 * build time, so all styling is compiled into a first-party stylesheet
 * (dist/assets/*.css) instead of being injected at runtime by the former
 * cdn.tailwindcss.com Play CDN <script>. Vite auto-detects this file.
 *
 * INPUT FILES:  index.css (+ Tailwind scanning the sources in tailwind.config.cjs)
 * OUTPUT FILES: dist/assets/*.css (emitted by `vite build`)
 * =============================================================================
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
