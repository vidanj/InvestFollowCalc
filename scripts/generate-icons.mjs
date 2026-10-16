// Renders the PWA icons (PNG) from inline SVG with Playwright's Chromium, so no image tooling
// dependency is needed. Run with `npm run icons` and commit the files in public/icons/.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const TEAL = '#0f766e';
const OUT = 'public/icons';

// Same glyph as public/favicon.svg, on a 512 grid.
const glyph = (scale) => {
  const p = (x, y) => [256 + (x - 256) * scale, 256 + (y - 256) * scale];
  const points = [p(96, 352), p(208, 240), p(288, 304), p(416, 160)];
  const [endX, endY] = points[3];
  return `
    <polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="#fff"
      stroke-width="${48 * scale}" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="${endX}" cy="${endY}" r="${32 * scale}" fill="#fff" />`;
};

/** Rounded tile for browsers and desktops. */
const anyIcon = `<rect width="512" height="512" rx="112" fill="${TEAL}" />${glyph(1)}`;
/** Full-bleed tile; the glyph stays inside the 80% safe zone so masks never crop it. */
const maskableIcon = `<rect width="512" height="512" fill="${TEAL}" />${glyph(0.7)}`;

const targets = [
  { file: 'icon-192.png', size: 192, body: anyIcon },
  { file: 'icon-512.png', size: 512, body: anyIcon },
  { file: 'maskable-512.png', size: 512, body: maskableIcon },
  // iOS rounds the corners itself, so it gets the full-bleed version.
  { file: 'apple-touch-icon-180.png', size: 180, body: maskableIcon },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, body } of targets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${body}</svg>
      </body></html>`,
    );
    await page.screenshot({ path: `${OUT}/${file}`, omitBackground: true });
    console.log(`${OUT}/${file}`);
  }
} finally {
  await browser.close();
}
