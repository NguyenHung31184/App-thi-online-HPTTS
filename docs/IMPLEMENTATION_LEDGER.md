# HPTTS implementation ledger

This ledger is the entry point for people and coding agents continuing the project.

## Operating rules

1. Every structural, UI, logic, database, or API change gets one entry in `docs/implementation/` before code is changed.
2. Every entry names the affected modules, database objects, validation, deployment condition, and rollback procedure.
3. Each implementation is committed independently. The commit SHA is the primary recovery point.
4. Database recovery uses an explicit forward repair migration. Never run a destructive rollback against production data unless the entry says it is safe.
5. Secrets, `.env` files, personal data, and production API responses are never committed to these documents.

## Baseline

- Date: 2026-09-22
- Stable P0 commit: `428b6c0`
- Current P1 foundation commit: `68c008d`
- Local environment source: `.env` is intentionally ignored by Git.
- P1 database reconciliation: completed and verified in Supabase production on 2026-09-22 by `20260922110000_reconcile_p1_question_bank.sql`. The five P1 tables have RLS, the document-import bucket is private, and the exam draw excludes non-published questions.

## Active sequence

1. Restructure the admin menu and route labels: complete. See `docs/implementation/2026-09-22-phase-b-admin-navigation.md`.
2. Split question-bank UI into task-focused pages: complete 2026-09-24 (Admin click-through passed after the scope-contract repair; Teacher check moves to Phase C2 acceptance). See `docs/implementation/2026-09-23-phase-c-question-bank-routes.md` and `docs/implementation/2026-09-24-question-library-scope-contract.md`.
3. Phase C2, single question store: step 1 (one library per module, all questions linked, QTHH-AT copies merged, auto-assign trigger) applied 2026-09-24; step 2 slice 1 (create and edit questions inside the library, `docs/implementation/2026-09-24-c2-question-editor.md`), slice 2 (Excel/ZIP import inside the library, `docs/implementation/2026-09-24-c2-excel-zip-import.md`) and step 3 (old `/admin/questions` screens retired after moving their filters, bulk actions, delete and export into the library, `docs/implementation/2026-09-24-c2-retire-old-question-store.md`) complete. Acceptance passed 2026-09-26 (draw check on all 7 exams; teacher click-through dropped). Pushed 2026-09-26 with the `exam_role` UI. See `docs/implementation/2026-09-24-phase-c2-single-question-store.md`.
4. Document import, Word first (Azota-style: answers from formatting, "Đáp án:" lines or an end-of-file table; pictures mapped to their question; review in the library editor): planned after C2. See `docs/implementation/2026-09-24-document-import-plan.md`.
5. Add live examination monitoring.
6. Add practical examination reporting.

## Parked changes

Local work set aside so it does not conflict with the active sequence. Each item stays here until it is either delivered through its own implementation entry or explicitly dropped.

### E-LEARNING menu group (parked 2026-09-23)

- Origin: uncommitted edit to `src/pages/admin/AdminLayout.tsx` on the operator machine, written before Phase B (`af81af4`) rebuilt the menu.
- Stored as: `git stash` entry `elearning-menu: nhóm E-LEARNING trong AdminLayout (tạm cất 2026-09-23)` on `D:\Data\App-thi-online-HPTTS`. A stash is local only; the intended change is recorded below so it survives if the stash is lost.
- Intended change: add one section to both the teacher and admin navigation lists in `AdminLayout.tsx`:

  ```tsx
  {
    id: 'elearning',
    title: 'E-LEARNING',
    items: [{ to: '/student/learn', label: 'Học trực tuyến (xem trước)', icon: ExamIcon }],
  },
  ```

  Admin placement: after `THI THỰC HÀNH`, before `HỆ THỐNG`.
- Do not `git stash pop` onto the Phase B menu; it will conflict. Re-apply by hand in a new implementation entry.
- Open question before delivery: `/student/learn` is a student route opened from the admin shell. Confirm staff can load it (route guard, `StudentSession`) and that reusing `ExamIcon` is acceptable, or give it its own icon.
- Status: parked, not scheduled.

## Open issues

### No exam is locked, and the QC exam cannot be locked from the UI (found 2026-09-26, blocks exams)

- `start_exam_attempt` rejects an exam whose `locked_at` is null (`exam_not_locked`, P0 since 2026-09-20). On
  2026-09-26 all 7 active exams have `locked_at` null and there is no trial window. The last attempt was on 2026-09-11,
  before P0, so no student has started an exam since P0 went live.
