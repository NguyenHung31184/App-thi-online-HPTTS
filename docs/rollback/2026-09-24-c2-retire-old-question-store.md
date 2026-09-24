# Rollback: Phase C2 step 3 (retire the old question-bank screens)

- Scope: question-bank module, `src/App.tsx`, removed legacy pages, user guide. No migration.

## Recovery

Create a revert commit; do not reset shared history:

```powershell
git revert <c2-retire-old-question-store-commit-sha>
git push origin main
```

The revert restores the four legacy pages and their routes. They read `question_bank` directly and ignore `library_id`, so every question created, imported or changed in the library screens shows up there.

## Data changed through the new actions

- Status changes and retirements are ordinary updates of `question_bank.status`; set a row back with the editor or:

  ```sql
  UPDATE question_bank SET status = 'published', updated_at = now() WHERE id = ANY('{<ids>}'::uuid[]);
  ```

- Deletions are soft; restore with:

  ```sql
  UPDATE question_bank SET is_deleted = false, deleted_at = NULL WHERE id = ANY('{<ids>}'::uuid[]);
  ```

## Recovery checks

1. `npx.cmd --no-install tsc -b --pretty false`, `npm.cmd run check:boundaries`, `npm.cmd run build`.
2. `/admin/questions` shows the course list again and a course page lists its questions.
