# Rollback — Phase C question-bank UI separation

- Baseline commit: `e8c6886`
- Scope: question-bank module UI, query hooks and `src/App.tsx` routes

## Recovery

Create a revert commit; do not reset shared history:

```powershell
git revert <phase-c-commit-sha>
git push origin main
```

No database, storage or environment rollback is required. The phase adds no migration and does not change data.

After a revert, links of the form `/admin/question-libraries/<id>` stop working; the old `?library=<id>` form works again. Bookmarks made during Phase C must be reopened from the list.

## Shared commit with the question-bank data boundary

Phase C and `docs/implementation/2026-09-24-question-bank-data-boundary.md` ship in one commit, because the data-boundary change rewrites the occupation and module hooks that Phase C introduced. Both rollback records point to the same SHA. Reverting that commit removes both changes together; there is no separate revert for either one.

## Recovery checks

1. Run `npx.cmd --no-install tsc -b --pretty false`.
2. Run `npm.cmd run check:boundaries`.
3. Run `npm.cmd run build`.
4. Confirm admin and teacher can open `/admin/question-libraries` and the legacy `/admin/questions` routes.
