# Rollback: retire the per-exam question editor and import

- Code: the commit that adds `docs/implementation/2026-10-02-phase-1a-retire-per-exam-questions.md`.
- Database: nothing to roll back; the `questions` table was never changed.

## Recovery

`git revert <commit>` and push: the three routes, both pages and both services come back, the exam detail button counts
the legacy table again, and the moved picker and validation return to `components/` and `utils/` (restore their
allowlist entries with the revert).
