# Rollback: `exam-reporting` module

- Code: the commits whose message starts with `refactor(exam-reporting)`, latest first. Hashes are listed in
  `docs/MODULAR_MONOLITH_TIEN_DO.md`.
- Database: nothing to roll back.

## Recovery

`git revert` the step commits in reverse order and push. Each step leaves the app working on its own: after step 2 the
old services are re-exports, after step 3 the pages live in the module, after step 4 the facades are gone. Reverting
step 4 restores the facades and old pages; reverting step 3 restores the routes to `src/pages/admin/`.

Quick path when production breaks: promote the previous Vercel deployment, then revert.
