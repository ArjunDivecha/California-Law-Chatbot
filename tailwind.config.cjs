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
 * THEME: DancingElephant design tokens (2026-08 rebrand). Source of truth is
 * docs/design-handoff/README.md — keep the two in sync. Token groups:
 *   brand  — violet primary        ink    — text scale
 *   deteal — verified/success      deamber — caution/privileged
 *   dered  — error/contradicted    surface — backgrounds & hairlines
 *   plum   — dark sign-in panel / logo lockup ONLY (never app canvas)
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
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7C5CFC',
          deep: '#6847E8',
          tint: '#F3F0FE',
          line: '#E2DAFB',
          hover: '#C9BFF5',
          spin: '#D7CDF9',
          num: '#EDE8FC', // inline citation-number chip bg
        },
        ink: {
          DEFAULT: '#2A2233',
          secondary: '#4A4258',
          muted: '#6E6580',
          faint: '#9C94A8',
        },
        deteal: {
          DEFAULT: '#2DD4BF',
          icon: '#14B8A6',
          icon2: '#0E9384',
          text: '#0E7C6E',
          deep: '#0E5C52',
          bg: '#E9FBF7',
          bg2: '#F4FDFB',
          line: '#BFEEE4',
        },
        deamber: {
          DEFAULT: '#E8A05C',
          icon: '#D97706',
          text: '#9A6420',
          bg: '#FDF6EC',
          bg2: '#FDFAF4',
          hl: '#FBEBD3', // inline PII highlight
          line: '#F2DCBC',
          lock: '#B97F35', // protected-discovery active segment
        },
        dered: {
          DEFAULT: '#B3261E',
          text: '#8C1D18',
          bg: '#FDEDEC',
          bg2: '#FEF7F6',
          line: '#F4C7C3',
        },
        surface: {
          app: '#FCFBF9',
          line: '#EAE6F0',
          line2: '#EEEAF3',
          line3: '#E3DEED',
          ctl: '#DDD8E5', // secondary-button / input borders
          pill: '#F6F4FB', // neutral tool-pill bg
          pillline: '#E9E5F2',
          disabled: '#EDEBF2',
        },
        plum: {
          DEFAULT: '#221A30',
          text: '#F5F2FA',
          muted: '#B4A9C6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        doc: ['Georgia', 'Times New Roman', 'serif'], // rendered legal documents only
      },
      backgroundImage: {
        'de-gradient': 'linear-gradient(90deg, #7C5CFC, #2DD4BF, #E8A05C)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(42,34,51,.06)',
        modal: '0 20px 60px rgba(34,26,48,.35)',
      },
      keyframes: {
        deSpin: { to: { transform: 'rotate(360deg)' } },
        deShimmer: {
          from: { backgroundPosition: '0% 0' },
          to: { backgroundPosition: '-300% 0' },
        },
      },
      animation: {
        'de-spin': 'deSpin .8s linear infinite',
        'de-shimmer': 'deShimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
