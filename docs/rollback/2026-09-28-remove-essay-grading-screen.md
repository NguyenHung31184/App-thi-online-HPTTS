# Rollback: remove the manual essay grading screen

- Code: the commit that adds `docs/implementation/2026-09-28-remove-essay-grading-screen.md`.
- Database: nothing to roll back.

## Recovery

`git revert <commit>` and push: the menu item, routes and pages come back unchanged.
