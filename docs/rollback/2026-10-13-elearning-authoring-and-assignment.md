# Rollback: e-learning authoring and class assignment (2026-10-13)

Implementation: `docs/implementation/2026-10-13-elearning-authoring-and-assignment.md`.

## Code

One commit in this repository. `git revert --no-edit <sha>` removes the routes `/admin/lessons` and
`/admin/lessons/:lessonId`, the menu entry and the authoring files. The learner pages are not touched by the commit
and keep working, including for lessons already assigned.

Before the commit is pushed there is nothing to undo on production code.

## Data written through the new screens

Reverting the code does not remove lessons, versions or assignments. They stay readable by learners.

- To hide an assigned lesson from a class without the screen: withdraw it (needs the migration below), or assign
  nothing new and set `is_archived = true` on the row of `elearning_class_assignments` in an approved, dry-run SQL
  session.
- Do not delete rows of `elearning_lesson_versions`, `elearning_class_assignments` or
  `elearning_enrollment_progress`: progress rows reference them.

## Migration `20261013090000_elearning_archive_assignment.sql`

Not applied at the time of writing. If it is applied and has to go:

```sql
begin;
drop function if exists public.elearning_archive_assignment(uuid);
drop function if exists elearning_private.archive_assignment(uuid);
-- Keep archived_at and archived_by: they record who withdrew a lesson. Dropping them loses that history.
commit;
```

The exam app then answers "Máy chủ chưa có chức năng này" on "Rút bài"; everything else keeps working.
