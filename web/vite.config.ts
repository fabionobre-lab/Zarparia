import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),

			// Disable SvelteKit's built-in cross-origin form-POST rejection because
			// the OAuth token/register endpoints and /mcp are legitimately called
			// cross-origin (form-encoded, no Origin header) by MCP clients — the
			// built-in check runs before hooks and would 403 them in production.
			// We re-implement an equivalent origin guard in hooks.server.ts that
			// exempts exactly those API paths, so every same-origin form (e.g. the
			// /oauth/authorize consent action) keeps full CSRF protection.
			csrf: { checkOrigin: false }
		})
	]
});
