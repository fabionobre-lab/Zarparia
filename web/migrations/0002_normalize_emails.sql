-- Normalize existing user emails to trimmed lowercase, so lookups (e.g. sharing)
-- match the values written by upsertGoogleUser going forward.

UPDATE users SET email = lower(trim(email));
