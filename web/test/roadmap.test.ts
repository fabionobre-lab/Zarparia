// Phase 4 — public roadmap (LAUNCH_PLAN.md 4.2). The roadmap is a committed
// JSON snapshot, not a live DB read — nothing here talks to D1. Asserts the
// structural invariants that keep the snapshot trustworthy: valid statuses,
// unique ids, and full bilingual text (the whole point of the 'en'/'pt'
// RoadmapText shape is that no half-translated item can reach the page).
import { describe, expect, it } from 'vitest';
import { roadmap } from '../src/lib/roadmap/roadmap';
import type { RoadmapStatus } from '../src/lib/roadmap/types';

const VALID_STATUSES: RoadmapStatus[] = ['shipped', 'building', 'planned'];

describe('roadmap snapshot', () => {
	it('has a valid ISO "updated" date', () => {
		expect(roadmap.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(Number.isNaN(new Date(roadmap.updated).getTime())).toBe(false);
	});

	it('has at least one item', () => {
		expect(roadmap.items.length).toBeGreaterThan(0);
	});

	it('gives every item a valid status', () => {
		for (const item of roadmap.items) {
			expect(VALID_STATUSES, `${item.id} status`).toContain(item.status);
		}
	});

	it('has unique item ids', () => {
		const ids = roadmap.items.map((it) => it.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('gives every item both an English and a Portuguese title', () => {
		for (const item of roadmap.items) {
			expect(item.title.en.trim().length, `${item.id} title.en`).toBeGreaterThan(0);
			expect(item.title.pt.trim().length, `${item.id} title.pt`).toBeGreaterThan(0);
		}
	});

	it('gives every note both languages, when a note is present', () => {
		for (const item of roadmap.items) {
			if (!item.note) continue;
			expect(item.note.en.trim().length, `${item.id} note.en`).toBeGreaterThan(0);
			expect(item.note.pt.trim().length, `${item.id} note.pt`).toBeGreaterThan(0);
		}
	});

	it('has at least one shipped and one planned item', () => {
		// 'building' is deliberately excluded: it's fine for the snapshot to have
		// zero in-progress items when everything in flight has just shipped —
		// unlike shipped/planned, which should never both be empty on a real roadmap.
		for (const status of ['shipped', 'planned'] as RoadmapStatus[]) {
			expect(
				roadmap.items.some((it) => it.status === status),
				`at least one ${status} item`
			).toBe(true);
		}
	});
});
