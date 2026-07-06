/**
 * Generate PWA icons (assets/icon-192.png, assets/icon-512.png) by rendering
 * an inline SVG with Playwright. Dev-only tool; run when the icon design changes.
 * Monogram sits inside the central 80% so the same file works as a maskable icon.
 *
 * Usage: NODE_PATH=/path/to/node_modules/with/playwright node tools/make_icons.cjs
 */
const path = require('path');
const { chromium } = require('playwright');

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2b4a2b"/>
  <g opacity="0.5">
    <path d="M0 118 H512 M0 394 H512 M118 0 V512 M394 0 V512" stroke="#b8860b" stroke-width="7" opacity="0.35"/>
    <path d="M0 104 H512 M0 380 H512 M104 0 V512 M380 0 V512" stroke="#ffffff" stroke-width="2.5" opacity="0.18"/>
  </g>
  <text x="256" y="252" font-family="'Playfair Display',Georgia,serif" font-style="italic" font-weight="700"
        font-size="190" fill="#e8c84a" text-anchor="middle" dominant-baseline="middle">F&amp;L</text>
  <text x="256" y="392" font-family="'Source Serif 4',Georgia,serif" font-size="46" letter-spacing="26"
        fill="#e8c84a" opacity="0.75" text-anchor="middle">TRIPS</text>
</svg>`;

const HTML = `<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=Source+Serif+4:wght@400&display=swap" rel="stylesheet">
<style>*{margin:0}</style></head><body>${SVG}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(HTML.replace('<svg ', `<svg width="${size}" height="${size}" `), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(__dirname, '..', 'assets', `icon-${size}.png`);
    await page.screenshot({ path: file });
    console.log('wrote', file);
    await page.close();
  }
  await browser.close();
})();
