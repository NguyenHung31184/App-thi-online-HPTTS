# Rollback: teacher route guard

- Code: the commit that adds `docs/implementation/2026-09-26-teacher-route-guard.md`.
- Database: nothing to roll back.

## When to roll back

Only if a teacher is sent to the dashboard from a page in the teacher menu. Prefer adding the missing section to
`TEACHER_SECTIONS` in `src/utils/adminAccess.ts` over reverting.

## Recovery

`git revert <commit>` and push. Teachers can then open every `/admin` URL again; data stays limited by RLS.

## Recovery checks

1. As admin, every admin page opens.
2. A student account opening `/admin` lands on `/dashboard`.
