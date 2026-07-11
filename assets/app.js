/* Generic trip engine: renders any trip JSON conforming to schema/trip.schema.json.
   No trip-specific data here — everything user-visible comes from the trip file
   or the UI_STRINGS table below. Load as app.html?trip=<id>. */
'use strict';

/* ── Engine UI strings (per language, fallback en) ──────────────────── */
const UI_STRINGS = {
  en: {
    maps: 'Open in Maps',
    dayRoute: 'Day Route',
    openRoute: 'Open route in Google Maps →',
    loading: 'Loading trip…',
    loadError: 'Could not load trip data.',
    noTrip: 'No trip specified. Open as app.html?trip=&lt;id&gt;.',
    backAria: 'All trips',
    backToTrips: '← All trips',
    freeDay: 'Free day',
    days: 'Days',
    addToCalendar: 'Add to calendar',
    dayMap: 'Day map',
    dayMapAria: 'Day map, {n} stops',
    themeAuto: 'Theme: automatic (tap for dark)',
    themeDark: 'Theme: dark (tap for light)',
    themeLight: 'Theme: light (tap for automatic)',
  },
  pt: {
    maps: 'Abrir no Maps',
    dayRoute: 'Rota do Dia',
    openRoute: 'Abrir rota no Google Maps →',
    loading: 'Carregando viagem…',
    loadError: 'Não foi possível carregar os dados da viagem.',
    noTrip: 'Nenhuma viagem especificada. Abra como app.html?trip=&lt;id&gt;.',
    backAria: 'Todas as viagens',
    backToTrips: '← Todas as viagens',
    freeDay: 'Dia livre',
    days: 'Dias',
    addToCalendar: 'Adicionar ao calendário',
    dayMap: 'Mapa do dia',
    dayMapAria: 'Mapa do dia, {n} paradas',
    themeAuto: 'Tema: automático (toque para escuro)',
    themeDark: 'Tema: escuro (toque para claro)',
    themeLight: 'Tema: claro (toque para automático)',
  },
};

/* Text equivalents for weather emoji (accessibility only; visuals unchanged). */
const WX_TEXT = {
  en: { '☀️': 'clear sky', '🌤️': 'partly cloudy', '☁️': 'cloudy', '🌫️': 'fog', '🌦️': 'rain showers', '🌧️': 'rain', '❄️': 'snow', '⛈️': 'thunderstorm' },
  pt: { '☀️': 'céu limpo', '🌤️': 'parcialmente nublado', '☁️': 'nublado', '🌫️': 'névoa', '🌦️': 'pancadas de chuva', '🌧️': 'chuva', '❄️': 'neve', '⛈️': 'tempestade' },
};
function wxText(emoji) {
  return (WX_TEXT[lang] || WX_TEXT.en)[emoji] || '';
}

/* ── State ──────────────────────────────────────────────────────────── */
let trip = null;
let lang = 'en';
let dayIdx = 0;                // global index across all segments
let planBySeg = {};            // segment id -> selected plan id
let flatDays = [];             // [{seg, segIdx, dayInSeg}] for the selected plans
let isPast = false;            // trip already happened -> no live weather
const wxBySeg = {};            // segment id -> {hourly:{'date-HH':{temp,code}}, daily:{date:{hi,lo,emoji}}}
const wikiImgs = {};           // wiki title (or 'img:'+name) -> thumbnail url or null
const wikiPending = {};

const $ = (id) => document.getElementById(id);
const ui = (key) => (UI_STRINGS[lang] || UI_STRINGS.en)[key];
const loc = (obj) => (obj ? (obj[lang] !== undefined ? obj[lang] : obj[trip.defaultLanguage]) : '');

