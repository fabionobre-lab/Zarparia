// Public entry point for call sites: `import { toast } from '$lib/toast';`
// then `toast('Trip saved.')` or `toast.danger('...', { actionLabel, onAction })`.
export { toast, showToast, dismissToast, activeToast } from './store.svelte';
export type { ToastKind, ToastOptions, ToastState } from './store.svelte';
