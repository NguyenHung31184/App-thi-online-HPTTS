# Teacher route guard: `/admin` matches only itself

- Status: committed locally 2026-09-26, not pushed.
- Date: 2026-09-26
- Database: none. Client code only.
- Rollback: `docs/rollback/2026-09-26-teacher-route-guard.md`
- Ledger issue: "Teacher route guard allows every admin URL"

## Problem

`AdminLayout` sends a teacher back to the dashboard unless the path starts with an allowed prefix. The list contains
`'/admin'`, and the check is `pathname === p || pathname.startsWith(p + '/')`, so every `/admin/...` path passes. A
teacher does not see Kỳ thi, Chấm tự luận, the practical pages or Nhật ký đồng bộ TTDT in the menu, but can open them by
typing the URL. What loads then depends only on RLS.

Nobody has `exam_role = 'teacher'` today, so no one is affected yet; the gap opens as soon as the operator grants the role.

## Change

- `src/utils/adminAccess.ts`, `teacherCanOpen(pathname)`: `/admin` (with or without a trailing slash) matches only
  itself; the teacher sections match themselves and their sub-paths: dashboard, exams, questions (redirect),
  question-libraries, report, attempts. Same list as before, without the catch-all.
- `AdminLayout` uses it. Admin access and the redirect of other roles to `/dashboard` do not change.
- `src/utils/adminAccess.test.ts`: allowed and denied paths, including look-alikes such as `/admin/reports` and
  `/admin/exams-x`, and trailing slashes.

## Checks (2026-09-26, local)

- `npm test`: 35 of 35 pass (24 path cases here, 11 from the blueprint check). `check:boundaries` passes; `lint`
  0 errors; `npm run build` passes.
- Not run in a browser: there is no teacher account to sign in with.

## After deploy

When a teacher account exists: `/admin/windows` and `/admin/sync` redirect to the dashboard; the question library,
exams and reports open.
