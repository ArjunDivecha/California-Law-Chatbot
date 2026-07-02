import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3000', // vercel dev default
            changeOrigin: true,
            // Don't proxy import requests for shared TypeScript modules
            // under api/_shared/ or api/_lib/. Those are source code,
            // not API endpoints — Vite should serve them directly so
            // client code can import services/sanitization/previewSession,
            // which transitively imports api/_shared/sanitization/index.
            bypass(req) {
              const url = req.url ?? '';
              if (url.startsWith('/api/_shared/') || url.startsWith('/api/_lib/')) {
                return url;
              }
              return undefined;
            },
          }
        }
      },
      plugins: [react()],
      define: {
        // API keys are now handled server-side via API endpoints
        // No need to expose them to the client bundle
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
