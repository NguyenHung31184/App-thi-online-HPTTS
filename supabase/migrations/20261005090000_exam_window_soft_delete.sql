-- Theory exam windows are soft-deleted like exams; practical templates and sessions record when they were deleted.
ALTER TABLE public.exam_windows
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.practical_exam_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.practical_exam_sessions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The functions students and the monitor use must not see a deleted window. Each is patched in place with one
-- checked replacement, so the rest of its body stays exactly as deployed.
DO $$
DECLARE
  patch record;
  body text;
  patched text;
BEGIN
  FOR patch IN
    SELECT * FROM (VALUES
      ('public.start_exam_attempt(uuid,text)',
       'SELECT * INTO v_window FROM exam_windows WHERE id = p_window_id FOR UPDATE;',
       'SELECT * INTO v_window FROM exam_windows WHERE id = p_window_id AND NOT is_deleted FOR UPDATE;'),
      ('public.get_available_exam_windows()',
       'WHERE auth.uid() IS NOT NULL AND ew.start_at',
       'WHERE auth.uid() IS NOT NULL AND NOT ew.is_deleted AND ew.start_at'),
      ('public.get_live_exam_monitor()',
       'WHERE w.start_at <= v_now',
       'WHERE NOT w.is_deleted AND w.start_at <= v_now')
    ) AS p(fn, needle, replacement)
  LOOP
    IF to_regprocedure(patch.fn) IS NULL THEN
      CONTINUE; -- not present in this database (test databases load only some migrations)
    END IF;
    body := pg_get_functiondef(to_regprocedure(patch.fn));
    IF position(patch.replacement IN body) > 0 THEN
      CONTINUE; -- already patched
    END IF;
    IF position(patch.needle IN body) = 0 THEN
      RAISE EXCEPTION 'exam_window_soft_delete: % no longer contains the expected text', patch.fn;
    END IF;
    patched := replace(body, patch.needle, patch.replacement);
    EXECUTE patched;
  END LOOP;
END $$;
