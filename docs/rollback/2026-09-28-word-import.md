# Rollback: import questions from a Word file

- Code: the commit that adds `docs/implementation/2026-09-28-word-import.md`.
- Database: nothing to roll back; no schema change.

## Recovery

`git revert <commit>` and push: the import screen goes back to Excel/ZIP only. Questions already imported from Word
stay in their library (`source = 'word_import'`); remove unwanted ones from the library screen (soft delete). Uploaded
pictures stay in `exam-uploads/question-bank/<library>/` and are never cleaned by hand.
