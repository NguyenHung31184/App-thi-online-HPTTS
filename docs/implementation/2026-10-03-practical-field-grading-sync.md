# Practical grades from Sổ chuyên cần through the server queue

- Status: migration applied 2026-10-02 after a dry run and the operator's approval; code not pushed yet (needed before
  the first field grading).
- Database: `supabase/migrations/20261003090000_practical_field_grading_sync.sql`.
- Rollback: `docs/rollback/2026-10-03-practical-field-grading-sync.md`
- Plan: `So_chuyen_can/docs/implementation/2026-10-02-ke-hoach-cham-thuc-hanh-va-modular.md` (B0). Deadline: RTG
  Khóa 43 practical exam on 2026-10-09.

## Problem

Sổ chuyên cần (SCC) grades practical exams at the site. The student has no exam app account, so SCC put the TTDT
`students.id` into `practical_attempts.user_id`. Since 2026-09-29 the queue treats `user_id` as an exam app account:
it finds no profile, and `prepareSync` refuses the attempt ("Thiếu mã mô-đun, lớp hoặc học viên"), forever. SCC also
writes `grade_details.practical_exam_score` from the browser, so TTDT never recomputes the module's final score.
TTDT `students.id` is text (10 of 186 are not uuids).

## Change

- `practical_attempts.student_id text` (TTDT student id); `user_id` may be null when `student_id` is set (check
  constraint); status `not_eligible` for a student without protective equipment (not queued, nothing sent).
- `practical_exam_templates.pass_score` (0–100, default 70; the RTG test passes from 70).
- Queue trigger: a practical attempt's student is `student_id`, else the profile of `user_id`.
- `server/exam-sync.ts`: same order, and for practical attempts with no profile the old SCC `user_id`. Practical
  totals are on 100: TTDT gets `total / 10` (one decimal), `passed` when total ≥ `pass_score`, 0 and not passed when
  disqualified. Before this, practical totals went to TTDT unscaled and passed meant "more than 0".
- SCC stops writing `grade_details` (its new screen, B2).

## Checks

- `tests/exam-database.test.ts`: a field-graded attempt is queued under `practical:<student>:<class>:<module>`; a
  `not_eligible` one is not; an attempt with neither owner is refused.
- `server/exam-sync.test.ts`: 82/100 goes as 8.2, passed; disqualified goes as 0, not passed.
- Production dry run in a block that raises at the end; apply after approval.
