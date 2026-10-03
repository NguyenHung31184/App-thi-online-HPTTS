# One live field-grading session per class and template

- Status: applied on production 2026-10-03 after operator approval (dry run first); version recorded.
- Rollback: `docs/rollback/2026-10-03-practical-session-unique-live.md`.
- Database: `supabase/migrations/20261003120000_practical_session_unique_live.sql`.

## Problem

`practical_exam_sessions_class_template_mode_unique` (a table constraint created outside this repo's migrations) covers
soft-deleted rows. After a session is soft-deleted, Sổ chuyên cần cannot open a new one for the same class and template:
the insert fails with 23505 and the retry finds no live session. Two classes are in this state (the stray sessions of
02/10, not RTG Khóa 43).

## Change

Drop the constraint; create a unique index of the same name on `(class_id, template_id, mode) WHERE is_deleted = false`.
No code uses the constraint with `onConflict` (checked in App thi, Sổ chuyên cần, TTDT). The 23505 handling in Sổ chuyên
cần stays valid for two devices racing on a live session.

## Dry run (self-rolling-back DO block, production)

After the change a session can be added for a class whose only session is soft-deleted, and a second live session for
the same class, template and mode still fails with `unique_violation`.
