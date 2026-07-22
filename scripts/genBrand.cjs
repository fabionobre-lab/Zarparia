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
const TAG = 'Chart your journey.';

// ---- source mark geometry (the shipped app asset) ----
const src = fs.readFileSync('web/src/lib/assets/zarparia-crest.svg', 'utf8');
const paths = [...src.matchAll(/<path[^>]*\bd="([^"]*)"/g)];
const NAVY_D = paths[0][1], GOLD_D = paths[1][1];
// star subpath (tittle source) inside the gold path. NB: this regex targets the
// legacy crest and no longer matches the current shield — it feeds only the
// legacy mark/wordmark/plain-lockup branches (gated by TAGLINE_ONLY below), so
// tolerate a miss rather than crash a tagline-only regeneration.
const STAR_D = (GOLD_D.match(/M662\.5 448\.8[^M]*/) || [''])[0];
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

// Palette. 2026-07-20 (Fabio): re-derived from the family canon
// (AriaNobre/design/aria-nobre-tokens.css). Every value here predated the
// canon and had drifted:
//   tile dark  #2b231b -> #232E42  (--an-shield dark; the warm tile was from
//                                   the pre-navy era. NB: the app-side token
//                                   had already collapsed to #1A2332 in
//                                   16f4f06, which made the dark crest
//                                   invisible against the navy card.)
//   gold       #c1a374 -> #C4A572  (--an-brand-gold; family-unified)
//   word dark  #ece4d4 -> #EDE8DE  (--an-ink dark)
//   tag        #7a6e5f -> #6B6660  (--an-muted light)
//              #a3957f -> #B4A996  (--an-muted dark)
// Keep these in step with the canon; do not hand-edit the generated
// brand/*.svg outputs.
const PAL = {
  light: { tile: '#1A2332', gold: '#C4A572', word: '#1A2332', tag: '#6B6660' },
  dark:  { tile: '#232E42', gold: '#C4A572', word: '#EDE8DE', tag: '#B4A996' },
};

// ── Standard family auth/marketing lockup (crest + wordmark TOP-ALIGNED +
//    tagline) ───────────────────────────────────────────────────────────────
// Shared spec, identical params across Nobria / Saldaria / Zarparia (see
// Nobria src/components/Logo.tsx `lockup` variant). Crest ink height = R×cap;
// crest ink TOP aligned to the wordmark CAP TOP; tagline cap-top sits TAG_GAP
// below the wordmark's LOWEST ink (Zarparia's "p" descender, so its tagline
// sits a touch lower than Nobria/Saldaria). Do NOT change these four params.
const LOCKUP_R = 1.9, LOCKUP_GAP_H = 0.34, LOCKUP_TAG_GAP = 0.32, LOCKUP_TAG_SIZE = 0.4;
// Canonical Zarparia measurements, in the units of the -cc source files.
const CREST_INK_H = 1172.584, CREST_INK_TOP = 1.708;   // zarparia-crest.svg, ink x[0,1000], vB 0 0 1000 1176
const WCAP_TOP = 7.44, WCAP_H = 23.56, WINK_BOTTOM = 38.37, WINK_LEFT = 1.28, WINK_RIGHT = 154.63; // zarparia-wordmark-cc.svg
// Canonical wordmark paths (verbatim): letters + the sparkle/star tittle, which
// is carried in the wordmark group so it holds its relative position.
const wcSrc = fs.readFileSync('web/src/lib/assets/zarparia-wordmark-cc.svg', 'utf8');
const wcPaths = [...wcSrc.matchAll(/<path[^>]*\bd="([^"]*)"/g)];
const WORD_CC_D = wcPaths[0][1], STAR_CC_D = wcPaths[1][1];
const r5 = (v) => Math.round(v * 1e5) / 1e5;           // transform precision (f2 is too coarse for scales)
// Georgia Regular cap-height ratio (cap px / font size), measured from "H".
const REG_CAP_RATIO = -reg.getPath('H', 0, 0, 1000).getBoundingBox().y1 / 1000;

