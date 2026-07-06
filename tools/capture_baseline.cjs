/**
 * Phase 0 baseline screenshot capture (dev-only tool, nothing ships).
 *
 * Captures the single-file index.html in every UI state:
 *   10 days x 2 languages (en/pt) x 2 Edinburgh plans (liana/merged) = 40 shots.
 * These are the pixel-parity reference for the Phase 5 cutover check.
 *
 * Determinism: requests to Open-Meteo (weather) and Wikipedia/Wikimedia
 * (photo-spot thumbnails) are BLOCKED so captures do not depend on the day
 * they are run. Google Fonts requests are allowed so typography matches
 * production. The Phase 5 re-capture of the new engine must use the same
 * blocking rules for the diff to be meaningful.
 *
 * The app shell scrolls internally (.scroll-area), so a plain fullPage
 * screenshot would clip content. The script overrides that CSS to let the
 * page grow, then takes a fullPage shot. Apply the identical override when
 * capturing the new engine.
 *
 * Usage (playwright installed elsewhere, e.g. a scratch dir):
 *   NODE_PATH=/path/to/scratch/node_modules node tools/capture_baseline.cjs [htmlFile] [outDir]
 * Defaults: htmlFile = ../index.html, outDir = ../baseline
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const htmlFile = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'baseline'));

const BLOCKED_HOSTS = ['open-meteo.com', 'wikipedia.org', 'wikimedia.org'];
const DAYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LANGS = ['en', 'pt'];
const PLANS = ['liana', 'merged'];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith('.' + b))) return route.abort();
    return route.continue();
  });

  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      'html,body{height:auto!important;overflow:visible!important}' +
      '.shell{height:auto!important;overflow:visible!important}' +
      '.scroll-area{overflow-y:visible!important;flex:none!important}',
  });

  for (const lang of LANGS) {
    for (const plan of PLANS) {
      for (const day of DAYS) {
        await page.evaluate(
          ([l, p, d]) => {
            setL(l);
            setV(p);
            sd(d);
          },
          [lang, plan, day]
        );
        await page.waitForTimeout(200);
        const file = path.join(outDir, `day${day}-${lang}-${plan}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log('captured', path.basename(file));
      }
    }
  }

  await browser.close();
  console.log(`done: ${DAYS.length * LANGS.length * PLANS.length} screenshots in ${outDir}`);
})();
