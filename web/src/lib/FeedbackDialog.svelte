<script lang="ts">
	import { t } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import { FEEDBACK_MAX_LEN, type FeedbackType } from '$lib/feedback';

	// `open` is bindable so the header button can toggle it. A native <dialog>
	// gives us the modal focus trap, Escape-to-close, and focus-return-to-trigger
	// for free (showModal() is called while the trigger still holds focus).
	let { open = $bindable(false) }: { open?: boolean } = $props();

	const TYPE_OPTIONS: { val: FeedbackType; key: keyof Messages }[] = [
		{ val: 'bug', key: 'feedback.typeBug' },
		{ val: 'idea', key: 'feedback.typeIdea' },
		{ val: 'other', key: 'feedback.typeOther' }
	];

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let type = $state<FeedbackType>('idea');
	let message = $state('');
	let busy = $state(false);
	let error = $state('');
	let sent = $state(false);
	let closeTimer: ReturnType<typeof setTimeout> | undefined;

	const over = $derived(message.length > FEEDBACK_MAX_LEN);
	const canSubmit = $derived(message.trim().length > 0 && !over && !busy);

	function reset() {
		type = 'idea';
		message = '';
		busy = false;
		error = '';
		sent = false;
		clearTimeout(closeTimer);
	}

	// Drive the native dialog from the `open` prop. Resetting on open gives a
	// fresh form each time; el.close() here (when open flips false) fires the
	// native `close` event handled below.
	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (open && !el.open) {
			reset();
			el.showModal();
		} else if (!open && el.open) {
			el.close();
		}
	});

	function onClose() {
		clearTimeout(closeTimer);
		open = false;
	}

	async function submit(e: Event) {
		e.preventDefault();
		if (!canSubmit) {
			if (!message.trim()) error = t('feedback.errEmpty');
			else if (over) error = t('feedback.errTooLong');
			return;
		}
		busy = true;
		error = '';
		try {
			const res = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, message: message.trim(), page: location.pathname })
			});
			if (res.ok) {
				sent = true;
				closeTimer = setTimeout(() => (open = false), 2000);
			} else {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				if (res.status === 400 && over) error = t('feedback.errTooLong');
				else error = data.error ?? t('feedback.errFailed');
			}
		} catch {
			error = t('feedback.errNetwork');
		} finally {
			busy = false;
		}
	}
</script>

<dialog bind:this={dialogEl} class="fb" aria-modal="true" aria-labelledby="fb-title" onclose={onClose}>
	{#if sent}
		<div class="done">
			<div class="check" aria-hidden="true">✓</div>
			<h2 id="fb-title">{t('feedback.successTitle')}</h2>
			<a class="viewlink" href="/feedback" onclick={() => (open = false)}>{t('feedback.viewYours')}</a>
		</div>
	{:else}
		<form onsubmit={submit}>
			<div class="hd">
				<h2 id="fb-title">{t('feedback.title')}</h2>
				<button type="button" class="x" onclick={() => (open = false)} aria-label={t('feedback.close')}>✕</button>
			</div>

			<div class="types" role="radiogroup" aria-label={t('feedback.typeLabel')}>
				{#each TYPE_OPTIONS as opt (opt.val)}
					<button
						type="button"
						role="radio"
						aria-checked={type === opt.val}
						class="seg"
						class:active={type === opt.val}
						onclick={() => (type = opt.val)}
					>
						{t(opt.key)}
					</button>
				{/each}
			</div>

			<textarea
				bind:value={message}
				rows="5"
				placeholder={t('feedback.messagePlaceholder')}
				aria-label={t('feedback.messageLabel')}
				disabled={busy}
			></textarea>

			<div class="row">
				<span class="counter" class:over>{message.length} / {FEEDBACK_MAX_LEN}</span>
				<button type="submit" class="send" disabled={!canSubmit}>
					{busy ? t('feedback.sending') : t('feedback.submit')}
				</button>
			</div>

			{#if error}<p class="err" role="alert">{error}</p>{/if}

			<a class="footlink" href="/feedback" onclick={() => (open = false)}>{t('feedback.viewYours')}</a>
		</form>
	{/if}
</dialog>

<style>
	.fb {
		box-sizing: border-box;
		width: min(440px, calc(100vw - 2rem));
		border: 1px solid var(--hairline-strong);
		border-radius: 14px;
		padding: 1.1rem 1.2rem;
		background: var(--surface);
		color: var(--text);
		font-family: system-ui, sans-serif;
	}
	.fb::backdrop {
		background: rgba(10, 7, 3, 0.55);
	}
	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.8rem;
	}
	h2 {
		font-size: 1.05rem;
		margin: 0;
	}
	.x {
		font: inherit;
		font-size: 1rem;
		line-height: 1;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
	}
	.types {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.7rem;
	}
	.seg {
		flex: 1;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
	}
	.seg.active {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.9rem;
		line-height: 1.45;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		resize: vertical;
		min-height: 110px;
	}
	textarea:focus {
		outline: 2px solid var(--accent-strong);
		outline-offset: 1px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.6rem;
		gap: 0.75rem;
	}
	.counter {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.counter.over {
		color: var(--pill-bug-fg);
		font-weight: 700;
	}
	.send {
		font: inherit;
		font-size: 0.88rem;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1.3rem;
		cursor: pointer;
	}
	.send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.err {
		color: var(--pill-bug-fg);
		font-size: 0.82rem;
		margin: 0.6rem 0 0;
	}
	.footlink {
		display: inline-block;
		margin-top: 0.9rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.done {
		text-align: center;
		padding: 1rem 0.5rem;
	}
	.check {
		width: 44px;
		height: 44px;
		margin: 0 auto 0.6rem;
		border-radius: 999px;
		background: var(--pill-go-bg);
		color: var(--pill-go-fg);
		font-size: 1.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.done h2 {
		margin-bottom: 0.7rem;
	}
	.viewlink {
		font-size: 0.88rem;
		color: var(--accent-strong);
		font-weight: 600;
	}
</style>
