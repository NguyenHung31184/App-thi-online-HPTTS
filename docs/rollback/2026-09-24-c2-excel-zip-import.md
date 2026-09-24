# Rollback: Phase C2 step 2, slice 2 (Excel/ZIP import)

- Scope: question-bank module code and `src/App.tsx` routes. No migration.

## Recovery

Create a revert commit; do not reset shared history:

```powershell
git revert <c2-excel-zip-import-commit-sha>
git push origin main
```

The legacy import at `/admin/questions/occupation/<course>/import` keeps working after a revert. Rows already imported use the editor's encodings, so every screen keeps reading them.

## Undoing a bad import (forward repair)

Imported rows carry `source = 'spreadsheet_import'`. Soft-delete them; never hard-delete:

```sql
-- Review first
SELECT id, created_at, stem FROM question_bank
WHERE library_id = '<library-id>' AND source = 'spreadsheet_import' AND is_deleted = false
  AND created_at BETWEEN '<start>' AND '<end>';

UPDATE question_bank SET is_deleted = true, deleted_at = now()
WHERE library_id = '<library-id>' AND source = 'spreadsheet_import' AND is_deleted = false
  AND created_at BETWEEN '<start>' AND '<end>';
```

Pictures stay in `exam-uploads/question-bank/<library-id>/`; the bucket is not cleaned by hand.

## Recovery checks

1. `npx.cmd --no-install tsc -b --pretty false`, `npm.cmd run check:boundaries`, `npm.cmd run build`.
2. The legacy import screen reads a template file and shows the preview.
