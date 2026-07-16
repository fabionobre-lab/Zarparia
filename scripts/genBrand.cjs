/*
 * Regenerate the Zarparia brand asset set in brand/ — mark, wordmark,
 * lockup (light/dark), lockup + tagline (light/dark) — with the Georgia
 * wordmark/tagline baked as outline paths so the files render identically
 * on systems without Georgia installed.
 *
 * Layout — shield at left (height 81 units, y 10..91), wordmark Georgia
 * Bold 66 at x=102 baseline 56 with the four-point star as the dotless-i
 * tittle, tagline Georgia Regular 30 centred under the wordmark span at
 * baseline 88 (cleared below the wordmark's p-descender).
 *
 * Build-time tool, not shipped. Usage (Windows, Georgia in C:\Windows\Fonts):
 *   npm i -D opentype.js   # one-off, or npx
 *   node scripts/genBrand.cjs
 */
const opentype = require('opentype.js');
const fs = require('fs');

const bold = opentype.parse(fs.readFileSync('C:/Windows/Fonts/georgiab.ttf').buffer);
const reg = opentype.parse(fs.readFileSync('C:/Windows/Fonts/georgia.ttf').buffer);

const WORD = 'Zarparıa'; // dotless i; the star is its tittle
const TAG = 'Chart your journey';

// ---- source mark geometry (the shipped app asset) ----
const src = fs.readFileSync('web/src/lib/assets/zarparia-crest.svg', 'utf8');
const paths = [...src.matchAll(/<path[^>]*\bd="([^"]*)"/g)];
const NAVY_D = paths[0][1], GOLD_D = paths[1][1];
// star subpath (tittle source) inside the gold path
const STAR_D = GOLD_D.match(/M662\.5 448\.8[^M]*/)[0];
const SHIELD_VB = { x: 178, y: 243, w: 653, h: 762 };
const STAR_C = { cx: 662.3, cy: 506.95, w: 115.52 }; // star bbox centre + width

function path(font, text, x, y, size) {
  return font.getPath(text, x, y, size, { kerning: true }).toPathData(2);
}
function adv(font, text, size) {
  return font.getAdvanceWidth(text, size, { kerning: true });
}
// centre of the dotless-i glyph within WORD, from the kerned glyph run
function iCentre(font, size, x0) {
  let cx = x0;
  font.forEachGlyph(WORD, x0, 0, size, { kerning: true }, (glyph, gx) => {
    if (glyph.unicode === 0x131) {
      cx = gx + (glyph.advanceWidth / font.unitsPerEm) * size / 2;
    }
  });
  return cx;
}
const f2 = (v) => Math.round(v * 100) / 100;

// star tittle <g>: centred at (cx, cy), scaled to width wpx
function tittle(cx, cy, wpx, gold) {
  const s = wpx / STAR_C.w;
  const tx = cx - STAR_C.cx * s, ty = cy - STAR_C.cy * s;
  return `<g transform="translate(${f2(tx)} ${f2(ty)}) scale(${f2(s)})"><path d="${STAR_D}" fill="${gold}"/></g>`;
}
// shield <g>: scaled to height hpx with top-left at (x, y)
function shield(x, y, hpx, tile, gold) {
  const s = hpx / SHIELD_VB.h;
  const tx = x - SHIELD_VB.x * s, ty = y - SHIELD_VB.y * s;
  return `<g transform="translate(${f2(tx)} ${f2(ty)}) scale(${f2(s)})">` +
    `<path d="${NAVY_D}" fill="${tile}" fill-rule="evenodd"/>` +
    `<path d="${GOLD_D}" fill="${gold}" fill-rule="evenodd"/></g>`;
}

const PAL = {
  light: { tile: '#1a2332', gold: '#c1a374', word: '#1a2332', tag: '#7a6e5f' },
  dark:  { tile: '#2b231b', gold: '#c1a374', word: '#ece4d4', tag: '#a3957f' },
};

// ---- geometry ----
const advL = adv(bold, WORD, 66);          // lockup wordmark advance
const advS = adv(bold, WORD, 48);          // standalone wordmark advance
const advT = adv(reg, TAG, 30);            // tagline advance
const W_LOCK = f2(102 + advL + 8 - 12);    // viewBox width from x=12
const wordCx = 102 + advL / 2;             // centre of wordmark span

const WM_L = path(bold, WORD, 102, 56, 66);
const WM_S = path(bold, WORD, 0, 52, 48);
// baseline 88 (not the reference 84): the wordmark's "p" descender reaches
// y=70.5 and would graze the tagline's x-height tops at 84 — "Zarparıa" has
// descenders where the reference wordmark had none.
const TAG_P = path(reg, TAG, wordCx - advT / 2, 88, 30);

function lockup(pal, withTag) {
  const label = withTag ? 'Zarparia — Chart your journey' : 'Zarparia';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 6 ${W_LOCK} 90" role="img" aria-label="${label}">\n`;
  s += '  ' + shield(16, 10, 81, pal.tile, pal.gold) + '\n';
  s += `  <path d="${WM_L}" fill="${pal.word}"/>\n`;
  s += '  ' + tittle(iCentre(bold, 66, 102), 56 - 0.65 * 66, 16, pal.gold) + '\n';
  if (withTag) s += `  <path d="${TAG_P}" fill="${pal.tag}"/>\n`;
  return s + '</svg>\n';
}

const OUT = 'brand/';
fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(OUT + 'zarparia-mark.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="178 243 653 762" role="img" aria-label="Zarparia">\n` +
  `  <path d="${NAVY_D}" fill="#1a2332" fill-rule="evenodd"/>\n` +
  `  <path d="${GOLD_D}" fill="#c1a374" fill-rule="evenodd"/>\n</svg>\n`);

const W_WM = f2(advS + 4);
fs.writeFileSync(OUT + 'zarparia-wordmark.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W_WM} 70" role="img" aria-label="Zarparia">\n` +
  `  <path d="${WM_S}" fill="#1a2332"/>\n` +
  '  ' + tittle(iCentre(bold, 48, 0), 52 - 0.65 * 48, f2(16 * 48 / 66), '#c1a374') + '\n</svg>\n');

for (const mode of ['light', 'dark']) {
  fs.writeFileSync(OUT + `zarparia-lockup-${mode}.svg`, lockup(PAL[mode], false));
  fs.writeFileSync(OUT + `zarparia-lockup-tagline-${mode}.svg`, lockup(PAL[mode], true));
}
console.log('brand/ assets written:', fs.readdirSync(OUT).join(', '));
