# Rollback: resume the open attempt when a student enters an exam again

- Code: the commit that adds `docs/implementation/2026-10-01-resume-in-progress-attempt.md`.
- Database: `20260930160000_resume_in_progress_attempt.sql` replaced `public.start_exam_attempt(uuid, text)`.

## Recovery

Forward repair only: apply a new migration whose body is the previous definition in
`supabase/migrations/20260924094701_draw_exclude_duplicate_content.sql` (identical to production before this change),
keeping `REVOKE … FROM PUBLIC, anon` and `GRANT EXECUTE … TO authenticated`. Attempts created or resumed in the meantime
stay valid; attempts finalized on re-entry keep their grades. Do it outside an exam session.
