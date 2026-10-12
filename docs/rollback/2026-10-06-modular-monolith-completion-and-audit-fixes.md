# Rollback: modular monolith completion and the six audit fixes (2026-10-06 block)

The block is three commits made on 2026-10-12 from work done on 2026-10-06: the migration and database tests, the
code, the documents. Implementation: `docs/implementation/2026-10-06-modular-monolith-completion.md`,
`docs/implementation/2026-10-06-audit-fixes.md`.

## Order matters

The new frontend calls functions that exist only after `20261006151544_exam_audit_fixes.sql`
(`get_attempt_review_questions`, `get_browser_proctoring_state` and the functions behind them). The migration also
replaces the insert policy of `attempt_audit_logs`: the frontend from before this block writes browser violations
straight into that table and is refused after the migration. Migration and frontend go to production together, and
come back together.

## Before the migration is applied

Code only: `git revert --no-edit <docs> <code> <migration>` (newest first) and push, or promote the previous Vercel
deployment (`10b9943`). Nothing in the database to undo.

## After the migration is applied

1. Frontend broken, database fine: promote the previous Vercel deployment only as a stopgap. With the old frontend,
   exams still run and submit, but browser violations (tab switch, leaving full screen) are no longer recorded. Fix
   forward, or continue with step 2.
2. To run the old frontend properly, restore the old insert policy (forward repair, in one transaction):

```sql
DROP POLICY IF EXISTS "attempt_audit_logs_student_insert" ON public.attempt_audit_logs;
-- then re-create it with the body from the migration that last defined it before 20261006151544
-- (search supabase/migrations for "attempt_audit_logs_student_insert").
```

3. Keep `exam_private.browser_proctoring`, the essay guards and the review functions. They do not affect the old
   frontend. Do not drop the counter table, audit logs or exam paper snapshots: they are exam records.
4. The essay triggers refuse publishing an essay question without a valid marking key. If they block real work:
   `DROP TRIGGER guard_published_essay ON public.question_bank;` and
   `DROP TRIGGER guard_attempt_essay_keys ON exam_private.attempt_papers;`.

## Not part of this block

The identity-card scan changes (`.env.example`, `api/scan-id-card.ts`, `api/_lib/`, `ocr-proxy.ts`, `ocr-image.ts`)
were left uncommitted on purpose on 2026-10-12.
