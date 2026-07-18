<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	// CSS-only import is SSR-safe (Vite extracts it, no window access). The
	// Leaflet *runtime* touches `window` at import time, so it is loaded via a
	// dynamic import inside onMount (browser-only) — never during SSR on the
	// Cloudflare adapter.
	import 'leaflet/dist/leaflet.css';
	import type { Map as LMap, LayerGroup } from 'leaflet';

	export interface MapStop {
		lat: number;
		lon: number;
		/** 1-based position among the day's coord blocks, in time order. */
		n: number;
		/** Popup text, already localized: "<time> — <title>". */
		popup: string;
	}

	/** A cluster of linked photos anchored at a block's coordinates. */
	export interface PhotoStop {
		lat: number;
		lon: number;
		/** App-served thumbnail URL (same-origin /api/... path). */
		thumbUrl: string;
		count: number;
		/** Index of the block the photos belong to, passed to the click handler. */
		blockIndex: number;
	}

	let {
		stops,
		ariaLabel,
		photoStops = [],
		onphotostopclick
	}: {
		stops: MapStop[];
		ariaLabel: string;
		photoStops?: PhotoStop[];
		onphotostopclick?: (blockIndex: number) => void;
	} = $props();

	let container: HTMLDivElement | null = null;
	let map: LMap | null = null;
	let layer: LayerGroup | null = null;
	let L: typeof import('leaflet') | null = null;
	let destroyed = false;
	let resizeObs: ResizeObserver | null = null;
	let refitTimer: ReturnType<typeof setTimeout> | null = null;

	/** Rebuild every marker + the connecting polyline from `stops`, then refit. */
	function render() {
		if (!map || !L || !layer) return;
		// Cancel any in-flight pan/zoom and close popups before tearing down the
		// layer group, so no queued animation frame dereferences a cleared marker.
		map.stop();
		map.closePopup();
		layer.clearLayers();
		const latlngs: [number, number][] = [];
		for (const s of stops) {
			latlngs.push([s.lat, s.lon]);
			// `n` is a number, safe to interpolate into the divIcon markup.
			const icon = L.divIcon({
				className: 'daymap-marker',
				html: `<span>${s.n}</span>`,
				iconSize: [24, 24],
				iconAnchor: [12, 12],
				popupAnchor: [0, -14]
			});
			const marker = L.marker([s.lat, s.lon], { icon });
			// Build the popup as a text node so a malicious stored title can never
			// inject markup into the map layer.
			const el = document.createElement('div');
			el.className = 'daymap-popup';
			el.textContent = s.popup;
			marker.bindPopup(el);
			marker.addTo(layer);
		}
		// Photo clusters render beside their block's numbered pin, as a round
		// thumbnail with a count badge. Built as DOM nodes (never an HTML
		// string) so no stored value can inject markup into the map layer.
		for (const ps of photoStops) {
			const el = document.createElement('span');
			el.className = 'daymap-photo';
			const img = document.createElement('img');
			img.src = ps.thumbUrl;
			img.alt = '';
			el.appendChild(img);
			if (ps.count > 1) {
				const badge = document.createElement('span');
				badge.className = 'daymap-photo-count';
				badge.textContent = String(ps.count);
				el.appendChild(badge);
			}
			const icon = L.divIcon({
				className: 'daymap-photo-marker',
				html: el,
				iconSize: [30, 30],
				// Anchored up-right of the block pin so both stay visible.
				iconAnchor: [-2, 32]
			});
			const marker = L.marker([ps.lat, ps.lon], { icon });
			if (onphotostopclick) marker.on('click', () => onphotostopclick(ps.blockIndex));
			marker.addTo(layer);
		}
		if (latlngs.length >= 2) {
			L.polyline(latlngs, {
				className: 'daymap-line',
				// `color` is a no-CSS fallback only — the real, theme-aware stroke
				// is `.daymap-line { stroke: var(--text-muted) }` below, which
				// overrides Leaflet's inline stroke attribute.
				color: '#7a6e5f',
				weight: 2,
				opacity: 0.7,
				dashArray: '4 6'
			}).addTo(layer);
		}
		if (latlngs.length) {
			map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 15, animate: false });
		}
		map.invalidateSize();
	}

	/** Re-measure the container and re-fit the current stops without rebuilding
	 *  markers — used by the ResizeObserver when the panel changes size (e.g. the
	 *  mobile↔desktop breakpoint changes the map height). */
	function refit() {
		if (!map || !L) return;
		map.invalidateSize();
		const latlngs: [number, number][] = stops.map((s) => [s.lat, s.lon]);
		if (latlngs.length) {
			map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 15, animate: false });
		}
	}

	onMount(async () => {
		const mod = await import('leaflet');
		// Component may have been torn down while the async import was in flight
		// (rapid day switching) — bail rather than binding to a detached node.
		if (destroyed || !container || map) return;
		L = mod.default ?? mod;
		// On coarse pointers (touch), disable one-finger drag so a thumb-swipe over
		// the map scrolls the page instead of being trapped panning the map.
		// Combined with `touch-action: pan-y` on the container (see CSS below), the
		// map never steals vertical scroll. The +/− zoom buttons stay (zoomControl)
		// and pinch/touch-zoom stays enabled. Marker taps still fire as native
		// clicks. (Leaflet 1.9 removed the `tap` handler entirely, so there's no
		// tap option to turn off here — dragging + touch-action cover it.)
		const coarse =
			typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
		// Zoom/fade animations are disabled: the map is driven programmatically by
		// frequent fitBounds across day switches and is torn down on unmount, so an
		// in-flight zoom-animation frame could dereference a cleared marker
		// (Leaflet's "_leaflet_pos" crash). Snapping instead is robust and, for a
		// small embedded panel, visually indistinguishable.
		map = L.map(container, {
			attributionControl: true,
			zoomControl: true,
			zoomAnimation: false,
			fadeAnimation: false,
			markerZoomAnimation: false,
			// Wheel over the map scrolls the page (never zooms) on every device.
			scrollWheelZoom: false,
			dragging: !coarse,
			touchZoom: true
		});
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19
		}).addTo(map);
		layer = L.layerGroup().addTo(map);
		render();
		map.invalidateSize();

		// Re-measure + re-fit when the panel's box changes size — most importantly
		// when crossing the 960px breakpoint flips the map between 200px (mobile)
		// and the taller desktop height, which otherwise leaves Leaflet rendering
		// against a stale size (gray half-tiles / wrong fit). Debounced lightly so
		// a drag-resize doesn't thrash fitBounds.
		if (typeof ResizeObserver !== 'undefined') {
			resizeObs = new ResizeObserver(() => {
				if (refitTimer) clearTimeout(refitTimer);
				refitTimer = setTimeout(refit, 100);
			});
			resizeObs.observe(container);
		}
	});

	onDestroy(() => {
		destroyed = true;
		if (refitTimer) clearTimeout(refitTimer);
		if (resizeObs) {
			resizeObs.disconnect();
			resizeObs = null;
		}
		if (map) {
			map.stop();
			map.remove();
			map = null;
		}
		layer = null;
		L = null;
	});

	// Rebuild markers/polyline reactively on every day / plan / language /
	// photo change. render() reads current props; no reactive state is
	// written, so no loop.
	$effect(() => {
		stops;
		photoStops;
		if (map && L && layer) render();
	});
