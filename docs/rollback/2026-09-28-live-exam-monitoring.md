# Rollback: live exam monitoring

- Code: the commit that adds `docs/implementation/2026-09-28-live-exam-monitoring.md`.
- Database: `supabase/migrations/20260928120000_live_exam_monitoring.sql` (rollback statements in its header).

## Order

Code first, then the database. The deployed exam page calls `touch_attempt`; dropping the function before the code is
reverted makes each call fail (the page logs a warning and keeps working, but the log fills up).

## Recovery

1. `git revert <commit>` and push. The dashboard shows "Bài làm gần đây (đã nộp)" again; the exam page stops sending
   the signal.
2. After Vercel is ready:

   ```sql
   DROP FUNCTION IF EXISTS public.get_live_exam_monitor();
   DROP FUNCTION IF EXISTS public.touch_attempt(uuid);
   ALTER TABLE public.attempts DROP COLUMN IF EXISTS last_seen_at;
   ```

   `last_seen_at` is only a presence signal; losing it loses nothing else.

## Recovery checks

1. The dashboard loads for admin.
2. A student can start, answer and submit an exam.
