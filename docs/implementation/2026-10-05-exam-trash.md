# Exam items in the TTDT trash; exam windows soft-deleted

- Status: in progress 2026-10-05.
- Rollback: `docs/rollback/2026-10-05-exam-trash.md`.
- Database: `20261005090000_exam_window_soft_delete.sql`, `20261005091000_exam_trash.sql`. Dry run first, applied only
  after operator approval.
- Operator decisions 2026-10-05: the TTDT app's trash ("Thùng rác") takes theory exams, theory exam windows, practical
  templates and practical sessions; restore and hard delete there; hard delete allowed even when results exist; now.
- TTDT side: `QuanltTTDT-HPTTS/docs/implementation/2026-10-05-thung-rac-thi-online.md`.

## Before

| Item | Delete in App thi | Hard delete cascades to |
|---|---|---|
| Theory exam (`exams`) | soft (`is_deleted`, `deleted_at`) | windows, attempts (and their scores, audit logs, papers) |
| Theory window (`exam_windows`) | **hard** | attempts of the window |
| Practical template | soft (`is_deleted`) | criteria, sessions, attempts, scores, photos rows, sync log |
| Practical session | soft (`is_deleted`) | attempts, scores, photos rows, sync log |

Deleting a window in App thi therefore erased its students' results.

## Change

1. `exam_windows` gets `is_deleted` and `deleted_at`; practical templates and sessions get `deleted_at`. App thi soft
   deletes windows and stamps `deleted_at` everywhere; window lists and the dashboard count skip deleted windows.
2. The functions students and the monitor use skip deleted windows: `get_available_exam_windows`,
   `start_exam_attempt` (a deleted window is "not found"), `get_live_exam_monitor`. They are patched in place by the
   migration (one `replace` each, checked) instead of copied, so nothing else in their long bodies changes.
3. Trash functions for the TTDT app (`SECURITY DEFINER`, staff only through `public.is_staff()`):
   - `exam_trash_list()`: every soft-deleted item with a title, class or detail, deletion time, how many attempts and
     how many finished results a hard delete would remove.
   - `exam_trash_restore(kind, id)`: refuses a window whose exam is in the trash, a session whose template is in the
     trash, and a session when a live one exists for the same class, template and mode, each with a plain message.
   - `exam_trash_hard_delete(kind, id)`: only an item already in the trash; removes the row (foreign keys cascade),
     the sync jobs of the removed attempts, and a deleted exam from other windows' `exam_ids`. Returns the number of
     attempts removed.
4. Scores already in TTDT (`grade_details`) are never touched. Photo files in `exam-uploads` stay (project rule: that
   bucket is not cleaned from the apps).
5. "Xóa báo cáo thi thử" keeps its hard delete: its purpose is to free database space.

## Checks

Database tests (PGlite) for soft-deleted windows, restore refusals and hard delete; `npm test`, `npx tsc -b`, `npm run
lint`, `npm run check:boundaries`, `npm run build`; dry run on production; Edge after applying: delete and restore a
test item in each kind, then hard delete only test items.
