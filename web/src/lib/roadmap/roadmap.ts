// Typed wrapper around the committed roadmap.json snapshot. Regenerated/
// hand-edited at triage time (see LAUNCH_PLAN.md 4.2) — this module never
// reads the live feedback DB.
import raw from './roadmap.json';
import type { Locale } from '$lib/i18n';
import type { RoadmapSnapshot, RoadmapStatus } from './types';

export const roadmap: RoadmapSnapshot = raw as RoadmapSnapshot;

export const STATUS_ORDER: RoadmapStatus[] = ['shipped', 'building', 'planned'];

/** Maps the app's UI Locale onto the snapshot's plain 'en'/'pt' text keys. */
export function roadmapLocaleKey(locale: Locale): 'en' | 'pt' {
	return locale === 'pt-BR' ? 'pt' : 'en';
}
