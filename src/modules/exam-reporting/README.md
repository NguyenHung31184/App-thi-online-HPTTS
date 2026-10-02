# exam-reporting

History of finished theory exams for staff: the admin dashboard, the theory report (results and monitoring signals of
an exam or a window, Excel export, AI incident review) and one attempt's result with its answers and PDF print.
Live monitoring of running exams stays in `exam-monitoring`; the dashboard embeds it through that module's `public.ts`.

- Domain: `report-rows.ts` (AI risk points, display names, evidence frames, signals per attempt, search, Excel rows),
  `report-filters.ts`, `dashboard-stats.ts`, `recent-attempts.ts`, `attempt-review.ts` (answer labels, right or wrong per
  question type, the rounded pass rule). Pure, tested.
- Data: reads `attempts`, `attempt_audit_logs`, `exam_windows`, `exams`, `exam_sync_log`, `question_bank`, the legacy
  `questions` table (old attempts, read only), and names from `profiles`, `students`, `classes` (a read model of its
  own). Signs evidence and start photos in `exam-uploads` on every read. Writes only through the RPC
  `review_ai_proctoring_incident`.
- Application: `attempt-report.ts`, `dashboard.ts`, `attempt-result.ts`.
- Other modules: `exam-management` (exams, windows) and `integrations` (class names) for the report filters,
  `exam-monitoring` for the live board, all through `public.ts`.

Known issue, kept from before the move: the signals tab does not filter by exam or window and stops at 1,000 rows
(see `docs/implementation/2026-10-02-phase-2-exam-reporting-module.md`).

See `docs/implementation/2026-10-01-modular-monolith-90-plan.md` (phase 2).
