# Rollback: practical templates field grading set-up

- Code: `git revert <hash>`; old code ignores the new columns. Deleted (soft) rows would show again in the old lists.
- Database, forward repair only: the columns are additive with defaults; leave them. To undo a soft delete:
  `UPDATE practical_exam_templates SET is_deleted = false WHERE id = '<id>'` (same for criteria, sessions).
