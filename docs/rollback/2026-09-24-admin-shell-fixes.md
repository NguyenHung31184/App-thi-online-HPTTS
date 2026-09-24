# Rollback: admin shell fixes

- Scope: `AuthContext`, `AdminLayout` title lookup, `AppLayout` sidebar focus handling

## Recovery

Create a revert commit; do not reset shared history:

```powershell
git revert <admin-shell-fixes-commit-sha>
git push origin main
```

No database, storage or environment rollback is needed.

After a revert, reloading an admin page redirects to `/login` again, every admin header reads "Dashboard", and the closed mobile sidebar is back in the tab order.

## Recovery checks

1. `npx.cmd --no-install tsc -b --pretty false`
2. `npm.cmd run check:boundaries`
3. `npm.cmd run build`
4. Admin and student can sign in and reach their dashboards.
