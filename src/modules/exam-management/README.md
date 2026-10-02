# exam-management

Exams and exam windows for staff: exam list and form, blueprint, lock and unlock, the bank check page of an exam, and
windows (class, time, access code, attempts, trial, proctoring mode).

- Domain: `exam-inputs.ts` — input types, default rows, the displayed exam of a multi-exam window, draw counting. Pure, tested.
- Data: `exams`, `exam_windows`, and `attempts.question_ids` for draw frequency. Deleting a window and "Xóa báo cáo thi thử"
  are hard deletes kept from before the move (see `docs/implementation/2026-10-02-phase-1b-exam-management-module.md`).
- Application: `manage-exams.ts` (lock checks the blueprint through `question-bank`), `manage-windows.ts` (open windows
  for a student come from `exam-taking`), `bank-check.ts`.
- Other modules: `question-bank` (blueprint check, module questions) and `exam-taking` (available windows), through
  their `public.ts` only. Question bank logic stays in `question-bank`.

See `docs/implementation/2026-10-01-modular-monolith-90-plan.md` (phase 1).
