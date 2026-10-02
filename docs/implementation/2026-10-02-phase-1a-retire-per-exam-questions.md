# Modular monolith phase 1a: retire the per-exam question editor and import

- Status: committed 2026-10-02.
- Date: 2026-10-02
- Database: none. The legacy `questions` table and its 750 rows stay untouched.
- Rollback: `docs/rollback/2026-10-02-phase-1a-retire-per-exam-questions.md`
- Plan: `docs/implementation/2026-10-01-modular-monolith-90-plan.md`, phase 1. Operator, 2026-10-02: keep the bank check
  page, drop the per-exam editor and import, fix the misleading counter ("OK").

## Why

`/admin/exams/:id/questions/new`, `/:qId` and `/import` write the legacy `questions` table (750 rows, newest
2026-04-21). Exams draw only from `question_bank` (blueprint, `start_exam_attempt`); no attempt in the last 60 days used
the legacy table; nothing in the app links to these pages. Adding, editing and importing questions (Excel, ZIP, Word)
live in the question bank. The exam detail button "Câu hỏi (n)" counts the legacy table, so the QC exam shows 0 while
its bank holds 150 questions.

## Change

- Removed routes `exams/:id/questions/new`, `exams/:id/questions/:qId`, `exams/:id/questions/import`, the pages
  `AdminQuestionFormPage.tsx`, `AdminQuestionImportPage.tsx` and the services `questionService.ts`,
  `questionImportService.ts` (their only consumers).
- Kept `/admin/exams/:id/questions` (`AdminQuestionsPage`, "Kiểm tra ngân hàng câu hỏi"); it moves into
  `exam-management` in phase 1b.
- Exam detail: the button reads "Kiểm tra ngân hàng (n câu)", n = questions the draw can use for the exam's module
  (published, not deleted), from `question-bank` `countDrawableQuestions` (same pool as `start_exam_attempt`).
- `components/ZonePositionPicker.tsx` (now used only by the question-bank editor) moves to
  `modules/question-bank/ui/editor/`; `utils/questionValidation.ts` (pure) moves to
  `modules/question-bank/domain/question-validation.ts`, exported through `public.ts` for `ExamTakePage`.
  Their two allowlist exceptions and the legacy entries of the removed files are deleted.

## Checks

`npm run check:boundaries`, `npm run arch:score`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`.
Edge, admin (read only): exam detail shows "Kiểm tra ngân hàng (150 câu)" for the QC exam and opens the bank check page;
the removed URLs fall back to the app's default route; the question bank editor still shows the label-on-image picker.

## Results (2026-10-02)

- `npm run arch:score`: 29.6% of business code in modules (was 25.3%), routes 14/46, legacy services 17 files /
  2,797 lines, criteria 5/10 (criterion 5, domain purity, now passes). Allowlist: 7 import exceptions, 65 legacy files
  (the boundary check itself reported the 8 entries made stale by this change).
- `npm test` 127/127, `tsc -b`, lint 0 errors, build pass.
- Edge on a local build with the admin session, read only: QC exam detail shows "Kiểm tra ngân hàng (150 câu)" and opens
  the bank check page ("Ngân hàng đủ câu"); `/questions/new`, `/questions/import`, `/questions/abc` go to the dashboard;
  the bank editor's drag-and-drop type still renders (moved picker); no page error.