/* ── Date labels (derived from ISO date; nothing stored in the data) ── */
function locale() {
  return (trip.locales && trip.locales[lang]) || lang;
}
function dateObj(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/* Local (not UTC) YYYY-MM-DD, so "today" flips at local midnight (e.g. BST). */
function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* "Friday, 10 April" / "Sexta-feira, 10 de abril": weekday + ', ' + rest */
function dayLabel(iso) {
  const parts = new Intl.DateTimeFormat(locale(), {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).formatToParts(dateObj(iso));
  const wd = parts.findIndex((p) => p.type === 'weekday');
  if (wd === -1) return cap(parts.map((p) => p.value).join(''));
  let rest = parts.slice(wd + 1);
  if (rest.length && rest[0].type === 'literal') rest = rest.slice(1);
  return cap(parts[wd].value) + ', ' + rest.map((p) => p.value).join('');
}
function dowShort(iso) {
  const wd = new Intl.DateTimeFormat(locale(), { weekday: 'long', timeZone: 'UTC' }).format(dateObj(iso));
  return cap(wd.slice(0, 3));
}
function dayNum(iso) {
  return String(Number(iso.slice(8, 10)));
}
/* "Friday 10 April" (no comma) — used for aria-label, not visible text. */
function dayAriaLabel(iso) {
  const s = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dateObj(iso));
  return cap(s);
}
function addDaysIso(iso, n) {
  const d = dateObj(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/* Escape for interpolation into HTML text/attribute contexts. */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Selection helpers ──────────────────────────────────────────────── */
function planOf(seg) {
  return seg.plans.find((p) => p.id === planBySeg[seg.id]) || seg.plans[0];
}
function rebuildFlatDays() {
  flatDays = [];
  trip.segments.forEach((seg, segIdx) => {
    planOf(seg).days.forEach((day, dayInSeg) => flatDays.push({ seg, segIdx, dayInSeg }));
  });
}
function current() {
  const f = flatDays[dayIdx];
  return { seg: f.seg, plan: planOf(f.seg), day: planOf(f.seg).days[f.dayInSeg] };
}
function dateOf(f) {
  return planOf(f.seg).days[f.dayInSeg].date;
}
/* Trip status from the currently selected plans' actual date range. */
function tripStatusFromRange() {
  if (!flatDays.length) return 'upcoming';
  const today = todayLocal();
  const start = dateOf(flatDays[0]);
  const end = dateOf(flatDays[flatDays.length - 1]);
  if (end < today) return 'past';
  if (start <= today && today <= end) return 'active';
  return 'upcoming';
}
/* Index of today's day if planned, else the next planned day after today. */
function todayFocusIndex() {
  const today = todayLocal();
  let idx = flatDays.findIndex((f) => dateOf(f) === today);
  if (idx !== -1) return idx;
  idx = flatDays.findIndex((f) => dateOf(f) > today);
  if (idx !== -1) return idx;
  return flatDays.length - 1;
}
/* Every calendar date from the trip's first to last day, planned or not.
   Planned dates carry their flatDays index (gi); gaps carry null. */
function calendarDays() {
  if (!flatDays.length) return [];
  const end = dateOf(flatDays[flatDays.length - 1]);
  const out = [];
  let iso = dateOf(flatDays[0]);
  let gi = 0;
  while (iso <= end) {
    if (gi < flatDays.length && dateOf(flatDays[gi]) === iso) {
      out.push({ iso, gi, segIdx: flatDays[gi].segIdx });
      gi++;
    } else {
      out.push({ iso, gi: null, segIdx: null });
    }
    iso = addDaysIso(iso, 1);
  }
  return out;
}

/* ── Per-trip state persistence (localStorage; best-effort) ─────────── */
function stateKey() {
  return 'trip-state:' + trip.id;
}
function loadState() {
  try {
    const raw = localStorage.getItem(stateKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null; // private mode / storage disabled
  }
}
function saveState() {
  try {
    localStorage.setItem(stateKey(), JSON.stringify({ lang, dayIndex: dayIdx, planBySeg }));
  } catch (e) { /* private mode / storage full: ignore */ }
}

/* ── Weather ────────────────────────────────────────────────────────── */
function wxEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}
function tripIsPast() {
  let last = '';
  trip.segments.forEach((s) => s.plans.forEach((p) => p.days.forEach((d) => { if (d.date > last) last = d.date; })));
  return last < todayLocal();
}
async function fetchWeather() {
  if (isPast) return; // archive trip: staticWeather only
  for (const seg of trip.segments) {
    const w = seg.weather;
    if (!w) continue;
    const days = planOf(seg).days;
    const start = days[0].date, end = days[days.length - 1].date;
    const tz = encodeURIComponent(w.timezone || 'UTC');
    try {
      if (w.granularity === 'hourly') {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&hourly=temperature_2m,weathercode&timezone=${tz}&start_date=${start}&end_date=${end}`);
        const d = await r.json();
        const hourly = {};
        d.hourly.time.forEach((t, i) => {
          hourly[t.slice(0, 10) + '-' + t.slice(11, 13)] = { temp: d.hourly.temperature_2m[i], code: d.hourly.weathercode[i] };
        });
        wxBySeg[seg.id] = { hourly };
      } else {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=${tz}&start_date=${start}&end_date=${end}`);
        const d = await r.json();
        const daily = {};
        d.daily.time.forEach((t, i) => {
          daily[t] = { hi: Math.round(d.daily.temperature_2m_max[i]), lo: Math.round(d.daily.temperature_2m_min[i]), emoji: wxEmoji(d.daily.weathercode[i]) };
        });
        wxBySeg[seg.id] = { daily };
      }
      renderDay();
    } catch (e) { /* offline or out of forecast range: staticWeather fallback applies */ }
  }
}
function dailyWx(seg, day) {
  const live = wxBySeg[seg.id] && wxBySeg[seg.id].daily && wxBySeg[seg.id].daily[day.date];
  return live || day.staticWeather || null;
}
/* Per-block badge: hourly at the block's hour, else the day's daily/static value.
   Past trips never have live data (fetchWeather skips them), so the fallback
   value below is always identical to the day-header summary — suppress it
   there instead of showing the same reading on every block. */
function wxBadge(seg, day, timeStr) {
  const w = wxBySeg[seg.id];
  if (w && w.hourly) {
    const clean = timeStr.replace(/[^0-9:]/g, '');
    const p = clean.split(':');
    if (!p[0]) return '';
    let h = parseInt(p[0], 10);
    const m = p[1] ? parseInt(p[1], 10) : 0;
    if (m >= 30) h = Math.min(h + 1, 23);
    const hw = w.hourly[day.date + '-' + String(h).padStart(2, '0')];
    if (!hw) return '';
    const emoji = wxEmoji(hw.code), temp = Math.round(hw.temp);
    return `<div class="wx" aria-label="${temp}°C, ${wxText(emoji)}"><span aria-hidden="true">${emoji}</span> ${temp}°C</div>`;
  }
  if (isPast) return '';
  const dw = dailyWx(seg, day);
  if (!dw) return '';
  const temp = Math.round(dw.hi);
  return `<div class="wx" aria-label="${temp}°C, ${wxText(dw.emoji)}"><span aria-hidden="true">${dw.emoji || ''}</span> ${temp}°C</div>`;
}
function wxDaySummary(seg, day, km) {
  const kmItem = km ? `<div class="wx-hdr-item wx-km">🦶 ~${km.toFixed(1)} km</div>` : '';
  const wrap = (inner) => `<div class="wx-hdr">${inner}</div>`;
  const w = wxBySeg[seg.id];
  if (w && w.hourly) {
    const temps = [], codes = [];
    for (let h = 7; h <= 22; h++) {
      const hw = w.hourly[day.date + '-' + String(h).padStart(2, '0')];
      if (hw) { temps.push(hw.temp); codes.push(hw.code); }
    }
    if (temps.length) {
      const hi = Math.round(Math.max(...temps)), lo = Math.round(Math.min(...temps));
      const freq = {};
      codes.forEach((c) => { freq[c] = (freq[c] || 0) + 1; });
      const dom = Object.keys(freq).reduce((a, b) => (freq[a] > freq[b] ? a : b));
      const emoji = wxEmoji(parseInt(dom, 10));
      return wrap(`<div class="wx-hdr-item" aria-label="${wxText(emoji)}"><span aria-hidden="true">${emoji}</span></div><div class="wx-hdr-item">↑${hi}°C</div><div class="wx-hdr-item">↓${lo}°C</div>${kmItem}`);
    }
    return kmItem ? wrap(kmItem) : '';
  }
  const dw = dailyWx(seg, day);
  if (dw) {
    return wrap(`<div class="wx-hdr-item" aria-label="${wxText(dw.emoji)}"><span aria-hidden="true">${dw.emoji || ''}</span></div><div class="wx-hdr-item">↑${dw.hi}°C</div><div class="wx-hdr-item">↓${dw.lo}°C</div>${kmItem}`);
  }
  return kmItem ? wrap(kmItem) : '';
}

/* ── Wikipedia thumbnails ───────────────────────────────────────────── */
function spotKey(sp) {
  return sp.wiki ? sp.wiki : (sp.fallbackImg ? 'img:' + sp.name : null);
}
function fetchWikiImgs(spots) {
  spots.forEach((sp) => {
    if (!sp.wiki && sp.fallbackImg) {
      if (wikiImgs['img:' + sp.name] === undefined) wikiImgs['img:' + sp.name] = sp.fallbackImg;
      return;
    }
    if (!sp.wiki || wikiImgs[sp.wiki] !== undefined || wikiPending[sp.wiki]) return;
    wikiPending[sp.wiki] = true;
    fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(sp.wiki))
      .then((r) => r.json())
      .then((d) => {
        wikiImgs[sp.wiki] = (d.thumbnail && d.thumbnail.source) || sp.fallbackImg || null;
        renderDay();
      })
      .catch(() => { wikiImgs[sp.wiki] = sp.fallbackImg || null; renderDay(); });
  });
}

/* ── Day route ──────────────────────────────────────────────────────── */
function routePlaces(blocks) {
  const places = [];
  blocks.forEach((b) => {
    if (b.mapsUrl) {
      const m = b.mapsUrl.match(/[?&]q=([^&]+)/);
      if (m) places.push({ q: m[1], name: loc(b.title) });
    }
    (b.waypoints || []).forEach((w) => places.push({ q: w.query, name: loc(w.name) }));
  });
  return places;
}
/* Schematic per-day map: equirectangular projection of the day's coord-bearing
   blocks, letterboxed into a fixed viewBox. Zero dependencies, offline-safe. */
function dayMapSVG(day) {
  const stops = day.blocks.filter((b) => b.coords);
  if (stops.length < 2) return '';
  const VW = 320, VH = 180, padL = 44, padR = 44, padT = 18, padB = 30;
  const plotW = VW - padL - padR;   // drawable width
  const plotH = VH - padT - padB;   // drawable height
  const meanLat = stops.reduce((s, b) => s + b.coords.lat, 0) / stops.length;
  const cosLat = Math.cos(meanLat * Math.PI / 180) || 1; // shrink lon so shapes aren't stretched
  const proj = stops.map((b) => ({ x: b.coords.lon * cosLat, y: b.coords.lat }));
  let minX = Math.min.apply(null, proj.map((p) => p.x));
  let maxX = Math.max.apply(null, proj.map((p) => p.x));
  let minY = Math.min.apply(null, proj.map((p) => p.y));
  let maxY = Math.max.apply(null, proj.map((p) => p.y));
  let spanX = maxX - minX, spanY = maxY - minY;
  // pad the bounding box ~12% (6% each side)
  minX -= spanX * 0.06; maxX += spanX * 0.06;
  minY -= spanY * 0.06; maxY += spanY * 0.06;
  spanX = maxX - minX; spanY = maxY - minY;
  const EPS = 1e-9;
  // letterbox: one scale for both axes so nothing is distorted
  let scale = Math.min(
    spanX < EPS ? Infinity : plotW / spanX,
    spanY < EPS ? Infinity : plotH / spanY
  );
  if (!isFinite(scale)) scale = 0; // all coords identical -> center the single point
  const offX = padL + (plotW - spanX * scale) / 2;
  const offY = padT + (plotH - spanY * scale) / 2;
  const pts = proj.map((p) => ({
    x: spanX < EPS ? padL + plotW / 2 : offX + (p.x - minX) * scale,
    y: spanY < EPS ? padT + plotH / 2 : offY + (maxY - p.y) * scale, // invert: north is up
  }));
  const n = stops.length;
  const aria = ui('dayMapAria').replace('{n}', n);
  let svg = `<svg class="daymap-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(aria)}">`;
  svg += `<polyline class="daymap-line" points="${pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}" />`;
  pts.forEach((p, i) => {
    const title = loc(stops[i].title) || '';
    svg += `<circle class="daymap-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9"><title>${esc((i + 1) + '. ' + title + ' (' + stops[i].time + ')')}</title></circle>`;
    svg += `<text class="daymap-num" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" dy=".32em" text-anchor="middle">${i + 1}</text>`;
  });
  [0, n - 1].forEach((idx) => {
    const p = pts[idx];
    let name = loc(stops[idx].title) || '';
    if (name.length > 16) name = name.slice(0, 16) + '…';
    const anchor = p.x < 40 ? 'start' : (p.x > VW - 40 ? 'end' : 'middle');
    svg += `<text class="daymap-label" x="${p.x.toFixed(1)}" y="${(p.y + 17).toFixed(1)}" text-anchor="${anchor}">${esc(name)}</text>`;
  });
  svg += '</svg>';
  return `<div class="daymap"><div class="daymap-eye">${ui('dayMap')}</div>${svg}</div>`;
}

/* ── Calendar export (.ics) ─────────────────────────────────────────── */
/* RFC 5545 TEXT escaping for SUMMARY/DESCRIPTION/LOCATION values only.
   Order matters: backslash first, then ; and , then newlines, to avoid
   double-escaping the backslashes introduced by earlier steps. */
function icsEscapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}
/* Fold a content line at 75 UTF-8 octets (74 on continuation lines, since
   the leading space occupies 1 octet), never splitting a multi-byte
   UTF-8 sequence across a fold boundary. */
