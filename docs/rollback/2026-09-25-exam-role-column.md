# Rollback: exam app roles come from `profiles.exam_role`

- Code: the commit that adds `docs/implementation/2026-09-25-exam-role-column.md`.
- Database: main app migration `20260925014616_exam_role_split.sql`, rolled back separately in the main app repo.

## When to roll back

Only if staff lose the admin screens after deploy and the cause is in this code, not in `profiles.exam_role` data. First check the operator account: `select exam_role from profiles where id = '<user id>'` must return `admin`.

## Recovery

- Code: `git revert <commit>` and redeploy. The UI then reads `profiles.role` again. The database still denies exam data to anyone without `exam_role`, so reverting the code alone does not reopen the leak.
- Grant a role instead of reverting: a main app admin runs `update profiles set exam_role = 'teacher' where id = '<user id>'`.
- Database: see the rollback note in the migration header (`ALTER POLICY` back to the definitions in `backup.policies_exam_role_20260925`). That reopens the leak.

## Recovery checks

1. The operator account opens `/admin` and the question library.
2. An exam account opens only the student pages.
