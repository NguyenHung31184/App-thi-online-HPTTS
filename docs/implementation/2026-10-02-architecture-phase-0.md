# Modular monolith phase 0: architecture rules and score

- Status: committed 2026-10-02.
- Date: 2026-10-02
- Database: none. No change to screens or behaviour.
- Rollback: `docs/rollback/2026-10-02-architecture-phase-0.md`
- Plan: `docs/implementation/2026-10-01-modular-monolith-90-plan.md`, phase 0 (operator approved 2026-10-02).

## Change

1. `scripts/architecture-score.mjs` (new, `npm run arch:score`): measures, with no network and no build,
   - business lines of code in `src/modules` against all business code (`.ts`/`.tsx` under `src`, without tests,
     `src/types/supabase.ts`, `src/app`, `src/platform`, `src/shared`, `src/main.tsx`, `src/App.tsx`);
   - routes: `element={<X>}` in `src/App.tsx` except `Navigate`, `Layout`, `AdminLayout`;
   - routes in `src/App.tsx` whose element comes from a module `public.ts`;
   - files that call Supabase (`supabase.from/rpc/storage/auth/functions`) outside a module `data/` folder;
   - legacy services (`src/services`) and their lines;
   - the 10 criteria of the plan, each pass/fail.
   It prints a table, `--json` prints the same as JSON. CI prints it on every run; it does not fail the build.
2. `scripts/check-module-boundaries.mjs` (extended) keeps the old rules (modules never import `src/services`; other
   modules only through `public.ts`) and adds:
   - the Supabase client (`lib/supabaseClient` or `platform/supabase/client`) only from a module `data/` folder;
   - layer direction inside a module: `domain` imports only `domain` and type-only `src/types`; `data` never imports
     `queries` or `ui`; `application` never imports `queries` or `ui`; `queries` never imports `ui` or `data`; `ui` never
     imports `data`, and imports `application` for types only;
   - a module may not take a new runtime dependency on legacy folders (`src/components`, `src/contexts`, `src/utils`,
     `src/pages`, `src/lib`);
   - no new file in the legacy folders (`src/services`, `src/pages`, `src/components`, `src/contexts`, `src/utils`).
   Existing exceptions are listed, each with the phase that removes it, in `scripts/architecture-allowlist.json`. An
   entry that no longer matches anything is reported, so the list only shrinks.
   `application → data` stays allowed for now (modules call repositories directly); ports come per module in later phases.
3. Fixes so the new rules hold without new exceptions:
   - `platform/supabase/client.ts` becomes the real client; `lib/supabaseClient.ts` re-exports it for legacy code.
     Module data adapters import the platform client.
   - `exam-monitoring`: the live-monitor query calls an application function instead of the repository.
   - Removed services without consumers: `essayGradingService.ts`, `occupationService.ts`.
   - `question-bank`: the Word import page gets its plan from a query hook (`useImportPlan`) instead of calling the
     application function, so `ui → application` stays type-only.

## Checks

`npm run check:boundaries`, `npm run arch:score` (twice, same output), `npm test`, `npx tsc -b`, `npm run lint`,
`npm run build`. No screen or database change, so no Edge check is needed; the build output is the same set of routes.

## Results (2026-10-02)

- Baseline measured by `npm run arch:score` (identical output on two runs): business code in modules 5,973/23,638 lines
  = 25.3%; routes owned by modules 14/49; Supabase calls outside module `data/` in 24 files; 19 legacy services
  (3,733 lines); 30/32 pages still hold logic; criteria passed 4/10 (4 boundaries, 6 ui, 9 tests, 10 CI).
  The plan's "46/100" was an estimate; this is the reference from now on.
- Allowlist: 9 import exceptions (AuthContext ×4 → phase 5, mediaUrlValidator ×3 → phase 7, questionValidation and
  ZonePositionPicker → phase 1) and 71 legacy files, each with the phase that removes it.
- Negative check: a new file in `src/services`, a `ui → data` import, and a domain file importing React and the
  Supabase client were all reported (exit 1); removing them passed again.
- `npm test` 127/127, `tsc -b`, lint 0 errors, build pass.
