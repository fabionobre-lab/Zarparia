// Shared shape for the public roadmap snapshot (Phase 4, LAUNCH_PLAN.md).
// The snapshot (roadmap.json) is a committed, hand-edited/regenerated-at-
// triage-time file — nothing here ever reads the live feedback DB, which is
// the whole point: only admin-triaged items can ever go public.
export type RoadmapStatus = 'shipped' | 'building' | 'planned';

/** Bilingual text pair. Deliberately 'en'/'pt' (not the app's 'en-GB'/'pt-BR'
 *  Locale codes) — this is a plain data snapshot, not part of the UI i18n
 *  catalog; lib/roadmap/roadmap.ts maps the app Locale onto these keys. */
export interface RoadmapText {
	en: string;
	pt: string;
}

export interface RoadmapItem {
	/** Stable identifier — asserted unique in tests. */
	id: string;
	title: RoadmapText;
	status: RoadmapStatus;
	note?: RoadmapText;
}

export interface RoadmapSnapshot {
	/** ISO date the snapshot was last regenerated/hand-edited. */
	updated: string;
	items: RoadmapItem[];
}
