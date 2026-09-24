# Rollback: Phase C2 step 2, slice 1 (question editor)

- Scope: question-bank module code and `src/App.tsx` routes. No migration.

## Recovery

Create a revert commit; do not reset shared history:

```powershell
git revert <c2-question-editor-commit-sha>
git push origin main
```

No database rollback is needed. Rows saved through the new editor use the same encodings as the legacy form, so the legacy form and the exam screens keep reading them after a revert.

## Recovery checks

1. `npx.cmd --no-install tsc -b --pretty false`, `npm.cmd run check:boundaries`, `npm.cmd run build`.
2. The legacy form at `/admin/questions/occupation/<course>/questions/<id>` opens and saves a question.
