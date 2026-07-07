<script lang="ts">
	import type { ShareRow, SharePermission } from '$lib/server/shares';

	let { tripId }: { tripId: string } = $props();

	let shares = $state<ShareRow[]>([]);
	let email = $state('');
	let permission = $state<SharePermission>('viewer');
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');

	async function load() {
		loading = true;
		try {
			const res = await fetch(`/api/trips/${tripId}/shares`);
			if (res.ok) shares = ((await res.json()) as { shares: ShareRow[] }).shares;
		} finally {
			loading = false;
		}
	}
	$effect(() => {
		load();
	});

	async function add(e: Event) {
		e.preventDefault();
		error = '';
		if (!email.trim()) return;
		busy = true;
		try {
			const res = await fetch(`/api/trips/${tripId}/shares`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), permission })
			});
			if (res.ok) {
				email = '';
				await load();
			} else {
				error = ((await res.json()) as { error?: string }).error ?? 'Could not share.';
			}
		} catch {
			error = 'Network error.';
		} finally {
			busy = false;
		}
	}

	async function remove(userId: string) {
		busy = true;
		try {
			await fetch(`/api/trips/${tripId}/shares/${userId}`, { method: 'DELETE' });
			await load();
		} finally {
			busy = false;
		}
	}
</script>

<div class="panel">
	<h3>Share this trip</h3>
	<form onsubmit={add}>
		<input type="email" bind:value={email} placeholder="person@email.com" required />
		<select bind:value={permission}>
			<option value="viewer">can view</option>
			<option value="editor">can edit</option>
		</select>
		<button type="submit" disabled={busy}>Share</button>
	</form>
	{#if error}<p class="err">{error}</p>{/if}

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if shares.length === 0}
		<p class="muted">Not shared with anyone yet.</p>
	{:else}
		<ul>
			{#each shares as s (s.userId)}
				<li>
					<span class="who">{s.name ?? s.email}</span>
					<span class="perm">{s.permission === 'editor' ? 'can edit' : 'can view'}</span>
					<button type="button" class="rm" onclick={() => remove(s.userId)} disabled={busy}>Remove</button>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="hint">People must sign in once before you can share with them.</p>
</div>

<style>
	.panel {
		max-width: 430px;
		margin: 0 auto 1rem;
		background: #fbf8f1;
		border: 1px solid #d8ccb8;
		border-radius: 12px;
		padding: 0.9rem 1rem;
		font-family: system-ui, sans-serif;
	}
	h3 {
		font-size: 0.95rem;
		margin-bottom: 0.6rem;
	}
	form {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	input {
		flex: 1;
		min-width: 10rem;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.55rem;
		border: 1px solid #d8ccb8;
		border-radius: 6px;
	}
	select {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem;
		border: 1px solid #d8ccb8;
		border-radius: 6px;
	}
	button {
		font: inherit;
		font-size: 0.82rem;
		border: 1px solid #d8ccb8;
		background: #2b4a2b;
		color: #fff;
		border-radius: 6px;
		padding: 0.4rem 0.8rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
	}
	.err {
		color: #a33;
		font-size: 0.8rem;
		margin-top: 0.4rem;
	}
	.muted {
		color: #999;
		font-size: 0.85rem;
		margin-top: 0.6rem;
	}
	ul {
		list-style: none;
		margin: 0.6rem 0 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0;
		border-top: 1px solid #eee5d6;
		font-size: 0.85rem;
	}
	.who {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.perm {
		font-size: 0.72rem;
		color: #7a6e5f;
		background: #f0ece4;
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
	}
	.rm {
		background: none;
		color: #a33;
		border-color: #e6cccc;
		padding: 0.25rem 0.5rem;
	}
	.hint {
		font-size: 0.72rem;
		color: #aaa;
		margin-top: 0.6rem;
	}
</style>
