# Rollback: admin navigation and live monitoring

- Baseline commit: `68c008d`
- Scope: navigation, P1 reconciliation, live monitoring, practical reporting

## Code rollback

Each phase must use a separate commit. To reverse a deployed phase, create a new revert commit:

```powershell
git revert <phase-commit-sha>
git push origin main
```

Do not use `git reset` on `main` because it rewrites shared history.

## Database rollback

- Navigation changes have no database rollback.
- P1 schema changes must use a new forward migration. Preserve `question_bank`, attempts, import jobs, and audit data.
- Live monitoring data may be disabled by removing Realtime publication and heartbeat writes before any table is retired.
- A destructive table or column removal requires a separately approved backup and migration plan.

## Recovery verification

1. Run `npm.cmd run check:boundaries`.
2. Run `npm.cmd run build`.
3. Confirm admin routes load for admin and teacher roles.
4. Confirm active attempts can still be started, saved, submitted, and graded.
