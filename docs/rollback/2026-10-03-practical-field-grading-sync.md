# Rollback: practical grades from Sổ chuyên cần through the server queue

- Code: `git revert <hash>` restores the previous `server/exam-sync.ts` (practical sent unscaled, student from the
  profile only).
- Database, forward repair only: the previous `exam_private.enqueue_exam_sync` body is in
  `20260929092000_exam_sync_outbox.sql`; `CREATE OR REPLACE` it to restore. The added columns and the wider status
  check stay (nullable, unused by old code). Do not restore `user_id NOT NULL` while rows with a null `user_id` exist.
