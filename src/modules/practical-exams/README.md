# practical-exams

Practical exams graded in the field. The admin prepares everything here: templates (steps, time bands, criteria with
quick deductions, by hand or from an Excel or Word file) and sessions (a template for a class). Examiners grade in Sổ
chuyên cần; this module then shows the results, read only, refreshed every 10 s. The server queue sends locked results
to TTDT (`server/exam-sync.ts`).

- Domain: `field-config.ts` (steps, time bands, deductions, totals), `template-import.ts` (Excel and Word to a draft),
  `results.ts` (a student's state, the shift summary), `sessions.ts`, `grading.ts`, `inputs.ts`. Pure, tested.
- Data: `practical_exam_templates`, `practical_exam_criteria`, `practical_exam_sessions`, `practical_attempts`,
  `practical_attempt_photos`, `practical_attempt_scores`, class names from `classes`, students through `enrollments`.
  Templates, criteria and sessions are soft-deleted (`is_deleted`). One live session per class, template and mode.
- Storage: field photos are paths in `exam-uploads` (`practical-field/<attempt>/`), opened with signed URLs.
- Application: `templates.ts`, `import-template.ts`, `sessions.ts`, `results.ts`; `attempts.ts` is the old flow.
- UI: `TemplatesPage`, `template-form/`, `template-import/`, `SessionsPage`, `SessionFormPage`, `results/`.
- Old flow, kept but unreachable: the student uploads evidence (`PracticalTakePage`, RPCs `start_practical_attempt`
  and `submit_practical_attempt`). No `student_upload` session can be created from the UI any more.
- Other modules: `integrations` (classes, modules) and `question-bank` (docx reader) through `public.ts`.

See `docs/implementation/2026-10-01-modular-monolith-90-plan.md` (phase 3).
