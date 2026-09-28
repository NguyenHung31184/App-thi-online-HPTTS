# Rollback: keep the option order when an option refers to other options

- Code: the commit that adds `docs/implementation/2026-09-28-keep-option-order.md`.
- Database: nothing to roll back.

## Recovery

`git revert <commit>` and push: options are shuffled again for every question and shown without letters. Answers saved
in the meantime stay valid because they are stored by option id.
