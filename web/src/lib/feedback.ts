// Client-safe feedback types, constants, and validators. Shared by the browser
// components and the server lib ($lib/server/feedback.ts). Kept OUT of
// $lib/server so the dialog/page can import the runtime values (SvelteKit
// forbids importing server-only modules into client code except as types).

export type FeedbackType = 'bug' | 'idea' | 'other';
export type FeedbackStatus = 'new' | 'planned' | 'done' | 'dismissed';

export const FEEDBACK_TYPES: FeedbackType[] = ['bug', 'idea', 'other'];
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['new', 'planned', 'done', 'dismissed'];
export const FEEDBACK_MAX_LEN = 2000;

/** One feedback submission (own-items view). */
export interface FeedbackRow {
	id: string;
	type: FeedbackType;
	message: string;
	page: string | null;
	locale: string | null;
	status: FeedbackStatus;
	createdAt: number;
	updatedAt: number;
}

/** A submission joined with its submitter (admin view). */
export interface FeedbackAdminRow extends FeedbackRow {
	userId: string;
	userName: string | null;
	userEmail: string;
}

export interface FeedbackInput {
	type: FeedbackType;
	message: string;
	page?: string | null;
	locale?: string | null;
}

export function isFeedbackType(v: unknown): v is FeedbackType {
	return v === 'bug' || v === 'idea' || v === 'other';
}

export function isFeedbackStatus(v: unknown): v is FeedbackStatus {
	return v === 'new' || v === 'planned' || v === 'done' || v === 'dismissed';
}