function icsFoldLine(line) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;
  const chunks = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a UTF-8 sequence
    chunks.push(dec.decode(bytes.slice(start, end)));
    start = end;
    limit = 74;
  }
  return chunks.join('\r\n ');
}
function icsDateStamp(iso) {
  return iso.replace(/-/g, '') + 'T000000Z';
}
function icsDateOnly(iso) {
  return iso.replace(/-/g, '');
}
function icsLocalDateTime(iso, h, m) {
  return iso.replace(/-/g, '') + 'T' + String(h).padStart(2, '0') + String(m).padStart(2, '0') + '00';
}
/* DTSTART + addMin minutes, handling day/month/year rollover via Date math. */
function icsAddMinutes(iso, h, m, addMin) {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, m + addMin, 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${yy}${mm}${dd}T${hh}${mi}00`;
}
/* Strip a single leading '~' then require an exact H:MM/HH:MM match. */
function icsParseBlockTime(block) {
  const stripped = String((block && block.time) || '').replace(/^~/, '');
  const m = stripped.match(/^(\d{1,2}):(\d{2})$/);
  return m ? { h: parseInt(m[1], 10), m: parseInt(m[2], 10) } : null;
}
function icsBuildTimedEvent({ uid, dtstamp, dtstart, dtend, summary, description, location }) {
  const lines = ['BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + dtstamp, 'DTSTART:' + dtstart, 'DTEND:' + dtend,
    'SUMMARY:' + icsEscapeText(summary)];
  if (description) lines.push('DESCRIPTION:' + icsEscapeText(description));
  lines.push('LOCATION:' + icsEscapeText(location), 'END:VEVENT');
  return lines;
}
function icsBuildAllDayEvent({ uid, dtstamp, dtstartDate, dtendDate, summary }) {
  return ['BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + dtstamp,
    'DTSTART;VALUE=DATE:' + dtstartDate, 'DTEND;VALUE=DATE:' + dtendDate,
    'SUMMARY:' + icsEscapeText(summary), 'END:VEVENT'];
}
/* Selected plan for a segment: planBySegMap override, else segment default, else first plan. */
function icsResolvePlan(seg, planBySegMap) {
  const pid = (planBySegMap && planBySegMap[seg.id]) || seg.defaultPlan || seg.plans[0].id;
  return seg.plans.find((p) => p.id === pid) || seg.plans[0];
}
/* Builds the whole-trip .ics text (all segments, each on its selected plan). */
function buildTripIcs(tripObj, planBySegMap, currentLang) {
  const locIn = (obj) => (obj ? (obj[currentLang] !== undefined ? obj[currentLang] : obj[tripObj.defaultLanguage]) : '');
  const dtstamp = icsDateStamp(icsResolvePlan(tripObj.segments[0], planBySegMap).days[0].date);

  const eventLines = [];
  tripObj.segments.forEach((seg) => {
    const plan = icsResolvePlan(seg, planBySegMap);
    plan.days.forEach((day) => {
      const parsedTimes = day.blocks.map(icsParseBlockTime);
      const hasTimed = parsedTimes.some((t) => t !== null);
      if (hasTimed) {
        day.blocks.forEach((block, bi) => {
          const t = parsedTimes[bi];
          if (!t) return;
          let found = false, endH = null, endM = null;
          for (let j = bi + 1; j < day.blocks.length; j++) {
            if (parsedTimes[j]) { endH = parsedTimes[j].h; endM = parsedTimes[j].m; found = true; break; }
          }
          const dtstart = icsLocalDateTime(day.date, t.h, t.m);
          const dtend = found ? icsLocalDateTime(day.date, endH, endM) : icsAddMinutes(day.date, t.h, t.m, 60);
          const summary = locIn(block.title);
          let description = null;
          if (block.description || block.mapsUrl) {
            const descText = block.description ? locIn(block.description) : '';
            description = block.mapsUrl ? (descText ? descText + '\n' + block.mapsUrl : block.mapsUrl) : descText;
          }
          eventLines.push(...icsBuildTimedEvent({
            uid: `${tripObj.id}-${seg.id}-${day.date}-${bi}@trips`,
            dtstamp, dtstart, dtend, summary, description, location: summary,
          }));
        });
      } else {
        eventLines.push(...icsBuildAllDayEvent({
          uid: `${tripObj.id}-${seg.id}-${day.date}-day@trips`,
          dtstamp,
          dtstartDate: icsDateOnly(day.date),
          dtendDate: icsDateOnly(addDaysIso(day.date, 1)),
          summary: locIn(day.title),
        }));
      }
    });
  });

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trips//Trip Engine//EN', 'CALSCALE:GREGORIAN',
    ...eventLines, 'END:VCALENDAR'];
  return lines.map(icsFoldLine).join('\r\n') + '\r\n';
}
function downloadIcsFile(filename, text) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── Rendering ──────────────────────────────────────────────────────── */
const PIN_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>';
const TREND_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>';
const CAL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
const SUN_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 1 0 11 11z"/></svg>';
const AUTO_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>';

/* ── Theme (light/dark/auto) ───────────────────────────────────────────
   Mirrors the "candlelit paper" dark palette in assets/app.css. Persisted
   in localStorage so it applies across app.html and the index.html trip
   picker; the inline <head> script in both applies it before first paint. */
const THEME_KEY = 'theme-pref';
function themePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return (v === 'dark' || v === 'light') ? v : 'auto';
  } catch (e) { return 'auto'; }
}
function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'dark' || pref === 'light') root.setAttribute('data-theme', pref);
  else root.removeAttribute('data-theme');
}
function renderThemeBtn() {
  const btn = $('theme-btn');
  if (!btn) return;
  const pref = themePref();
  const icon = pref === 'dark' ? MOON_SVG : pref === 'light' ? SUN_SVG : AUTO_SVG;
  const label = ui('theme' + cap(pref));
  btn.innerHTML = icon;
  btn.setAttribute('aria-label', label);
}
window.toggleTheme = function () {
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[themePref()];
  try {
    if (next === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch (e) { /* private mode / storage disabled */ }
  applyTheme(next);
  renderThemeBtn();
};
// Apply immediately (button exists in the static shell before the trip loads).
renderThemeBtn();

function renderHero() {
  const { seg } = current();
  document.documentElement.lang = lang;
  document.title = loc(trip.title);
  $('ey').textContent = loc(trip.eyebrow) || '';
  $('tt').textContent = loc(seg.title);
  $('ts').textContent = loc(seg.subtitle) || '';
  const shell = document.querySelector('.shell');
  shell.className = 'shell theme-' + (seg.theme || 'tartan');
  // back link to the trip picker
  const back = $('back-link');
  if (back) {
    back.textContent = '←';
    back.setAttribute('aria-label', ui('backAria'));
  }
  // add-to-calendar button
  const icsBtn = $('ics-btn');
  if (icsBtn) {
    icsBtn.innerHTML = CAL_SVG + '<span>' + esc(ui('addToCalendar')) + '</span>';
    icsBtn.setAttribute('aria-label', ui('addToCalendar'));
  }
  // light/dark theme toggle (label text re-localized on language change)
  renderThemeBtn();
  // language toggle
  const toggle = $('lang-toggle');
  toggle.classList.toggle('hidden', trip.languages.length < 2);
  toggle.innerHTML = trip.languages.map((l) =>
    `<button class="lang-btn${l === lang ? ' on' : ''}" aria-pressed="${l === lang}" onclick="setL('${l}')">${l.toUpperCase()}</button>`).join('');
  // plan tabs
  const vtabs = $('vtabs');
  vtabs.classList.toggle('hidden', seg.plans.length < 2);
  vtabs.innerHTML = seg.plans.length < 2 ? '' : seg.plans.map((p) =>
    `<button class="vtab${p.id === planOf(seg).id ? ' on' : ''}" aria-pressed="${p.id === planOf(seg).id}" onclick="setV('${p.id}')">${loc(p.label) || p.id}</button>`).join('');
}

function renderNav() {
  const nav = $('daynav');
  nav.setAttribute('aria-label', ui('days'));
  let h = '';
  let lastSegIdx = null;
  calendarDays().forEach((c) => {
    if (c.gi === null) {
      h += `<span class="daybtn gap"><span aria-hidden="true"><span class="dow">${dowShort(c.iso)}</span><span class="dnum">${dayNum(c.iso)}</span></span><span class="sr-only">${ui('freeDay')}</span></span>`;
      return;
    }
    if (lastSegIdx !== null && c.segIdx !== lastSegIdx) h += '<div class="daybtn-separator"></div>';
    lastSegIdx = c.segIdx;
    const f = flatDays[c.gi];
    const day = planOf(f.seg).days[f.dayInSeg];
    const on = c.gi === dayIdx;
    const bday = day.banner ? ' has-bday' : '';
    h += `<button class="daybtn${on ? ' on' : ''}${bday}" onclick="sd(${c.gi})"${on ? ' aria-current="date"' : ''} aria-label="${dayAriaLabel(day.date)}"><span class="dow">${dowShort(day.date)}</span><span class="dnum">${dayNum(day.date)}</span><span class="bday-pip"></span></button>`;
  });
  nav.innerHTML = h;
  const activeBtn = nav.querySelector('.daybtn.on');
  if (activeBtn) activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
}

function renderDay() {
  const { seg, plan, day } = current();
  let h = '';

  h += '<div class="day-hdr"><div class="dh-in">';
  h += `<div class="dh-eye">${dayLabel(day.date)}</div>`;
  h += `<div class="dh-title">${loc(day.title)}</div>`;
  h += `<div class="dh-note">${loc(day.note) || ''}</div>`;
  const dayKm = day.kmTotal || day.blocks.reduce((s, b) => s + (b.km || 0), 0);
  h += wxDaySummary(seg, day, dayKm || null);
  if (day.banner) h += `<div class="bday-strip">${loc(day.banner)}</div>`;
  h += '</div></div>';

  const places = routePlaces(day.blocks);
  if (places.length >= 2) {
    let url = 'https://www.google.com/maps/dir/' + places.map((p) => p.q).join('/') + '/';
    if (day.routeMode) url += '?travelmode=' + day.routeMode;
    h += `<a href="${url}" target="_blank" class="route-card">`;
    h += `<div class="route-hdr">${TREND_SVG}${ui('dayRoute')}</div>`;
    h += '<div class="route-stops">';
    places.forEach((p, i) => {
      if (i > 0) h += '<div class="route-connector"></div>';
      h += `<div class="route-stop"><div class="route-num">${i + 1}</div><div class="route-name">${esc(p.name)}</div></div>`;
    });
    h += '</div>';
    h += `<div class="route-open">${PIN_SVG}${ui('openRoute')}</div>`;
    h += '</a>';
  }

  h += dayMapSVG(day);

  h += '<div class="tl">';
  day.blocks.forEach((b, bi) => {
    const last = bi === day.blocks.length - 1;
    h += `<div class="tb"><div class="tb-left"><div class="tb-time">${b.time}${wxBadge(seg, day, b.time)}</div>`;
    h += `<div class="tb-dot-col"><div class="tb-dot" style="background:${b.dotColor || 'var(--stone)'}"></div>`;
    if (!last) h += '<div class="tb-line"></div>';
    h += '</div></div><div class="tb-body">';
    h += `<div class="tb-title">${loc(b.title)}</div>`;
    if (b.tags && b.tags.length) {
      h += '<div class="tb-tags">';
      b.tags.forEach((key) => {
        const tag = trip.tags && trip.tags[key];
        if (tag) h += `<span class="tb-tag ${tag.style || 'logistics'}">${loc(tag.label)}</span>`;
      });
      h += '</div>';
    }
    const meta = loc(b.description);
    if (meta) h += `<div class="tb-meta">${meta}</div>`;
    if (b.km) h += `<div class="km-tag">🚶 ~${b.km} km</div>`;
    if (b.warning) h += `<div class="tb-warn">${loc(b.warning)}</div>`;
    if (b.note) h += `<div class="tb-note">${loc(b.note)}</div>`;
    if (b.photoSpots && b.photoSpots.length) {
      fetchWikiImgs(b.photoSpots);
      h += '<div class="tb-photos">';
      h += b.photoSpots.map((p) => {
        const key = spotKey(p);
        const img = key && wikiImgs[key]
          ? `<img src="${wikiImgs[key]}" class="ps-thumb" alt="${esc(p.name)}">`
          : '<div class="ps-thumb ps-placeholder" aria-hidden="true"></div>';
        return `<a href="${p.mapsUrl}" target="_blank" class="ps-card">${img}<span class="ps-label">${esc(p.name)}</span></a>`;
      }).join('');
      h += '</div>';
    }
    if (b.diff && plan.diffLabels && plan.diffLabels[b.diff.kind]) {
      h += `<div class="diff-${b.diff.kind}">${loc(plan.diffLabels[b.diff.kind])}${loc(b.diff.reason)}</div>`;
    }
    if (b.mapsUrl) h += `<a class="map-btn" href="${b.mapsUrl}" target="_blank">${PIN_SVG}${ui('maps')}</a>`;
    h += '</div></div>';
  });
  h += '</div>';
  if (seg.footer) h += `<div class="footer">${loc(seg.footer)}</div>`;
  $('content').innerHTML = h;
}

function renderAll() {
  renderHero();
  renderNav();
  renderDay();
}

/* ── Interaction (global, also used by the parity capture script) ───── */
window.setL = function (l) {
  lang = l;
  renderAll();
  saveState();
};
window.setV = function (planId) {
  trip.segments.forEach((seg) => {
    if (seg.plans.some((p) => p.id === planId)) planBySeg[seg.id] = planId;
  });
  rebuildFlatDays();
  dayIdx = Math.max(0, Math.min(dayIdx, flatDays.length - 1)); // plan may have fewer days
  renderAll();
  saveState();
};
window.sd = function (i) {
  dayIdx = Math.max(0, Math.min(i, flatDays.length - 1));
  $('content').scrollTop = 0;
  renderAll();
  saveState();
};
window.exportIcs = function () {
  downloadIcsFile(trip.id + '.ics', buildTripIcs(trip, planBySeg, lang));
};

/* ── Boot ───────────────────────────────────────────────────────────── */
async function boot() {
  const id = new URLSearchParams(location.search).get('trip');
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    $('content').innerHTML = `<div class="app-msg">${ui('noTrip')}</div><div class="app-msg"><a class="back-link-inline" href="./">${ui('backToTrips')}</a></div>`;
    return;
  }
  $('content').innerHTML = `<div class="app-msg">${ui('loading')}</div>`;
  try {
    const r = await fetch('trips/' + id + '.json');
    if (!r.ok) throw new Error(r.status);
    trip = await r.json();
  } catch (e) {
    $('content').innerHTML = `<div class="app-msg">${ui('loadError')}</div><div class="app-msg"><a class="back-link-inline" href="./">${ui('backToTrips')}</a></div>`;
    return;
  }

  // defaults, then validated restore from localStorage
  lang = trip.defaultLanguage || trip.languages[0];
  trip.segments.forEach((seg) => { planBySeg[seg.id] = seg.defaultPlan || seg.plans[0].id; });

  const saved = loadState();
  let savedDayIndex = null;
  if (saved) {
    if (saved.lang && trip.languages.indexOf(saved.lang) !== -1) lang = saved.lang;
    if (saved.planBySeg && typeof saved.planBySeg === 'object') {
      trip.segments.forEach((seg) => {
        const pid = saved.planBySeg[seg.id];
        if (pid && seg.plans.some((p) => p.id === pid)) planBySeg[seg.id] = pid;
      });
    }
    if (Number.isInteger(saved.dayIndex)) savedDayIndex = saved.dayIndex;
  }

  rebuildFlatDays();
  isPast = tripIsPast();

  // Active trips always open on today (or the next planned day past a gap);
  // past/upcoming trips restore the saved day, clamped to the valid range.
  if (tripStatusFromRange() === 'active') {
    dayIdx = todayFocusIndex();
  } else if (savedDayIndex !== null) {
    dayIdx = Math.max(0, Math.min(savedDayIndex, flatDays.length - 1));
  } else {
    dayIdx = 0;
  }

  renderAll();
  saveState();
  fetchWeather();
}
boot();