- The admin "Khóa đề thi" button (`lockExam` → `validateBlueprint` in `src/services/examService.ts`) counts rows in the
  legacy `questions` table by `exam_id`, while the draw uses `question_bank` by `module_id`. Six exams have 50 legacy
  rows and lock. The QC exam ("Cấu tạo và nguyên lý vận hành cần trục giàn QC") has 0 legacy rows, so locking fails
  with "Thiếu câu" although its module has 150 published questions.
- Fix `e638b88`, pushed 2026-09-26: `docs/implementation/2026-09-26-lock-exam-checks-question-bank.md`. Locking
  now checks `question_bank` with the draw's rules. An admin still has to lock each exam once before its window opens;
  the operator does this.

### Shared module draws the same question more than once (found 2026-09-24, exam integrity; draw fixed, past scores open)

- Module `m07` (QTHH-AT) is used by four courses. `question_bank` holds 600 active rows for it, but only 150 distinct stems: each course has its own copy of the same 150 questions.
- `start_exam_attempt` draws by `module_id` only and excludes repeats by `id`, not by content. A draw for an `m07` exam therefore picks from 600 rows that are four copies of 150 questions.
- Production check on 2026-09-24: 326 of 326 attempts on the three `m07` exams contain at least one repeated question; the worst has 13 repeats in 50 questions. Affected attempts started between about 2026-05-28 and 2026-09-11.
- Other modules belong to a single course. Inside them a few stems repeat (HH-GN 1, KT-GN 1, NLĐK-CO 4, NLĐK-QC 3); these may be real duplicates or questions that share wording but differ in image or options, not yet reviewed.
- Decision 2026-09-24: exclude repeats by content (stem + options). Fix applied to production 2026-09-24 (migration `20260924094701`): `docs/implementation/2026-09-24-draw-exclude-duplicate-content.md`. New attempts no longer repeat a question; past attempts are unchanged.
- Past attempts: read-only report prepared, scores unchanged. 203 completed attempts; counting each repeated question once would flip 1 pass to fail and 2 fails to pass. The report names students, so it is kept outside Git at `D:\Data\App-thi-online-HPTTS-bao-cao\2026-09-24-QTHH-AT-cau-lap.xlsx`. Whether to change any score is still open.

### Exam app roles leak from Sổ chuyên cần (found 2026-09-24; database fixed 2026-09-25, UI ships with C2)

- Database fixed 2026-09-25 (main app migration `20260925014616_exam_role_split`): new column `profiles.exam_role`, set only by a main app admin; theory-exam policies and the question RPCs use `get_my_exam_role()`. Practical-exam policies keep `get_my_role()` because teachers grade practical exams in Sổ chuyên cần. Measured before/after: instructors went from reading all 943 attempts and 2808 questions to none; admin, staff and students unchanged.
- UI and API: `docs/implementation/2026-09-25-exam-role-column.md`, committed locally, deploys with the C2 push.
- Original finding:

- Exam RLS (`question_bank`, `question_libraries`, `attempts`, …) checks `get_my_role() IN ('admin','teacher')`. `get_my_role()` returns `profiles.satellite_role` when it is `teacher` or `admin` (changed by Sổ chuyên cần migration `20260524150000_fix_get_my_role_satellite`), and `satellite_role` is the Sổ chuyên cần role.
- Effect on 2026-09-24: 16 instructors with `satellite_role='teacher'` and 1 with `satellite_role='admin'` have teacher or admin rights on exam tables through the API, including writing `attempts` and `question_bank`. The operator has not given anyone an exam app account; the operator is the only exam admin.
- The UI also promotes a user to teacher when `instructors.email` matches the login email and the specialization contains "lý thuyết" (`AuthContext.maybeUpgradeToTeacherByInstructor`): 2 instructors match today, and with the open route guard below they can open every admin page.
- C2 acceptance drops the teacher click-through: there are no intended teacher accounts.
- Accounts for Sổ chuyên cần and the exam app are issued only from the main app (operator, 2026-09-24).

### `recompute_attempt_score` lets an anonymous caller through (found 2026-09-24; fixed 2026-09-25)

