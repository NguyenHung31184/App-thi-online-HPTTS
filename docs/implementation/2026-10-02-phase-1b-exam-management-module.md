# Modular monolith phase 1b: `exam-management` module

- Status: in progress 2026-10-02 (step 1 committed).
- Date: 2026-10-02
- Database: none. Behaviour unchanged (moves only).
- Rollback: `docs/rollback/2026-10-02-phase-1b-exam-management-module.md`
- Plan: `docs/implementation/2026-10-01-modular-monolith-90-plan.md`, phase 1.

## Steps (one commit each)

1. **Data and application layers.** `src/modules/exam-management/`:
   - `domain/`: input types (`CreateExamInput`, `UpdateExamInput`, `CreateExamWindowInput`, `UpdateExamWindowInput`,
     `ExamWindowWithExam`) and pure rules: default exam row, the window's exam ids ("quay 1 trong N": first id is the
     displayed `exam_id`), draw frequency counting. Unit tested.
   - `data/`: `exam-repository.ts` (exams), `exam-window-repository.ts` (windows, trial attempts),
     `attempt-draw-repository.ts` (question ids drawn per exam).
   - `application/`: `manage-exams.ts` (list, get, create, update, soft delete, lock after the question-bank blueprint
     check, unlock), `manage-windows.ts` (list, get, create, update, delete, delete trial attempts, windows open to the
     student via `exam-taking`), `bank-check.ts` (module questions via `question-bank`, draw frequency).
   - `question-bank` gains `listModuleQuestions(moduleId)` (the rows the bank check page lists) in its public API.
   - `services/examService.ts`, `services/examWindowService.ts` become re-exports of `exam-management/public.ts` so
     every consumer keeps working; `services/questionBankService.ts` keeps only its two used functions as re-exports.
     Removed unused code: `validateExamAndCreateSnapshot` and seven unused question-bank service functions.
   Before step 2 (prerequisites so the moved pages do not call legacy code):
   - `ConfirmationModal` and `EmptyState` move to `src/shared/ui/` (generic, no business rules).
   - New module `integrations` with the TTDT directory (`services/ttdtDataService.ts` → `modules/integrations`:
     classes, modules, modules by course, a student's classes; `course_modules` parsing in `domain/`, tested); the
     service becomes a re-export. The rest of `integrations` (sync, OCR) stays in phase 5.
2. **Pages into the module.** `AdminExamsPage`, `AdminExamFormPage`, `AdminExamDetailPage`, `AdminQuestionsPage` (bank
   check), `AdminWindowsPage`, `AdminWindowFormPage` move to `exam-management/ui/`, reading and writing through
   `queries/` hooks; routes in `App.tsx` take them from `public.ts`.
3. **Consumers and facades.** Other pages (`ExamTakePage`, `ExamIntroPage`, `ExamResultPage`, `DashboardPage`,
   `AdminReportPage`, `AdminSyncPage`) import from `exam-management/public.ts`; the three service facades are deleted.

Kept as is (behaviour, to decide separately): deleting a window is a hard delete, and "Xóa báo cáo thi thử" hard-deletes
the attempts of trial windows. Both are against the soft-delete convention; they are recorded here and in the ledger
rather than changed during a move.

## Checks (each step)

`npm run check:boundaries`, `npm run arch:score`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`.
After step 2: Edge, admin, local build, read only: exam list, exam form (open, no save), exam detail, bank check,
window list, window form (open, no save).
