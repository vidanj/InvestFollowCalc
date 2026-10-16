import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Served from GitHub Pages at https://<user>.github.io/InvestFollowCalc/
const BASE_PATH = '/InvestFollowCalc/';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

/**
 * Nothing may leave the device: everything is same-origin, no inline scripts, no third parties.
 * GitHub Pages cannot send headers, so the policy ships as a <meta> tag (frame-ancestors and
 * report-uri are not available that way).
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** CSP only in production builds: the dev server needs inline scripts for hot reload. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'investfollowcalc:csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
      ),
  };
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    VitePWA({
      // A new version waits until the user accepts it (see UpdatePrompt).
      registerType: 'prompt',
      // Registered from React with useRegisterSW; no inline registration script (CSP).
      injectRegister: false,
      manifest: {
        id: BASE_PATH,
        name: 'InvestFollowCalc',
        short_name: 'InvestFollow',
        description:
          'Sigue cuánto generan tus inversiones, separado de lo que aportas. Tus datos se quedan en tu dispositivo.',
        lang: 'es-MX',
        dir: 'ltr',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#0f766e',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole app (including the lazily loaded charts) so it works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwaRegisterStub.ts', import.meta.url),
      ),
    },
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**', 'src/test/**', 'src/main.tsx'],
      thresholds: {
        'src/domain/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
