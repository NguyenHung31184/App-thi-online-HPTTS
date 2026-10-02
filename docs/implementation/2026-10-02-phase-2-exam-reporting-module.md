# Modular monolith phase 2: `exam-reporting` module

- Status: in progress.
- Date: 2026-10-02
- Database: none. Behaviour and screens unchanged (moves only).
- Rollback: `docs/rollback/2026-10-02-phase-2-exam-reporting-module.md`
- Plan: `docs/implementation/2026-10-01-modular-monolith-90-plan.md`, phase 2. Progress: `docs/MODULAR_MONOLITH_TIEN_DO.md`.

## Scope (2,263 lines on 2026-10-02)

- `src/pages/admin/AdminReportPage.tsx` (592): results and monitoring signals per exam or window, Excel export, AI
  incident review.
- `src/pages/admin/AdminAttemptResultPage.tsx` (625): one attempt with student, start photo, answers, PDF print. Calls
  Supabase directly and signs the start photo through `services/attemptService`.
- `src/services/reportService.ts` (515), `src/services/dashboardService.ts` (333). `getAdminDashboardStats` is used by
  both the admin dashboard and `DashboardPage`.
- `src/pages/admin/AdminDashboardPage.tsx` (198): statistics; embeds `LiveExamMonitor`, which stays in `exam-monitoring`.

## Steps (one commit each)

1. **Domain.** Pure rules in `exam-reporting/domain/` with tests written against today's behaviour: AI risk points,
   student display name, pass rule, evidence paths and frames, aggregation of signals per attempt, result search,
   Excel sheet rows, report filter options, dashboard counts and labels, answer review of one attempt.
2. **Data and application.** `data/`: report, dashboard, attempt result repositories, student and class name lookups,
   evidence signing (evidence frames and the start photo; the module does not import `src/services`, so the start
   photo lookup is its own; `attemptService` keeps its copy for `ExamResultPage` until phase 6). `application/`: use
   cases. `reportService` and `dashboardService` become re-exports of `exam-reporting/public.ts`.
3. **Pages into the module.** `ReportPage`, `AttemptResultPage`, `AdminDashboardPage` in `exam-reporting/ui/`, reading
   through `queries/` hooks, each file at most 350 lines. Routes `dashboard`, `report`, `attempts/:attemptId/result`
   take them from `public.ts`; `DashboardPage` reads the statistics through `public.ts`.
4. **Facades.** Delete `reportService.ts`, `dashboardService.ts` and the three old pages; regenerate the allowlist;
   module README.

Kept as is: old attempts without `question_ids` are reviewed from the legacy `questions` table (read only). Student and
class names for the report are read by the module itself (a read model), not through `integrations`.

## Checks (each step)

`npm run check:boundaries`, `npm run arch:score`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`.
After step 3: Edge, admin, local build, read only: dashboard, report filters and row counts against production, both
Excel exports, AI evidence links, one attempt result with its start photo. No AI incident review on real data.
