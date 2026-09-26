# Rollback: unit tests with Vitest, and CI on GitHub

- Code: the commit that adds `docs/implementation/2026-09-26-vitest-and-ci.md`.
- Database: nothing to roll back.

## When to roll back

Only if installing `vitest` breaks the Vercel install or build. A red CI run is not a reason: fix the test or the code.

## Recovery

- `git revert <commit>` and push. This removes the dependency, the config, the tests and the workflow.
- To keep the tests but stop CI, delete `.github/workflows/ci.yml` only.

## Recovery checks

1. Vercel builds the next push.
2. `npm run build` passes locally.
