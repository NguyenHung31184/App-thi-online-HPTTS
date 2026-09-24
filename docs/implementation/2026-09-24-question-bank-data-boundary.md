# Question-bank data boundary

- Status: complete; ships in the Phase C commit
- Baseline: Phase C working tree on 2026-09-24
- Scope: `src/modules/question-bank/data/`, `application/`, and `scripts/check-module-boundaries.mjs`
- Rollback: `docs/rollback/2026-09-24-question-bank-data-boundary.md`

## Goal

Keep the question-bank module independent of Supabase and the legacy service layer outside its data adapter. A future move to an API, a separate database, or a different Supabase project must change only the module's `data/` implementation and configuration.

## Change

- Move occupation and module catalog reads from `application/` into the question-bank data repository.
- Keep UI, React Query hooks, and application use cases dependent only on module functions and domain types.
- Extend the module-boundary script: only `src/modules/<name>/data/` may import the Supabase client; no question-bank layer may import `src/services/`.

## Non-goals

- No database, RLS, API, storage, or UI behavior change.
- No attempt to migrate all legacy pages in this change.

## Validation

1. `npm.cmd run check:boundaries` rejects a non-data module that imports Supabase or a legacy service.
2. `npx.cmd --no-install tsc -b --pretty false` and `npm.cmd run build` pass.
3. The library create form still loads occupations and modules through the new query path.

## Completion record

- Occupation and module reads now live in `src/modules/question-bank/data/question-library-repository.ts`.
- `application/manage-question-library.ts` no longer imports legacy services.
- The boundary check passed after enforcement was added.
- TypeScript and the production build passed on 2026-09-24.
