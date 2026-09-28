# exam-monitoring

Live view of exams in progress for staff: who is taking the exam, who lost the connection, who is collecting violations.

- Data: RPC `get_live_exam_monitor()` (migration `20260928120000_live_exam_monitoring.sql`), exam role admin, teacher or
  proctor. The exam page feeds `attempts.last_seen_at` through `touch_attempt` (module `exam-taking`).
- Domain: `live-status.ts` decides the status of an attempt and groups attempts by class. Pure, tested.
- UI: `LiveExamMonitor`, on the admin dashboard.

See `docs/implementation/2026-09-28-live-exam-monitoring.md`.
