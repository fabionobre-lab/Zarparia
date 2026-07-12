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

	onMount(async () => {
		const mod = await import('leaflet');
		// Component may have been torn down while the async import was in flight
		// (rapid day switching) — bail rather than binding to a detached node.
		if (destroyed || !container || map) return;
		L = mod.default ?? mod;
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
			markerZoomAnimation: false
		});
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19
		}).addTo(map);
		layer = L.layerGroup().addTo(map);
		render();
		map.invalidateSize();
	});

	onDestroy(() => {
		destroyed = true;
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
		margin: 10px 13px 4px;
		height: 200px;
		border: 1px solid var(--border);
		border-radius: 12px;
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
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		box-sizing: border-box;
	}
	:global(.daymap-popup) {
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 12px;
		color: #1a1208;
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
		border-radius: 8px;
		object-fit: cover;
		border: 2px solid #fff;
		box-sizing: border-box;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
	}
	:global(.daymap-photo-count) {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 15px;
		height: 15px;
		padding: 0 3px;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-family: system-ui, sans-serif;
		font-size: 9px;
		font-weight: 700;
		line-height: 15px;
		text-align: center;
		border: 1px solid #fff;
		box-sizing: content-box;
	}
</style>
