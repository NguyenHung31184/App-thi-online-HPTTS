# Rollback: modular monolith phase 0

- Code: the commit that adds `docs/implementation/2026-10-02-architecture-phase-0.md`.
- Database: nothing to roll back.

## Recovery

`git revert <commit>` and push. The app behaves the same before and after; reverting only restores the older boundary
script, the old client location and the two unused services. If only the new boundary rules block urgent work, add the
file to `scripts/architecture-allowlist.json` with a reason instead of reverting.
