# Rollback: Phase A P1 database reconciliation

- Baseline: `2b1e542`
- Migration: `20260922110000_reconcile_p1_question_bank.sql`

## Code recovery

Revert the dedicated Phase A commit with `git revert <sha>`.

## Database recovery

This migration only adds schema, indexes, policies, a private storage bucket, and safe library links. Do not drop the added objects in production because imported data and question history may exist.

If the migration produces an application issue:

1. Disable document import with `VITE_DOCUMENT_IMPORT_ENABLED=0`.
2. Keep existing question-bank records and attempts untouched.
3. Apply a forward repair migration that restores the earlier RLS policies or function definition from `20260920100000_p0_secure_exam_attempts.sql`.
4. Validate exam start and answer saving before re-enabling the affected UI.
