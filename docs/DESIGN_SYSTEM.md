# Trips Design System

The token architecture, dark-mode strategy, and derivation rules for the Trips
apps (SvelteKit web app + static PWA). The architecture is deliberately
portable: the *skin* (typeface + accent hues) is the only app-specific layer,
so the same skeleton can carry other apps with a different voice.

## Philosophy

- **Warm editorial.** The light palette is cream paper and near-black ink, not
  white and grey. Serifs (Playfair Display for display, Source Serif 4 for body)
  carry an editorial voice; the chrome uses system-ui.
- **Candlelit paper, never gray.** Dark mode is a warm, low-luminance version of
  the same paper — browns and warm off-whites, not neutral slate. Every dark
  surface/text value keeps a warm hue.
- **Motion explains state change.** Transitions are short and purposeful (day
  switches, press states, sticky-nav shadow) and always gated behind
  `prefers-reduced-motion`. Motion is never decorative.
- **Tokens over hex.** Components reference semantic tokens; raw hex only survives
  where a value is genuinely one-off. Legacy `--cream/--ink/--stone/--border`
  remain as aliases of the semantic tokens during the migration tail.

## The mechanism: light / dark / system

Mode is one of `light | dark | system` (default `system`).

- **Explicit** `light`/`dark` → `<html data-theme="light|dark">`. The token
  overrides keyed on `:root[data-theme="dark"]` win.
- **System** → no attribute; `@media (prefers-color-scheme: dark)
  :root:not([data-theme])` supplies the dark tokens, so `data-theme="light"`
  still forces light even under an OS dark preference.

Persistence + zero-flash, three layers:

1. **Cookie** `trips-theme` (client-writable, 1-year). Read in `hooks.server.ts`,
   which stamps `data-theme` into the very first HTML byte via
   `transformPageChunk` (`%theme-attr%` in `app.html`). No hydration flash.
2. **localStorage** `trips.theme` + a tiny inline `<script>` in `app.html` that
   reconciles `data-theme` before first paint — belt-and-braces for cached /
   prerendered pages whose cookie may be stale.
3. **Reactive store** (`$lib/theme/store.svelte.ts`) seeded from layout data, so
   the header toggle icon is correct from first render. `setTheme()` writes both
   the cookie and localStorage and reflects the attribute on `<html>`.

`<meta name="theme-color">` ships light (`#faf6ee`) + dark (`#16120d`) variants.
The header toggle cycles **system → dark → light** with a sun/moon/auto glyph and
a localized aria-label/title (`theme.system|dark|light`, en-GB + pt-BR).

## Semantic tokens (as implemented)

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#faf6ee` | `#16120d` |
| `--surface` | `#fffdf7` | `#1f1913` |
| `--surface-sunken` | `#f3eee2` | `#120f0b` |
| `--text` | `#1a1208` | `#ece4d4` |
| `--text-muted` | `#7a6e5f` | `#a3957f` |
| `--hairline` | `rgba(122,110,95,.28)` | `rgba(236,228,212,.12)` |
| `--hairline-strong` | `rgba(122,110,95,.5)` | `rgba(236,228,212,.28)` |
| `--accent` (fills only) | `#2b4a2b` | `#2b4a2b` |
| `--accent-strong` (text-level) | `#2b4a2b` | `#9fbf9f` |

`--accent-strong` on dark `--bg`: **contrast 9.3:1** (≫ 4.5:1 AA). `--accent`
stays the saturated brand green in both modes and is only used behind white text.

### Status pills (shared, outside the trip shell)

| Role | Light bg / fg | Dark bg / fg |
| --- | --- | --- |
| neutral | `#ede8e0` / `#7a6e5f` | `rgba(236,228,212,.08)` / `#a3957f` |
| info (blue) | `#dce8f5` / `#1e3a5f` | `rgba(120,160,210,.20)` / `#bcd4f0` |
| go (green) | `#daf0e5` / `#1a5a34` | `rgba(90,170,120,.20)` / `#a9d9bf` |
| warn (gold) | `#f5edd5` / `#7a5a10` | `rgba(200,170,90,.18)` / `#e0c987` |
| bug (red) | `#fbe3df` / `#8a2b20` | `rgba(200,90,80,.18)` / `#eaa89f` |

Dark chips follow the rule: **translucent fill of the hue + a lighter text of the
same hue** — hue identity preserved, no neon.

### Motion + type

```
--dur-fast: 120ms;  --dur-base: 180ms;  --dur-slow: 240ms;
--ease-out: cubic-bezier(.2,.7,.3,1);
--type-display: clamp(30px, 2.2rem + 1.5vw, 42px);
--type-h1:      clamp(24px, 1.35rem + 1vw, 30px);
--type-body:    clamp(16px, .95rem + .3vw, 18px);
--type-small:   clamp(13px, .8rem + .15vw, 14px);
```

Fluid type is applied conservatively — at ~430px the clamped minimum matches the
previous fixed sizes, growing only on wider chrome. `font-variant-numeric:
tabular-nums` is set on timeline times, day-pill numbers, date ranges, and
counters.

## Trip themes + the OKLCH derivation rule

Each trip theme is **one base colour** (its current hex — the identity) plus a
gold eyebrow. The six bases: tartan `#2b4a2b`, navy `#1e3054`, terracotta
`#7c3a29`, olive `#4a5324`, azure `#17456b`, sand `#5b4a30`.

The trip shell (`TripView.svelte`) sets `--theme-base` + `--theme-eyebrow`; the
hero background and saturated `--accent` derive from the base directly, so **light
mode is visually unchanged**. Text-level accent is derived, not hand-picked:

```css
/* dark: lift the text accent off the (dark) base, same hue + chroma */
--accent-text: oklch(from var(--theme-base) 0.82 calc(c * 0.9) h);
```

In light mode `--accent-text` equals the base (dark text on cream); in dark it
becomes a soft light tint that reads on dark surfaces. The home page emits only
the **base** colour inline (`--card-base`), and the card CSS derives a
mode-appropriate band tint the same way — so inline styles are correct in both
modes without JS knowing the theme.

**Rule for new themes:** add ONE base hex (+ eyebrow). Never hand-author light and
dark variants — derive tints with `oklch(from var(--theme-base) L calc(c*k) h)`.
Hero blocks keep the base in both modes (already dark enough); verify white text
still reads. The Leaflet day map keeps its light tiles — no inversion — wrapped in
a hairline border with `filter: brightness(.85) contrast(1.05)` in dark. Photos
get `filter: brightness(.9)`.

## Voice

Playfair Display + Source Serif 4, the six trip themes above, candlelit-paper
dark. Editorial and warm. To reuse the architecture elsewhere, swap only the
typefaces and accent hues — token names and the mechanism travel as-is.

## Where things live

- `web/src/styles/tokens.css` — all global tokens (imported once in the root
  `+layout.svelte`).
- `web/src/lib/theme/` — `index.ts` (server-safe constants + resolver),
  `store.svelte.ts` (reactive mode), `ThemeToggle.svelte` (header control).
- `web/src/hooks.server.ts` + `app.html` — SSR stamping + inline bootstrap.
- `TripView.svelte` — trip-scoped theme tokens + OKLCH accent-text derivation.
