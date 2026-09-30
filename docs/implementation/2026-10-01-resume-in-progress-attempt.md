# Resume the open attempt when a student enters an exam again

- Status: committed 2026-09-30; migration dry run passed on production, waiting for the operator's approval to apply.
- Date: 2026-09-30
- Database: `supabase/migrations/20260930160000_resume_in_progress_attempt.sql` (replaces `start_exam_attempt`), applied
  only after a self-rolling-back dry run and the operator's approval.
- Rollback: `docs/rollback/2026-10-01-resume-in-progress-attempt.md`
- Operator, 2026-09-30: "Tiếp tục lượt đang làm".

## Problem (found in the trial exam of 2026-09-30)

A student who closes the browser and enters the window again with the access code gets a new attempt: new questions,
a new timer, and the old attempt stays `in_progress`. `start_exam_attempt` always inserts. In a real window (2 attempts)
the student loses the retake; in a trial or unlimited window the student can restart to draw another paper. Reproduced
on production: attempts `ca581262…` and `26b2d6f6…` of the test student were both `in_progress` in trial window
`01311460…`. The live monitor shows the latest attempt only, so the first one was hidden while disconnected.

## Change

`start_exam_attempt(p_window_id, p_access_code)` keeps every check it had (sign-in, window open, class enrollment,
access-code rate limit, wrong code) and, before the attempt limit and the draw:

- takes the caller's latest `in_progress` attempt of the window (`FOR UPDATE`, under the existing advisory lock);
- if its deadline (`exam_private.attempt_deadline`) has not passed, returns it: same questions (the stored paper),
  saved answers and original timer;
- if the deadline has passed, finishes it with `finalize_exam_attempt` (grades the saved answers, as the maintenance
  worker would) and continues as before: attempt limit, draw, insert.

The body is the production definition read on 2026-09-30 (same as
`20260924094701_draw_exclude_duplicate_content.sql`) plus that block. Grants unchanged (`authenticated` only).
No client change: the dashboard already opens `/exam/<returned id>`.

## Checks

- `tests/exam-database.test.ts` (PGlite): entering twice before the deadline returns the same attempt with one paper
  and the saved answers; after the deadline the old attempt is graded and a new one starts; a real window at its limit
  still refuses; a wrong code is refused even with an open attempt.
- Production dry run in a block that raises at the end; then, after approval, apply and record the version.
- Edge: enter, answer, close the window, enter again with the code → same attempt id, answers kept, timer not reset.

## Results (2026-09-30)

- `tests/exam-database.test.ts` 26/26 (4 new).
- Production dry run (block raising at the end, nothing kept), as the test student in trial window `01311460…` before
  the open attempt's deadline: both calls returned `ca581262…`, attempts stayed at 2, `anon` has no execute right; after
  the run the production function was still the old one.
