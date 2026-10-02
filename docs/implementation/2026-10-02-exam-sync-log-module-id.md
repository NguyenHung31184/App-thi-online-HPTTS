# Theory sync log: `module_id` as text

- Status: written 2026-10-02, waiting for the operator's approval to apply.
- Database: `supabase/migrations/20261002160000_exam_sync_log_module_id_text.sql`.
- Rollback: `docs/rollback/2026-10-02-exam-sync-log-module-id.md`
- Found by: `docs/implementation/2026-10-02-ttdt-resend-and-sync-log-cleanup.md` (step 2).

## Problem

`exam_sync_log.module_id` is `uuid` (`001_mvp_tables.sql`). TTDT module ids are text. `server/exam-sync.ts` writes the
module id into the log after delivering the grade, the insert fails, and the job is finished as failed: it stays
`pending` and the worker (`exam-maintenance`, every minute, active) sends the same grade again with backoff up to an
hour. On 2026-10-02 the 66 resent March–April attempts were at attempt 1–5 within an hour. Every real theory exam
since 2026-09-29 would do the same; there was none.

`practical_sync_log.module_id` is already text. No view, rule or policy depends on the column; the TypeScript types
already use `string`.

## Change

`ALTER COLUMN module_id TYPE text USING module_id::text`. Existing rows keep their values as text.

## Dry run (2026-10-02)

Production, block raising at the end: type became `text`, 13 rows before and after, a row with module id `m07`
inserted; the raise undid everything and the column read back as `uuid`. The `exam-maintenance` cron job is active
(every minute, runs succeeded in the last three days).

## Checks

- Production dry run in a block that raises at the end: column type after the change, row count unchanged.
- After applying: within a few minutes the 66 pending jobs become `success`, 66 `exam_sync_log` rows with status
  `success` appear, and the sync log page shows them.
