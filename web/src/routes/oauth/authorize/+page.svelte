<script lang="ts">
	import { t } from '$lib/i18n/store.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const clientLabel = $derived(data.clientName || t('consent.genericClient'));
</script>

<div class="panel">
	<h1>{t('consent.heading', { client: clientLabel })}</h1>
	<p class="account">{t('consent.account', { account: data.account })}</p>
	<p class="scope">{t('consent.scope')}</p>

	<form method="POST">
		<input type="hidden" name="client_id" value={data.params.client_id} />
		<input type="hidden" name="redirect_uri" value={data.params.redirect_uri} />
		<input type="hidden" name="code_challenge" value={data.params.code_challenge} />
		<input type="hidden" name="code_challenge_method" value={data.params.code_challenge_method} />
		<input type="hidden" name="scope" value={data.params.scope} />
		<input type="hidden" name="state" value={data.params.state} />
		<input type="hidden" name="resource" value={data.params.resource} />

		<div class="actions">
			<button class="btn deny" type="submit" formaction="?/deny">{t('consent.deny')}</button>
			<button class="btn approve" type="submit" formaction="?/approve">{t('consent.approve')}</button>
		</div>
	</form>
</div>

<style>
	.panel {
		max-width: 430px;
		margin: 3rem auto;
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: 12px;
		padding: 1.6rem 1.4rem;
		font-family: system-ui, sans-serif;
	}
	h1 {
		font-size: 1.2rem;
		line-height: 1.35;
		margin-bottom: 0.8rem;
		color: var(--accent-strong);
	}
	.account {
		font-size: 0.9rem;
		color: var(--text);
		margin-bottom: 0.3rem;
	}
	.scope {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin-bottom: 1.4rem;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
	}
	.btn {
		font-size: 0.9rem;
		font-family: inherit;
		cursor: pointer;
		border-radius: 8px;
		padding: 0.55rem 1.1rem;
		border: 1px solid var(--hairline-strong);
	}
	.deny {
		background: var(--surface);
		color: var(--text);
	}
	.approve {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
</style>
