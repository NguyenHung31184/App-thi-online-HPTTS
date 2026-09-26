# Rollback: exam app follows the HPTTS brand identity

- Code: the commit that adds `docs/implementation/2026-09-26-hptts-brand-identity.md`.
- Database: nothing to roll back.

## When to roll back

Only if a screen becomes unreadable or a control disappears. A color the operator dislikes is fixed forward in
`src/index.css` (one place) instead.

## Recovery

`git revert <commit>` and push. The old colors, gradients and the graduation-cap tile return; `public/brand/hptts-logo.png`
is removed with the commit.

## Recovery checks

1. Login, dashboard and the exam list render.
2. The exam flow (CCCD, intro, take, result) shows its buttons.
