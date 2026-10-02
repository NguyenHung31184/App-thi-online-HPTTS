# Rollback: `exam-management` module

- Code: the commits whose message starts with `refactor(exam-management)` (three steps), latest first.
- Database: nothing to roll back.

## Recovery

`git revert` the step commits in reverse order and push. Each step leaves the app working on its own: after step 1 the
old services are re-exports, after step 2 the pages live in the module, after step 3 the facades are gone. Reverting
step 3 restores the facades; reverting step 2 restores the pages under `src/pages/admin/` and their routes.
