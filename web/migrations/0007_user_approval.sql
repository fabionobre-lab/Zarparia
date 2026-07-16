-- Phase 3: new-user approval gate. Every new sign-in lands as 'pending' until
-- an admin approves it (see upsertGoogleUser / requireUser). Existing rows
-- predate the gate, so they are backfilled as already approved below.
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN approved_at TEXT;

UPDATE users SET status = 'approved', approved_at = datetime('now');
