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
  },
  pt: {
    maps: 'Abrir no Maps',
    dayRoute: 'Rota do Dia',
    openRoute: 'Abrir rota no Google Maps →',
    loading: 'Carregando viagem…',
    loadError: 'Não foi possível carregar os dados da viagem.',
    noTrip: 'Nenhuma viagem especificada. Abra como app.html?trip=&lt;id&gt;.',
  },
};

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
  const today = new Date().toISOString().slice(0, 10);
  return last < today;
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
/* Per-block badge: hourly at the block's hour, else the day's daily/static value */
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
    return hw ? `<div class="wx">${wxEmoji(hw.code)} ${Math.round(hw.temp)}°C</div>` : '';
  }
  const dw = dailyWx(seg, day);
  return dw ? `<div class="wx">${dw.emoji || ''} ${Math.round(dw.hi)}°C</div>` : '';
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
      return wrap(`<div class="wx-hdr-item">${wxEmoji(parseInt(dom, 10))}</div><div class="wx-hdr-item">↑${hi}°C</div><div class="wx-hdr-item">↓${lo}°C</div>${kmItem}`);
    }
    return kmItem ? wrap(kmItem) : '';
  }
  const dw = dailyWx(seg, day);
  if (dw) {
    return wrap(`<div class="wx-hdr-item">${dw.emoji || ''}</div><div class="wx-hdr-item">↑${dw.hi}°C</div><div class="wx-hdr-item">↓${dw.lo}°C</div>${kmItem}`);
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
function truncStop(name) {
  return name.length > 20 ? name.substring(0, 18) + '…' : name;
}

/* ── Rendering ──────────────────────────────────────────────────────── */
const PIN_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>';
const TREND_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>';

function renderHero() {
  const { seg } = current();
  document.documentElement.lang = lang;
  document.title = loc(trip.title);
  $('ey').textContent = loc(trip.eyebrow) || '';
  $('tt').textContent = loc(seg.title);
  $('ts').textContent = loc(seg.subtitle) || '';
  const shell = document.querySelector('.shell');
  shell.className = 'shell theme-' + (seg.theme || 'tartan');
  // language toggle
  const toggle = $('lang-toggle');
  toggle.classList.toggle('hidden', trip.languages.length < 2);
  toggle.innerHTML = trip.languages.map((l) =>
    `<button class="lang-btn${l === lang ? ' on' : ''}" onclick="setL('${l}')">${l.toUpperCase()}</button>`).join('');
  // plan tabs
  const vtabs = $('vtabs');
  vtabs.classList.toggle('hidden', seg.plans.length < 2);
  vtabs.innerHTML = seg.plans.length < 2 ? '' : seg.plans.map((p) =>
    `<button class="vtab${p.id === planOf(seg).id ? ' on' : ''}" onclick="setV('${p.id}')">${loc(p.label) || p.id}</button>`).join('');
}

function renderNav() {
  const nav = $('daynav');
  let h = '';
  let gi = 0;
  trip.segments.forEach((seg, segIdx) => {
    if (segIdx > 0) h += '<div class="daybtn-separator"></div>';
    planOf(seg).days.forEach((day) => {
      const on = gi === dayIdx ? ' on' : '';
      const bday = day.banner ? ' has-bday' : '';
      h += `<button class="daybtn${on}${bday}" onclick="sd(${gi})"><span class="dow">${dowShort(day.date)}</span><span class="dnum">${dayNum(day.date)}</span><span class="bday-pip"></span></button>`;
      gi++;
    });
  });
  nav.innerHTML = h;
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
      h += `<div class="route-stop"><div class="route-num">${i + 1}</div><div class="route-name">${truncStop(p.name)}</div></div>`;
    });
    h += '</div>';
    h += `<div class="route-open">${PIN_SVG}${ui('openRoute')}</div>`;
    h += '</a>';
  }

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
          ? `<img src="${wikiImgs[key]}" class="ps-thumb" alt="">`
          : '<div class="ps-thumb ps-placeholder"></div>';
        return `<a href="${p.mapsUrl}" target="_blank" class="ps-card">${img}<span class="ps-label">${p.name}</span></a>`;
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
};
window.setV = function (planId) {
  trip.segments.forEach((seg) => {
    if (seg.plans.some((p) => p.id === planId)) planBySeg[seg.id] = planId;
  });
  rebuildFlatDays();
  renderAll();
};
window.sd = function (i) {
  dayIdx = Math.max(0, Math.min(i, flatDays.length - 1));
  $('content').scrollTop = 0;
  renderAll();
};

/* ── Boot ───────────────────────────────────────────────────────────── */
async function boot() {
  const id = new URLSearchParams(location.search).get('trip');
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    $('content').innerHTML = `<div class="app-msg">${ui('noTrip')}</div>`;
    return;
  }
  $('content').innerHTML = `<div class="app-msg">${ui('loading')}</div>`;
  try {
    const r = await fetch('trips/' + id + '.json');
    if (!r.ok) throw new Error(r.status);
    trip = await r.json();
  } catch (e) {
    $('content').innerHTML = `<div class="app-msg">${ui('loadError')}</div>`;
    return;
  }
  lang = trip.defaultLanguage || trip.languages[0];
  trip.segments.forEach((seg) => { planBySeg[seg.id] = seg.defaultPlan || seg.plans[0].id; });
  rebuildFlatDays();
  isPast = tripIsPast();
  renderAll();
  fetchWeather();
}
boot();
