<script lang="ts">
	// Email+password sign-in, shown under the Google button on the signed-out
	// landing card only when Firebase is provisioned (see $lib/firebase.ts).
	// Identity (password checks, verification email, reset email) is entirely
	// Firebase's job; this component's only job with our own backend is
	// POSTing the resulting ID token to /auth/login/firebase, which mints our
	// usual D1 session. firebase/app and firebase/auth are dynamic-imported so
	// the SDK never lands in the main bundle for Google-only visitors.
	import { t } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';

	type Mode = 'signin' | 'signup' | 'reset';
	type ErrorKey = Extract<keyof Messages, `authEmail.err${string}`>;

	let mode = $state<Mode>('signin');
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let errorKey = $state<ErrorKey | ''>('');
	let verifyNotice = $state(false);
	let resendBusy = $state(false);
	let resendSent = $state(false);
	let signupSuccess = $state(false);
	let resetSent = $state(false);

	const showForm = $derived(!verifyNotice && !signupSuccess && !resetSent);
	const errorMessage = $derived(errorKey ? t(errorKey) : '');

	/** Maps a Firebase Auth error code (or an unknown/absent one) to an i18n key. */
	function friendlyError(code: unknown): ErrorKey {
		switch (code) {
			case 'auth/invalid-email':
				return 'authEmail.errInvalidEmail';
			case 'auth/email-already-in-use':
				return 'authEmail.errEmailInUse';
			case 'auth/weak-password':
				return 'authEmail.errWeakPassword';
			case 'auth/wrong-password':
			case 'auth/user-not-found':
			case 'auth/invalid-credential':
			case 'auth/missing-password':
				return 'authEmail.errBadCredentials';
			case 'auth/too-many-requests':
				return 'authEmail.errTooManyRequests';
			default:
				return 'authEmail.errGeneric';
		}
	}

	function resetTransientState() {
		errorKey = '';
		verifyNotice = false;
		resendSent = false;
		signupSuccess = false;
		resetSent = false;
	}

	function switchMode(next: Mode) {
		mode = next;
		password = '';
		resetTransientState();
	}

	async function handleSignin(e: Event) {
		e.preventDefault();
		resetTransientState();
		busy = true;
		try {
			const { getFirebaseAuth } = await import('$lib/firebase');
			const { signInWithEmailAndPassword } = await import('firebase/auth');
			const auth = await getFirebaseAuth();
			const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
			const idToken = await cred.user.getIdToken();
			const res = await fetch('/auth/login/firebase', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			});
			if (res.ok) {
				window.location.reload();
				return;
			}
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			if (body.error === 'email_unverified') {
				verifyNotice = true;
			} else {
				errorKey = 'authEmail.errGeneric';
			}
		} catch (err) {
			errorKey = friendlyError((err as { code?: string })?.code);
		} finally {
			busy = false;
		}
	}

	async function handleSignup(e: Event) {
		e.preventDefault();
		resetTransientState();
		busy = true;
		try {
			const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
			const { getFirebaseAuth } = await import('$lib/firebase');
			const auth = await getFirebaseAuth();
			const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
			try {
				await sendEmailVerification(cred.user);
			} catch {
				// Best-effort — the account still exists even if the verification
				// email failed to send; the user can resend from the sign-in form.
			}
			signupSuccess = true;
		} catch (err) {
			errorKey = friendlyError((err as { code?: string })?.code);
		} finally {
			busy = false;
		}
	}

	async function handleReset(e: Event) {
		e.preventDefault();
		resetTransientState();
		busy = true;
		try {
			const { sendPasswordResetEmail } = await import('firebase/auth');
			const { getFirebaseAuth } = await import('$lib/firebase');
			const auth = await getFirebaseAuth();
			try {
				await sendPasswordResetEmail(auth, email.trim());
			} catch (err) {
				// Enumeration-safe: user-not-found still shows the same neutral
				// success message as a real account would get.
				if ((err as { code?: string })?.code !== 'auth/user-not-found') throw err;
			}
			resetSent = true;
		} catch (err) {
			errorKey = friendlyError((err as { code?: string })?.code);
		} finally {
			busy = false;
		}
	}

	async function resendVerification() {
		resendBusy = true;
		try {
			const { sendEmailVerification } = await import('firebase/auth');
			const { getFirebaseAuth } = await import('$lib/firebase');
			const auth = await getFirebaseAuth();
			if (auth.currentUser) {
				await sendEmailVerification(auth.currentUser);
				resendSent = true;
			}
		} catch {
			// Best-effort — no dedicated error UI for a resend action.
		} finally {
			resendBusy = false;
		}
	}

	function onSubmit(e: Event) {
		if (mode === 'signin') return handleSignin(e);
		if (mode === 'signup') return handleSignup(e);
		return handleReset(e);
	}

	const submitLabel = $derived(
		mode === 'signin' ? t('authEmail.signInSubmit') : mode === 'signup' ? t('authEmail.signUpSubmit') : t('authEmail.resetSubmit')
	);
