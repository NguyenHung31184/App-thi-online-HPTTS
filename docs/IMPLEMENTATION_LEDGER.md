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
3. Phase C2, single question store: step 1 (one library per module, all questions linked, QTHH-AT copies merged, auto-assign trigger) applied 2026-09-24; step 2 slice 1 (create and edit questions inside the library, `docs/implementation/2026-09-24-c2-question-editor.md`) and slice 2 (Excel/ZIP import inside the library, `docs/implementation/2026-09-24-c2-excel-zip-import.md`) complete; step 3 (retire the old entry point) next. See `docs/implementation/2026-09-24-phase-c2-single-question-store.md`.
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

### Shared module draws the same question more than once (found 2026-09-24, exam integrity; draw fixed, past scores open)

- Module `m07` (QTHH-AT) is used by four courses. `question_bank` holds 600 active rows for it, but only 150 distinct stems: each course has its own copy of the same 150 questions.
- `start_exam_attempt` draws by `module_id` only and excludes repeats by `id`, not by content. A draw for an `m07` exam therefore picks from 600 rows that are four copies of 150 questions.
- Production check on 2026-09-24: 326 of 326 attempts on the three `m07` exams contain at least one repeated question; the worst has 13 repeats in 50 questions. Affected attempts started between about 2026-05-28 and 2026-09-11.
- Other modules belong to a single course. Inside them a few stems repeat (HH-GN 1, KT-GN 1, NLĐK-CO 4, NLĐK-QC 3); these may be real duplicates or questions that share wording but differ in image or options, not yet reviewed.
- Decision 2026-09-24: exclude repeats by content (stem + options). Fix applied to production 2026-09-24 (migration `20260924094701`): `docs/implementation/2026-09-24-draw-exclude-duplicate-content.md`. New attempts no longer repeat a question; past attempts are unchanged.
- Past attempts: read-only report prepared, scores unchanged. 203 completed attempts; counting each repeated question once would flip 1 pass to fail and 2 fails to pass. The report names students, so it is kept outside Git at `D:\Data\App-thi-online-HPTTS-bao-cao\2026-09-24-QTHH-AT-cau-lap.xlsx`. Whether to change any score is still open.

### Teacher route guard allows every admin URL (found 2026-09-24)

- `src/pages/admin/AdminLayout.tsx` lists `'/admin'` in `teacherAllowedPrefixes` and matches with `startsWith(prefix + '/')`, so the check passes for every `/admin/...` path.
- Effect: a teacher does not see Kỳ thi or Nhật ký đồng bộ TTDT in the menu, but can open `/admin/windows` or `/admin/sync` by typing the URL. What data loads then depends on RLS for those tables.
- Predates Phase C. Not fixed in Phase C; needs its own implementation entry. Keep `/admin` as an exact match only.

## Workspace agent setup

- Antigravity cost-controlled subagents: active. See `docs/implementation/2026-09-22-antigravity-cost-controlled-agents.md`.

## Shell fixes

- Admin shell fixes (reload redirect to `/login`, header always "Dashboard", focus entering the closed mobile sidebar): complete 2026-09-24, verified on Edge for admin; student shell not yet re-tested. See `docs/implementation/2026-09-24-admin-shell-fixes.md`.

## Architecture enforcement

- Question-bank data boundary: complete, shipped with Phase C. See `docs/implementation/2026-09-24-question-bank-data-boundary.md`.

See `docs/implementation/2026-09-22-admin-navigation-and-live-monitoring.md`.