- The function checks `IF get_my_role() NOT IN ('admin', 'teacher')`. Without a session `get_my_role()` is NULL, the comparison is NULL and the check passes, so an anonymous caller can recompute a score.
- Correction 2026-09-25: the risk was not low. The function sums the maximum from the legacy `questions` table; for attempts drawn from `question_bank` that sum is 0, so a recompute sets the score to 0. Before the fix, no completed attempt had score 0 with a raw score above 0.
- Fixed in the shared database by main app migration `20260925001110_emergency_views_exam_rpc`: `anon` can no longer execute `get_questions_for_student`, `get_questions_for_attempt`, `grade_attempt`, `disqualify_attempt`, `recompute_attempt_score`; the three role checks use `coalesce(get_my_role(), '')`. The same migration closed the view `questions_for_student` (it ran as its owner, so an anonymous caller could read all 750 legacy questions and insert, update or delete them) and the two RPCs that returned any exam's questions without a session. Verified with simulated accounts: a student still gets their own attempt's questions and none of another attempt's.
- Related, fixed 2026-09-24 in the shared database (main app migration `20260924155908_emergency_revoke_anon_rpc`): 21 `SECURITY DEFINER` functions of the main app and Sổ chuyên cần (hard delete of students, tuition receipts, `create_satellite_user`, …) were callable without a session; anonymous execute is revoked.

### Login email domains are not controlled by the center (found 2026-09-24; resolved 2026-09-25)

- Resolved: the 17 instructors moved to `<sđt>@hptts.vn`; `create-user`, `create_satellite_user` and the main app create `@hptts.vn`; Sổ chuyên cần signs in with `@hptts.vn` only; the 186 exam accounts carry `account_kind='exam_student'`, `role='other'`. The operator does not register `hptts.vn`: custom SMTP is off, so Supabase sends auth mail only to organization members. Self-signup is disabled. Details: `QuanltTTDT-HPTTS/docs/GHI_CHU.md`.
- Original finding:

- Generated logins: students `<mã HV>@hptts.vn` (186), instructors `<sđt>@hptts.com` (17); staff use real addresses (4, plus 3 users without a profile).
- Public DNS on 2026-09-24: `hptts.vn` does not exist (unregistered); `hptts.com` exists on unrelated name servers (`klczy.com`) with a placeholder MX. Whoever registers or holds these domains could receive password-reset mail for those accounts if the project's mail settings send it.
- Profiles do not match the account type: 107 of the 186 exam accounts carry `account_kind='staff'`, 108 carry `role='academic_affairs'`. The main app repo's account analysis (`QuanltTTDT-HPTTS/docs/GHI_CHU.md`, 2026-09-24) covers creation paths, default password `123456` and the remaining RLS phase 2.

### Teacher route guard allows every admin URL (found 2026-09-24; fixed 2026-09-26)

- Fixed in `docs/implementation/2026-09-26-teacher-route-guard.md`: `/admin` matches only itself; path cases in
  `src/utils/adminAccess.test.ts`.
- Original finding:


- `src/pages/admin/AdminLayout.tsx` lists `'/admin'` in `teacherAllowedPrefixes` and matches with `startsWith(prefix + '/')`, so the check passes for every `/admin/...` path.
- Effect: a teacher does not see Kỳ thi or Nhật ký đồng bộ TTDT in the menu, but can open `/admin/windows` or `/admin/sync` by typing the URL. What data loads then depends on RLS for those tables.
- Predates Phase C. Not fixed in Phase C; needs its own implementation entry. Keep `/admin` as an exact match only.

## Workspace agent setup

- Antigravity cost-controlled subagents: active. See `docs/implementation/2026-09-22-antigravity-cost-controlled-agents.md`.

## Shell fixes

- Admin shell fixes (reload redirect to `/login`, header always "Dashboard", focus entering the closed mobile sidebar): complete 2026-09-24, verified on Edge for admin; student shell not yet re-tested. See `docs/implementation/2026-09-24-admin-shell-fixes.md`.

## Architecture enforcement

- Question-bank data boundary: complete, shipped with Phase C. See `docs/implementation/2026-09-24-question-bank-data-boundary.md`.
- Unit tests (Vitest, pure functions) and GitHub CI (boundaries, lint, test, build): added 2026-09-26. See `docs/implementation/2026-09-26-vitest-and-ci.md`.

See `docs/implementation/2026-09-22-admin-navigation-and-live-monitoring.md`.
