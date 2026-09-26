# Unit tests with Vitest, and CI on GitHub

- Status: committed locally 2026-09-26, not pushed.
- Date: 2026-09-26
- Database: none.
- Rollback: `docs/rollback/2026-09-26-vitest-and-ci.md`

## Problem

The repo has no test runner and no CI. The lock-exam check (`docs/implementation/2026-09-26-lock-exam-checks-question-bank.md`)
was verified with fixtures bundled by hand in a scratch folder; those checks are gone once the session ends, and nothing
runs `check:boundaries`, lint or the build before Vercel deploys a push.

## Change

- Dev dependency `vitest` `^4.1.11` (supports Vite 7 and Node 20+; 5.x was three weeks old). Scripts: `npm test`
  (`vitest run`) and `npm run test:watch`.
- `vitest.config.ts`, separate from `vite.config.ts` so tests do not load the Tailwind and React plugins: Node
  environment, `src/**/*.test.ts` only. Tests cover pure domain and application functions, not React components and
  not Supabase. Same approach as the main app (`QuanltTTDT-HPTTS/vitest.config.ts`).
- `tsconfig.node.json` also type-checks `vitest.config.ts`.
- First test file: `src/modules/question-bank/domain/blueprint-coverage.test.ts`, the 21 lock-exam fixture cases in
  11 tests.
- `.github/workflows/ci.yml` on push to `main` and on pull requests, Node 22: `npm ci`, `check:boundaries`, `lint`,
  `npm test`, `npm run build`. No secrets: the build does not need Supabase keys.

CI only reports. Vercel still deploys every push to `main`, whatever CI says.

## Checks (2026-09-26, local)

- `npm test`: 11 of 11 pass. `check:boundaries` passes. `lint`: 0 errors, 6 existing warnings
  (`react-hooks/exhaustive-deps`). `npm run build` (includes `tsc -b` over the test file and `vitest.config.ts`) passes.
  `npm ci --dry-run` passes with the new lock file.
- `npm audit` lists moderate and high advisories in packages that were already installed (Babel, ajv, dompurify,
  form-data, …); none comes from `vitest`. Not handled here.
- After push: the first CI run on GitHub is green.
