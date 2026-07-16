<script lang="ts" module>
	// Icon names used by the bottom bar + More sheet. Kept as a small closed set
	// so the bar can pass a string and TypeScript catches typos.
	export type IconName =
		| 'trips'
		| 'newTrip'
		| 'import'
		| 'share'
		| 'edit'
		| 'more'
		| 'back'
		| 'photos'
		| 'about'
		| 'feedback'
		| 'language'
		| 'signout'
		| 'signin'
		| 'close';
</script>

<script lang="ts">
	// Quiet line icons in the app's established style: 24-unit viewBox, no fill,
	// currentColor stroke, 2px round caps/joins — matching the header's feedback
	// and theme glyphs. `more` is the exception (filled dots) since an ellipsis
	// reads better solid at small sizes.
	let { name, size = 22 }: { name: IconName; size?: number } = $props();
</script>

<svg
	aria-hidden="true"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if name === 'trips'}
		<!-- suitcase -->
		<rect x="3" y="7" width="18" height="13" rx="2" />
		<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
	{:else if name === 'newTrip'}
		<!-- plus in circle -->
		<circle cx="12" cy="12" r="9" />
		<path d="M12 8v8M8 12h8" />
	{:else if name === 'import'}
		<!-- arrow into tray -->
		<path d="M12 3v11" />
		<path d="m7 9 5 5 5-5" />
		<path d="M4 20h16" />
	{:else if name === 'share'}
		<!-- connected nodes -->
		<circle cx="18" cy="5" r="3" />
		<circle cx="6" cy="12" r="3" />
		<circle cx="18" cy="19" r="3" />
		<path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
	{:else if name === 'edit'}
		<!-- pencil -->
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
	{:else if name === 'more'}
		<!-- horizontal ellipsis (filled reads better than 2px rings at 22px) -->
		<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
		<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
		<circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
	{:else if name === 'back'}
		<!-- arrow left -->
		<path d="M19 12H5" />
		<path d="m12 19-7-7 7-7" />
	{:else if name === 'photos'}
		<!-- image -->
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<circle cx="8.5" cy="8.5" r="1.5" />
		<path d="m21 15-5-5L5 21" />
	{:else if name === 'about'}
		<!-- info -->
		<circle cx="12" cy="12" r="9" />
		<path d="M12 11v5" />
		<circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
	{:else if name === 'feedback'}
		<!-- speech bubble (matches the header feedback glyph) -->
		<path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9.5L5 19.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z" />
	{:else if name === 'language'}
		<!-- globe -->
		<circle cx="12" cy="12" r="9" />
		<path d="M3 12h18" />
		<path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
	{:else if name === 'signout'}
		<!-- log out -->
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<path d="m16 17 5-5-5-5" />
		<path d="M21 12H9" />
	{:else if name === 'signin'}
		<!-- log in -->
		<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
		<path d="m10 17 5-5-5-5" />
		<path d="M15 12H3" />
	{:else if name === 'close'}
		<!-- x -->
		<path d="M18 6 6 18M6 6l12 12" />
	{/if}
</svg>

<style>
	svg {
		display: block;
		flex-shrink: 0;
	}
</style>
