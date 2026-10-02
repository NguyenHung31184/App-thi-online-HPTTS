# Report: monitoring signals follow the chosen exam or window

- Status: done 2026-10-02.
- Date: 2026-10-02
- Database: none.
- Rollback: `docs/rollback/2026-10-02-report-signals-filter.md`

## Problem

Found during the phase 2 check (`docs/implementation/2026-10-02-phase-2-exam-reporting-module.md`). The "Tín hiệu
giám sát" tab reads `attempt_audit_logs` with `attempts (…)` embedded and filters `attempts.exam_id` /
`attempts.window_id`. On a plain embed PostgREST applies the filter to the embedded row only, so every audit log is
still returned, with `attempts` null when it does not match. PostgREST also stops at 1,000 rows. Result: every exam and
window showed the latest 1,000 signals of all exams (exam QC: 15 attempts, 168 attempts in its signals export).

## Change

`exam-reporting/data/report-repository.ts`, `selectAuditLogs`:

- embed `attempts!inner (…)`, so the exam or window filter removes the other logs;
- read in pages of 1,000 (ordered by `created_at` then `id`) until a short page, so a large exam is not cut off.

The meaning of the filters is unchanged: an exam means `attempts.exam_id` (the exam the student actually took), a window
means `attempts.window_id`. No screen or column changes.

## Checks

`npm test`, `npx tsc -b`, `npm run lint`, `npm run check:boundaries`, `npm run build`. Edge, local build, read only:
for several exams and one window, the signals count drops below 1,000 and every attempt in the signals table belongs to
the chosen exam (compare with the results tab and with a database count).

Result 2026-10-02 (local build, production data), against a direct database count:
exam `780894ea` (QC) 170 signals / 28 attempts (was 1,000 of all exams); exam `95fe144d` 2,276 / 297 (past the old
1,000 cap, about 5 s); window `01311460` 23 / 2; window `6c78d33a` 0 (the database has 0). No page errors.
