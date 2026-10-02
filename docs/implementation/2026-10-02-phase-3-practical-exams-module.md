# Modular monolith phase 3: `practical-exams` module

- Status: in progress.
- Date: 2026-10-02
- Database: none. Behaviour and screens unchanged (moves only).
- Rollback: `docs/rollback/2026-10-02-phase-3-practical-exams-module.md`
- Plan: `docs/implementation/2026-10-01-modular-monolith-90-plan.md`, phase 3. Progress: `docs/MODULAR_MONOLITH_TIEN_DO.md`.

## Scope (1,781 lines on 2026-10-02)

- Services: `practicalTemplateService.ts` (151), `practicalSessionService.ts` (187), `practicalAttemptService.ts` (167).
- Admin pages: `AdminPracticalTemplatesPage` (140), `AdminPracticalTemplateFormPage` (302), `AdminPracticalSessionsPage`
  (135), `AdminPracticalSessionFormPage` (185), `AdminPracticalGradingPage` (88), `AdminPracticalGradingDetailPage` (233;
  reads `profiles` directly for the TTDT sync).
- Student page: `PracticalTakePage` (193): upload evidence photos to `exam-uploads`, submit.
- Other consumers: `DashboardPage` (open sessions, start an attempt), `AdminSyncPage` (retry a practical sync).

## Steps (one commit each)

1. **Domain.** Pure rules with tests: weighted total score, new criterion defaults, session form checks, the student's
   access to an attempt, labels. `toDatetimeLocal` / `fromDatetimeLocal` move to `src/shared/lib/` (generic) and
   `exam-management` uses them from there.
2. **Data, application, storage adapter.** `data/` for templates, criteria, sessions, attempts, photos, scores;
   `src/platform/storage/exam-uploads.ts` uploads evidence (the plan's "upload through a platform adapter").
   `application/` use cases. The three services become re-exports of `practical-exams/public.ts`. The TTDT sync of a
   grade still calls `services/ttdtSyncService` (moves with `integrations` in phase 5; listed in the allowlist).
3. **Pages into the module.** The seven pages in `practical-exams/ui/`, reading through `queries/` hooks; the ten
   routes take them from `public.ts`; `DashboardPage` and `AdminSyncPage` import from `public.ts`.
4. **Facades.** Delete the three services and the old pages; regenerate the allowlist; module README.

Kept as is (behaviour, to decide separately, as in phase 1b): deleting a template, a criterion or a session is a hard
delete; a student removing a photo before submitting deletes its row (the file stays in storage).

Database tests already cover start, code check, enrollment check, evidence required at submit, evidence locked after
submit and teacher grading (`tests/exam-database.test.ts`, "practical authorization").

## Checks (each step)

`npm run check:boundaries`, `npm run arch:score`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`.
After step 3: Edge, admin, local build, read only: template list and form, session list and form, grading list and one
grading page (no save, no sync), against production.
