# Exam app roles come from `profiles.exam_role`

- Status: code committed locally, not deployed. Ships with the C2 push. The database part is live since 2026-09-25.
- Date: 2026-09-25
- Database: main app migration `QuanltTTDT-HPTTS/supabase/migrations/20260925014616_exam_role_split.sql` (applied)
- Rollback: `docs/rollback/2026-09-25-exam-role-column.md`
- Ledger issue: "Exam app roles leak from Sổ chuyên cần"

## Problem

The exam app decided who is admin or teacher in three places, none of them controlled by the operator:

- RLS and three RPCs used `get_my_role()`, which returns the Sổ chuyên cần role (`satellite_role`). 16 instructors with `teacher` and 1 with `admin` could read all 943 attempts and 2808 questions and edit E-Learning.
- The UI took the role from `user_metadata.role` first. A signed-in user can change their own `user_metadata` through `auth.updateUser`, so anyone could make the UI show the admin screens.
- The UI promoted a user to teacher when `instructors.email` matched the login email and the specialization contained "lý thuyết".

## Change

Database (already applied, main app repo):

- New column `profiles.exam_role` (`admin`, `teacher`, `proctor` or NULL). Only a main app admin can set it (profile guard).
- `get_my_exam_role()` returns it for staff and instructor profiles; exam accounts always get NULL.
- The 14 theory-exam policies and `get_questions_for_student`, `get_questions_for_attempt`, `recompute_attempt_score` use it. Practical-exam policies keep `get_my_role()`: teachers grade practical exams in Sổ chuyên cần.
- The operator's staff admin account has `exam_role = 'admin'`.

This repo:

- `AuthContext`: the role is `profiles.exam_role`, or `student` when it is empty. `user_metadata.role` and the instructor-email promotion are gone.
- `profileService.getMyProfile` reads `exam_role`. It no longer tries to insert a missing profile: that insert used
  `role: 'student'`, which the role check rejects, and the profile guard blocks it too.
- `api/sync-ttdt.ts` and `api/process-question-import.ts` check `exam_role` instead of `profiles.role`.

## Before deploy

Until this code is live, the database already denies exam data to instructors. Two instructors whose email and specialization match the old promotion rule still see the teacher menu, with empty pages.

## After deploy

1. Sign in with the operator account: admin menu, question library, windows and results load.
2. Sign in with an exam account: only the student pages, own attempts.
3. `/api/sync-ttdt` still syncs a completed attempt of the signed-in student.
