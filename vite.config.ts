import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Served from GitHub Pages at https://<user>.github.io/InvestFollowCalc/
const BASE_PATH = '/InvestFollowCalc/';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
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
