# Rollback: remove the score distribution and top exams charts

- Code: the commit that adds `docs/implementation/2026-09-28-remove-dashboard-charts.md`.
- Database: nothing to roll back.

## Recovery

`git revert <commit>` and push: both charts come back unchanged.
