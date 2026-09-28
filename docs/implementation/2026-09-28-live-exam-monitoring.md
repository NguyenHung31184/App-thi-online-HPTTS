# Live exam monitoring on the admin dashboard

- Status: migration applied 2026-09-28 after the operator's approval (CLI `db query --linked`, version recorded in
  `supabase_migrations.schema_migrations`); code `8039e86` pushed the same day.
- Date: 2026-09-28
- Database: `supabase/migrations/20260928120000_live_exam_monitoring.sql` (shared project `vmtztbmlzszuxkglubro`), applied
  only after a dry run and the operator's approval.
- Rollback: `docs/rollback/2026-09-28-live-exam-monitoring.md`
- Operator decisions, 2026-09-28: connection signal in a new column; 5–10 students per class with those needing attention
  first; refresh every 15 s; replace "Bài làm gần đây (đã nộp)" on the dashboard; group by class when several classes sit.

## Problem

Staff only see an exam after it ends: the dashboard lists submitted attempts. During a sitting nobody sees who is taking
the exam, who dropped off, or who is collecting violations, although the violation events are already written to
`attempt_audit_logs` as they happen. A student reading a question without answering and a student whose laptop lost the
network look the same, because nothing tells the server the page is still open.

## Change

Database (one migration):

- `attempts.last_seen_at timestamptz`, null for past attempts.
- `touch_attempt(p_attempt_id uuid)`: sets `last_seen_at = now()` on the caller's own in-progress attempt, nothing else.
  `SECURITY DEFINER`, `authenticated` only.
- `get_live_exam_monitor()`: one row per attempt of every window that is open now or closed less than 30 minutes ago:
  class, exam, trial flag, window end, student code and name, status, start and submit time, `last_seen_at`, answered and
  total questions, violation count, last violation and its time, disqualified, and the number of students enrolled in
  the class, and the seconds since the last signal and the last violation, computed on the server clock so a wrong clock
  on the proctor's computer cannot turn students "disconnected". Violations are the 7 events the exam page counts toward auto-submit: `visibility_hidden`, `focus_lost`,
  `fullscreen_exited`, `ai_no_face`, `ai_multiple_face`, `ai_cell_phone`, `ai_prohibited_object`. `SECURITY DEFINER`,
  raises 42501 unless `get_my_exam_role()` is `admin`, `teacher` or `proctor`.

Exam taking (`src/modules/exam-taking`):

- The exam page calls `touch_attempt` on start and every 20 s while the attempt is in progress.

New module `src/modules/exam-monitoring`:

- `domain/live-status.ts`: pure functions. Status per attempt: disqualified → "Đã hủy bài"; completed → "Đã nộp"; in
  progress with no signal for more than 60 s → "Mất kết nối"; in progress with violations → "Có vi phạm"; otherwise
  "Đang làm". Attention order: Mất kết nối, Có vi phạm, Đang làm, Đã hủy bài, Đã nộp; ties by most violations, then
  name. Grouping by class with counts per status and "chưa vào thi" (enrolled minus attempts).
- `data`, `queries`: the RPC, refetched every 15 s.
- `ui/LiveExamMonitor.tsx`: one block per class (several windows of the same class share it); the first 8 students,
  "Xem cả lớp" shows the rest; empty state when no window is open.

Dashboard: the monitor goes right below the stat cards (during a sitting it is the first thing a proctor needs);
"Bài làm gần đây (đã nộp)" and its now unused component `DashboardRecentAttemptsTable` are removed. The charts built
from recent attempts stay.

## Card layout from the operator's sample (2026-09-28)

The operator sent a screenshot (student cards in a 3-column grid under a tab "Tự do (9/9)"). Per DESIGN.md section 0 the
"take / change / drop" list was confirmed first:

- Take: 3-column card grid (1 column on phones), round avatar with initials (first and last word), name, one sub-line,
  label–value rows; tabs with a counter.
- Change: one tab per class, counter = finished/started, "· n cần chú ý" in amber; sub-line "Điểm: 7.6 (Lần thi: 1)" when
  finished, "Đã trả lời 32/50 câu (Lần thi: 1)" while in progress; status under the name in the status colors (the sample
  shows a normal "Đang Thi" in red, which the app reserves for errors); rows: Thời gian làm bài, Thời gian nộp bài, Vi phạm,
  Tín hiệu cuối or "Xem bài"; white cards, border in the status color for students needing attention.
- Drop: "Nhận xét" with its pen button (no comment feature exists).
- 6 cards per tab before "Xem cả lớp" (operator's choice).
- Migration `20260928150000_live_monitor_score.sql` (approved, dry run then applied): the function also returns `score`
  and `attempt_number` (nth attempt of the student in the same window). Dry run: a retake showed 2 and its score 0.76;
  grants unchanged.
- Running "Thời gian làm bài" uses the time of the last refresh on the proctor's computer; it is display only, the
  status still comes from server-side seconds.

## Checks (2026-09-28)

- Migration dry run on production (Supabase CLI `db query --linked`, block that raises at the end, run 3 times, nothing
  kept): a test trial window with two attempts; the simulated student set `last_seen_at` on their own attempt and not on
  the other student's; admin read 2 rows with answered 2/3, violations 2 (`photo_taken` not counted), last violation and
  both elapsed-seconds columns; the student calling the monitor got 42501; `anon` has no execute right on either function.
- `npm test` 41/41 (6 new for status, order, grouping, retakes, time text), `check:boundaries`, `tsc -b`, lint 0 errors,
  `npm run build` pass.
- After deploy: the rehearsal (trial window, test student) shows the student as "Đang làm", then "Mất kết nối" after
  closing the tab, then "Đã nộp".