</script>

<div class="divider" role="separator"><span>{t('landing.orDivider')}</span></div>

<form class="email-form" onsubmit={onSubmit}>
	{#if verifyNotice}
		<p class="notice">{t('authEmail.verifyNotice')}</p>
		<button type="button" class="resend-btn" onclick={resendVerification} disabled={resendBusy}>
			{resendSent ? t('authEmail.resendSent') : t('authEmail.resend')}
		</button>
	{:else if signupSuccess}
		<p class="notice success">{t('authEmail.signupSuccess')}</p>
	{:else if resetSent}
		<p class="notice success">{t('authEmail.resetSent')}</p>
	{:else}
		<label class="field"
			>{t('authEmail.email')}
			<input type="email" bind:value={email} required autocomplete="email" />
		</label>
		{#if mode !== 'reset'}
			<label class="field"
				>{t('authEmail.password')}
				<input
					type="password"
					bind:value={password}
					required
					autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
					minlength={mode === 'signup' ? 6 : undefined}
				/>
			</label>
		{/if}
		{#if errorMessage}<p class="err">{errorMessage}</p>{/if}
		<button type="submit" class="submit-btn" disabled={busy}>
			{busy ? t('authEmail.working') : submitLabel}
		</button>
	{/if}
</form>

<div class="mode-links">
	{#if showForm && mode === 'signin'}
		<button type="button" onclick={() => switchMode('signup')}>{t('authEmail.linkCreateAccount')}</button>
		<span aria-hidden="true">·</span>
		<button type="button" onclick={() => switchMode('reset')}>{t('authEmail.linkForgotPassword')}</button>
	{:else}
		<button type="button" onclick={() => switchMode('signin')}>{t('authEmail.linkBackToSignIn')}</button>
	{/if}
</div>

<style>
	.divider {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.9rem 0;
		color: var(--text-muted);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--hairline);
	}
	.email-form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.field input {
		font: inherit;
		font-size: 0.9rem;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: 8px;
		padding: 0.55rem 0.65rem;
		box-sizing: border-box;
	}
	.field input:focus-visible {
		outline: 2px solid var(--accent-strong);
		outline-offset: 1px;
	}
	.submit-btn {
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		color: #fff;
		background: var(--accent);
		border: none;
		border-radius: 10px;
		padding: 0.65rem 1rem;
		cursor: pointer;
	}
	.submit-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	@media (prefers-reduced-motion: no-preference) {
		.submit-btn {
			transition:
				transform 0.1s ease,
				background 0.15s ease;
		}
		.submit-btn:active:not(:disabled) {
			transform: scale(0.98);
		}
	}
	.err {
		font-size: 0.78rem;
		color: var(--pill-bug-fg);
		margin: 0;
	}
	.notice {
		font-size: 0.85rem;
		color: var(--text);
		background: var(--surface-sunken);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		margin: 0 0 0.6rem;
		line-height: 1.4;
	}
	.notice.success {
		color: var(--pill-go-fg);
		background: var(--pill-go-bg);
	}
	.resend-btn {
		font: inherit;
		font-size: 0.82rem;
		color: var(--accent-strong);
		background: none;
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}
	.resend-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.mode-links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 0.75rem;
		font-size: 0.78rem;
	}
	.mode-links button {
		font: inherit;
		font-size: inherit;
		color: var(--text-muted);
		background: none;
		border: none;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 0.15em;
		cursor: pointer;
	}
	.mode-links button:hover {
		color: var(--accent-strong);
	}
	.mode-links span {
		color: var(--text-muted);
	}
</style>