function lockupTag(pal) {
  const size = 100;                                    // crest ink height, output units (arbitrary; CSS scales)
  const c = size / LOCKUP_R;                           // wordmark cap height
  const mScale = size / CREST_INK_H;
  const mTy = -CREST_INK_TOP * mScale;                 // crest ink top -> y=0
  const wScale = c / WCAP_H;
  const wTy = -WCAP_TOP * wScale;                      // wordmark cap top -> y=0 (TOP-ALIGNED)
  const wTx = 1000 * mScale + LOCKUP_GAP_H * c - WINK_LEFT * wScale;
  const tagCap = LOCKUP_TAG_SIZE * c;
  const tagBaseline = (WINK_BOTTOM * wScale - WCAP_TOP * wScale) + LOCKUP_TAG_GAP * c + tagCap;
  const taglineX = wTx + ((WINK_LEFT + WINK_RIGHT) / 2) * wScale;
  const W = wTx + WINK_RIGHT * wScale;
  const H = Math.max(size, tagBaseline + tagCap * 0.28);
  // Tagline: Georgia Regular outlines, cap height = tagCap, baseline @ tagBaseline,
  // centred (by advance) under the wordmark ink — same glyphs as the wordmark's tag.
  const tagFont = tagCap / REG_CAP_RATIO;
  const TAG_D = path(reg, TAG, taglineX - adv(reg, TAG, tagFont) / 2, tagBaseline, tagFont);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(W)} ${f2(H)}" role="img" aria-label="Zarparia — ${TAG}">\n` +
    `  <g transform="translate(0 ${r5(mTy)}) scale(${r5(mScale)})">` +
      `<path d="${NAVY_D}" fill="${pal.tile}" fill-rule="evenodd"/>` +
      `<path d="${GOLD_D}" fill="${pal.gold}" fill-rule="evenodd"/></g>\n` +
    `  <g transform="translate(${r5(wTx)} ${r5(wTy)}) scale(${r5(wScale)})">` +
      `<path d="${WORD_CC_D}" fill="${pal.word}"/>` +
      `<path d="${STAR_CC_D}" fill="${pal.gold}"/></g>\n` +
    `  <path d="${TAG_D}" fill="${pal.tag}"/>\n` +
    `</svg>\n`;
}

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
  const label = withTag ? `Zarparia — ${TAG}` : 'Zarparia';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 6 ${W_LOCK} 90" role="img" aria-label="${label}">\n`;
  s += '  ' + shield(16, 10, 81, pal.tile, pal.gold) + '\n';
  s += `  <path d="${WM_L}" fill="${pal.word}"/>\n`;
  s += '  ' + tittle(iCentre(bold, 66, 102), 56 - 0.65 * 66, 16, pal.gold) + '\n';
  if (withTag) s += `  <path d="${TAG_P}" fill="${pal.tag}"/>\n`;
  return s + '</svg>\n';
}

const OUT = 'brand/';
fs.mkdirSync(OUT, { recursive: true });

// The tagline lockup (the standard auth/marketing lockup, imported by the
// login) is the generator of record here. The mark / wordmark / plain-lockup
// branches below still use the legacy baseline layout (SHIELD_VB, opentype
// wordmark) and are gated so a `TAGLINE_ONLY=1` run touches only the tagline
// outputs — see the login lockup fix, 2026-07-21.
const TAGLINE_ONLY = process.env.TAGLINE_ONLY === '1';

if (!TAGLINE_ONLY) {
  fs.writeFileSync(OUT + 'zarparia-mark.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="178 243 653 762" role="img" aria-label="Zarparia">\n` +
    `  <path d="${NAVY_D}" fill="${PAL.light.tile}" fill-rule="evenodd"/>\n` +
    `  <path d="${GOLD_D}" fill="${PAL.light.gold}" fill-rule="evenodd"/>\n</svg>\n`);

  const W_WM = f2(advS + 4);
  fs.writeFileSync(OUT + 'zarparia-wordmark.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W_WM} 70" role="img" aria-label="Zarparia">\n` +
    `  <path d="${WM_S}" fill="${PAL.light.word}"/>\n` +
    '  ' + tittle(iCentre(bold, 48, 0), 52 - 0.65 * 48, f2(16 * 48 / 66), PAL.light.gold) + '\n</svg>\n');
}

for (const mode of ['light', 'dark']) {
  if (!TAGLINE_ONLY) fs.writeFileSync(OUT + `zarparia-lockup-${mode}.svg`, lockup(PAL[mode], false));
  fs.writeFileSync(OUT + `zarparia-lockup-tagline-${mode}.svg`, lockupTag(PAL[mode]));
}
console.log('brand/ assets written:', fs.readdirSync(OUT).join(', '));
