# Trash keeps real results (Plan 79, decision 2)

- Status: migration applied on production 2026-10-06 after operator approval (dry run first); code pushed.
- Rollback: `docs/rollback/2026-10-06-exam-trash-keep-real-results.md`.
- Database: `20261006090000_exam_trash_keep_real_results.sql`.
- Plan: `QuanltTTDT-HPTTS/docs/PLAN_79.md` (Thông tư 79/2026/TT-BGDĐT: result records are kept long term).
- Operator decision 2026-10-06, replacing the 2026-10-05 one ("hard delete allowed even when results exist"): real
  results cannot be hard-deleted; trial results can.

## Rule

A result is real unless one of these holds:

- theory: the attempt's window is a trial (`exam_windows.is_trial`);
- theory and practical: the class code starts with `TEST` (today: `TEST-TH`).

A result is a theory attempt with status `completed`, or a practical attempt with status `graded` or `not_eligible`.
Unfinished attempts never block. An attempt without a window or class counts as real.

## Change

1. `exam_trash_real_results(kind, id)`: how many real results a hard delete would remove. Internal; no role may call
   it directly.
2. `exam_trash_list()` returns one more column, `real_results`. The old TTDT build ignores it.
3. `exam_trash_hard_delete(kind, id)` refuses when `real_results > 0`, with the count and a plain reason. The item
   stays in the trash and can be restored.

Not changed: "Xóa báo cáo thi thử" in App thi (deletes attempts of trial windows only), restore, soft delete.

## Dry run on production, 2026-10-06

10 exams in the trash: 9 would be blocked (176 real results in total), 1 has none. 1 practical template and 6
practical sessions in the trash: none blocked (test class or no finished attempt).

## After applying, 2026-10-06

`exam_trash_list` returns `real_results`; `authenticated` cannot call `exam_trash_real_results`; 9 of 10 trashed exams
are blocked. Called as a staff account inside a self-rolling-back block, a hard delete of a trashed exam was refused
("Mục này có 56 bài đã có kết quả của lớp thật…"); attempts 946 before and after.

## Checks

Database tests (PGlite, 42 pass): refused for a real class, allowed for a trial window, allowed for a test class,
allowed with only unfinished attempts. `npm test`, `npm run lint`, `npm run check:boundaries`.
