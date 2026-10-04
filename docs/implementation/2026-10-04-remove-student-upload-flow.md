# Remove the "student uploads evidence" practical flow from the app

- Status: done 2026-10-04, not pushed. Edge on the local build: admin practical pages open, `/practical/<id>` falls back to the dashboard. The student dashboard was not opened (no student account in the test browser); `tsc` and the build cover it.
- Rollback: `docs/rollback/2026-10-04-remove-student-upload-flow.md`.
- Database: none. The RPCs `start_practical_attempt` and `submit_practical_attempt`, their policies and their database
  tests (`tests/exam-database.test.ts`) stay: they still guard the tables against a student writing a grade.
- Operator request 2026-10-04: remove the screen where a student photographs and hands in their own work, and its code.

## Removed

- `PracticalTakePage` and the route `/practical/:attemptId`.
- The "Thi thực hành đang mở" block of the student dashboard (`src/pages/DashboardPage.tsx`).
- `application/attempts.ts` and `data/attempt-repository.ts` (start, submit, photo upload and delete, slider grading,
  manual TTDT sync), their hooks and their exports from `public.ts`.
- `getAllowedPracticalSessions` and `selectOpenUploadSessions`; the domain helpers only this flow or the old grading
  page used (`studentAttemptBlocker`, `sessionOptionLabel`, `weightedTotal`, `scoresByCriteria`, `scoreRange`,
  `ttdtSyncBlocker`, `canSyncToTtdt`) with their tests; `PhotoOptions`.
- `src/platform/storage/exam-uploads.ts`, whose only caller was the photo upload.

## Kept

Templates, sessions, the results pages, and the server queue that sends locked results to TTDT. Existing
`student_upload` rows (none live) are untouched.

## Checks

`npm test`, `npx tsc -b`, `npm run lint`, `npm run check:boundaries`, `npm run build`, `npm run arch:score`; Edge: the
admin practical pages still open on the local build.
