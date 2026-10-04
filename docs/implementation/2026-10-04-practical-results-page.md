# "Kết quả thực hành": a read-only, self-refreshing results page

- Status: done 2026-10-04, not pushed; checked in Edge on the local build (test class session, refresh every 10 s).
- Rollback: `docs/rollback/2026-10-04-practical-results-page.md`.
- Database: none.
- Operator decision 2026-10-04: replace the old "Chấm thực hành" page; follow the exam day like the theory monitor.

## Why

"Chấm thực hành" belonged to the old flow (students upload photos, a teacher scores each criterion with a slider, then
presses "Đồng bộ sang TTDT"). Grading now happens in Sổ chuyên cần. The old page listed attempts by an 8-character
user id, and saving its sliders would overwrite a result locked in the field.

## Change

- `/admin/practical-grading` becomes "Kết quả thực hành": choose a session; a summary (students, done, being graded,
  waiting, passed, not passed, without protective equipment, waiting to be sent) and one row per enrolled student with
  state, score out of 100 and 10, pass or not, and whether TTDT has it. While a student is being graded the row shows
  the provisional total saved so far. Refreshed every 10 s while the page is visible (the method of the theory
  monitor: React Query `refetchInterval`).
- `/admin/practical-grading/:attemptId` becomes the read-only result of one student: each criterion with its score and
  the deductions taken, cycle times, protective equipment, the disqualifying fault, photos (signed URLs), examiner and
  lock time.
- Removed: the slider grading page, its "Đồng bộ sang TTDT" button and the hooks only it used. The server queue sends
  results. The student upload page was removed the same day (`2026-10-04-remove-student-upload-flow.md`).
- New pure functions in `domain/results.ts` with tests.

## Checks

`npm test`, `npx tsc -b`, `npm run lint`, `npm run check:boundaries`, `npm run build`; Edge: the test class session
shows its three test students with the results of 02/10, and the detail page shows deductions, cycles and photos.
