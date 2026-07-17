<script lang="ts">
	// Family empty-state anatomy (Phase 3 task 4, DESIGN.md's "Empty states"
	// rule): an accent-colored glyph, then whatever copy/CTA the call site
	// already has (kept as-is — this component only adds the glyph + the
	// shared layout, not new copy). Content is a snippet rather than fixed
	// message/cta props so each existing i18n string (which sometimes embeds
	// its own inline link, e.g. home's "No trips yet. Create one.") doesn't
	// have to be reshaped to fit.
	import type { Snippet } from 'svelte';

	let { kind = 'default', children }: { kind?: 'trips' | 'inbox' | 'approvals' | 'default'; children: Snippet } =
		$props();
</script>

<div class="empty-state">
	<svg class="glyph" aria-hidden="true" viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
		{#if kind === 'trips'}
			<!-- suitcase -->
			<rect x="9" y="16" width="30" height="21" rx="3" />
			<path d="M18 16v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
			<path d="M9 25h30" />
		{:else if kind === 'inbox'}
			<path d="M8 25 14 9h20l6 16" />
			<path d="M8 25v11a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V25" />
			<path d="M8 25h9a2 2 0 0 1 2 2 5 5 0 0 0 10 0 2 2 0 0 1 2-2h9" />
		{:else if kind === 'approvals'}
			<circle cx="24" cy="16" r="7" />
			<path d="M9 40c0-8.5 6.5-14 15-14s15 5.5 15 14" />
		{:else}
			<circle cx="24" cy="24" r="15" />
			<path d="M24 17v8l5 5" />
		{/if}
	</svg>
	<div class="body">{@render children()}</div>
</div>

<style>
	.empty-state {
		text-align: center;
		padding: 1.75rem 1rem;
		color: var(--text-muted);
	}
	.glyph {
		color: var(--accent-strong);
		margin-bottom: 0.6rem;
	}
	.body {
		font-size: 0.9rem;
	}
	.body :global(p) {
		margin: 0;
	}
	.body :global(a) {
		color: var(--accent-strong);
		font-weight: 600;
	}
</style>