</script>

<div class="map-panel" role="group" aria-label={ariaLabel}>
	<div class="map-canvas" bind:this={container}></div>
</div>

<style>
	.map-panel {
		margin: 8px 13px 2px;
		height: 200px;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.map-canvas {
		width: 100%;
		height: 100%;
		background: var(--surface-sunken);
		/* Keep the light OSM tiles (no inversion); in dark mode just knock the
		   brightness back and lift contrast a touch so they don't glare. The
		   --map-filter token is defined on .shell (this map is a descendant). */
		filter: var(--map-filter, none);
		/* Let a vertical thumb-swipe over the map scroll the PAGE instead of being
		   trapped by Leaflet. This scoped rule (plus dragging/tap off on coarse
		   pointers in JS) beats Leaflet's own `.leaflet-touch-*` touch-action
		   rules, which otherwise reserve the gesture and block page scroll. */
		touch-action: pan-y !important;
	}
	/* Desktop: the map lives in the sticky right column and can be much taller. */
	@media (min-width: 960px) {
		.map-panel {
			margin: 0;
			height: clamp(360px, 55vh, 520px);
		}
	}
	/* Leaflet injects markers/popups into panes outside this component's scope,
	   so these rules must be global. The elements are still DOM descendants of
	   .shell, so var(--accent) inherits down to them. */
	:global(.daymap-marker span) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 11px;
		font-weight: 600;
		line-height: 1;
		border: 2px solid #fff;
		box-shadow: var(--elevation-1);
		box-sizing: border-box;
	}
	:global(.daymap-line) {
		/* Theme-aware route stroke (CSS beats the SVG stroke presentation
		   attribute Leaflet sets from the `color` option). Replaces the old
		   #7a6e5f literal with the muted-text token — a hair greyer in light
		   mode, and it now flips with the theme for free. */
		stroke: var(--text-muted);
	}
	:global(.daymap-popup) {
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 12px;
		color: var(--text);
	}
	:global(.daymap-photo-marker) {
		cursor: pointer;
	}
	:global(.daymap-photo) {
		position: relative;
		display: block;
		width: 30px;
		height: 30px;
	}
	:global(.daymap-photo img) {
		width: 30px;
		height: 30px;
		border-radius: var(--radius-md);
		object-fit: cover;
		border: 2px solid #fff;
		box-sizing: border-box;
		box-shadow: var(--elevation-1);
	}
	:global(.daymap-photo-count) {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 15px;
		height: 15px;
		padding: 0 3px;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		line-height: 15px;
		text-align: center;
		border: 1px solid #fff;
		box-sizing: content-box;
	}
</style>
