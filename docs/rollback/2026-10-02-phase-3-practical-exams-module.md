# Rollback: `practical-exams` module

- Code: the commits whose message starts with `refactor(practical-exams)`, latest first. Hashes are listed in
  `docs/MODULAR_MONOLITH_TIEN_DO.md`.
- Database: nothing to roll back.

## Recovery

`git revert` the step commits in reverse order and push. After step 2 the old services are re-exports, after step 3 the
pages live in the module, after step 4 the facades are gone; each step works on its own.

Quick path when production breaks: promote the previous Vercel deployment, then revert.
