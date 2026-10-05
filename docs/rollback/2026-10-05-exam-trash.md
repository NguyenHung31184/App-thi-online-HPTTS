# Rollback: exam items in the TTDT trash

Code: `git revert` the App thi and TTDT commits and push. The new columns and functions can stay; nothing calls the
trash functions after the TTDT revert.

Database (forward repair only, never drop the columns while rows are soft-deleted):

- To make soft-deleted windows visible again: `UPDATE exam_windows SET is_deleted = false, deleted_at = NULL WHERE
  is_deleted;` then revert the App thi code.
- The three patched functions: re-run `20260930160000_resume_in_progress_attempt.sql` (start_exam_attempt),
  `20260928150000_live_monitor_score.sql` (get_live_exam_monitor) and the current body of
  `get_available_exam_windows` without the `NOT ew.is_deleted` condition.
- Trash functions: `DROP FUNCTION public.exam_trash_list(), public.exam_trash_restore(text, uuid),
  public.exam_trash_hard_delete(text, uuid);`

A hard delete cannot be undone except from a database backup.
