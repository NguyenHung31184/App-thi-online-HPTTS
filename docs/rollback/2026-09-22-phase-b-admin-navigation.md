# Rollback — Phase B admin navigation

- Baseline commit: `7b6ceb8`
- Scope: navigation labels, destinations, and page headings only

## Recovery

Create a revert commit; do not reset shared history:

```powershell
git revert <phase-b-commit-sha>
git push origin main
```

No database or environment rollback is required. Legacy URLs remain available throughout this phase.

## Recovery checks

1. Run `npx.cmd --no-install tsc -b --pretty false`.
2. Run `npm.cmd run check:boundaries`.
3. Run `npm.cmd run build`.
4. Confirm admin and teacher can open their permitted existing routes.
