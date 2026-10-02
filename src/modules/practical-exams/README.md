# practical-exams

Practical exams: templates with weighted criteria, sessions per class with an access code, the student's evidence
photos, and teacher grading with the TTDT sync of the grade.

- Domain: `grading.ts` (weighted total, slider range, new criterion, when a grade can go to TTDT), `sessions.ts` (time
  check, the student's access to an attempt, labels), `inputs.ts`. Pure, tested.
- Data: `practical_exam_templates`, `practical_exam_criteria`, `practical_exam_sessions`, `practical_attempts`,
  `practical_attempt_photos`, `practical_attempt_scores`, class names from `classes`, `profiles.student_id`. Start and
  submit go through the RPCs `start_practical_attempt` and `submit_practical_attempt`, which check the code, the time,
  the enrollment and the evidence (database tests in `tests/exam-database.test.ts`). Deleting a template, criterion or
  session is a hard delete kept from before the move.
- Storage: evidence photos go to `exam-uploads` through `src/platform/storage/exam-uploads.ts`.
- Application: `templates.ts`, `sessions.ts`, `attempts.ts`; the TTDT sync of a grade goes through `integrations/public`.
- Other modules: `integrations` (classes, a student's classes) through `public.ts`.

See `docs/implementation/2026-10-01-modular-monolith-90-plan.md` (phase 3).
