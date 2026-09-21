-- P0: all student exam mutations go through narrowly scoped RPCs.

CREATE TABLE IF NOT EXISTS public.exam_access_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_id UUID NOT NULL REFERENCES public.exam_windows(id) ON DELETE CASCADE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, window_id)
);

ALTER TABLE public.exam_access_failures ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_available_exam_windows()
RETURNS TABLE (
  id UUID,
  exam_id UUID,
  exam_ids UUID[],
  class_id TEXT,
  start_at BIGINT,
  end_at BIGINT,
  is_trial BOOLEAN,
  max_attempts INTEGER,
  exam_title TEXT,
  class_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT ew.id, ew.exam_id, ew.exam_ids, ew.class_id, ew.start_at, ew.end_at,
         COALESCE(ew.is_trial, false), COALESCE(ew.max_attempts, 2), e.title, c.name
  FROM exam_windows ew
  JOIN exams e ON e.id = ew.exam_id AND COALESCE(e.is_deleted, false) = false
  LEFT JOIN classes c ON c.id::text = ew.class_id
  WHERE auth.uid() IS NOT NULL
    AND ew.start_at <= (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
    AND ew.end_at >= (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
    AND (
      ew.class_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM profiles p
        JOIN enrollments en ON en.student_id::text = p.student_id::text
        WHERE p.id = auth.uid() AND en.class_id::text = ew.class_id
      )
    )
  ORDER BY ew.start_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.start_exam_attempt(
  p_window_id UUID,
  p_access_code TEXT
)
RETURNS public.attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window public.exam_windows%ROWTYPE;
  v_exam public.exams%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_exam_id UUID;
  v_rule JSONB;
  v_drawn UUID[];
  v_question_ids UUID[] := '{}'::UUID[];
  v_requested_count INTEGER;
  v_attempt public.attempts%ROWTYPE;
  v_failure_count INTEGER := 0;
  v_last_failure TIMESTAMPTZ;
  v_now BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_window_id::text));
  SELECT * INTO v_window FROM exam_windows WHERE id = p_window_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exam_window_not_found'; END IF;

  IF v_now < v_window.start_at OR v_now > v_window.end_at THEN
    RAISE EXCEPTION 'exam_window_closed';
  END IF;

  IF v_window.class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN enrollments en ON en.student_id::text = p.student_id::text
    WHERE p.id = v_user_id AND en.class_id::text = v_window.class_id
  ) THEN
    RAISE EXCEPTION 'exam_window_not_allowed';
  END IF;

  SELECT failure_count, last_failed_at INTO v_failure_count, v_last_failure
  FROM exam_access_failures
  WHERE user_id = v_user_id AND window_id = p_window_id;
  IF v_last_failure IS NULL OR v_last_failure < clock_timestamp() - INTERVAL '10 minutes' THEN
    v_failure_count := 0;
  END IF;
  IF v_failure_count >= 5 THEN
    RAISE EXCEPTION 'access_code_rate_limited';
  END IF;
  IF COALESCE(p_access_code, '') <> v_window.access_code THEN
    INSERT INTO exam_access_failures (user_id, window_id, failure_count, last_failed_at)
    VALUES (v_user_id, p_window_id, 1, clock_timestamp())
    ON CONFLICT (user_id, window_id) DO UPDATE SET
      failure_count = CASE
        WHEN exam_access_failures.last_failed_at < clock_timestamp() - INTERVAL '10 minutes' THEN 1
        ELSE exam_access_failures.failure_count + 1
      END,
      last_failed_at = clock_timestamp();
    RETURN NULL;
  END IF;

  IF NOT COALESCE(v_window.is_trial, false) AND COALESCE(v_window.max_attempts, 2) > 0
     AND (SELECT COUNT(*) FROM attempts WHERE user_id = v_user_id AND window_id = p_window_id)
       >= v_window.max_attempts THEN
    RAISE EXCEPTION 'attempt_limit_reached';
  END IF;

  SELECT unnest(COALESCE(NULLIF(v_window.exam_ids, '{}'::UUID[]), ARRAY[v_window.exam_id]))
  ORDER BY random() LIMIT 1 INTO v_exam_id;
  SELECT * INTO v_exam FROM exams
  WHERE id = v_exam_id AND COALESCE(is_deleted, false) = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'exam_not_available'; END IF;
  IF v_exam.locked_at IS NULL THEN RAISE EXCEPTION 'exam_not_locked'; END IF;
  IF v_exam.module_id IS NULL OR btrim(v_exam.module_id::text) = '' THEN
    RAISE EXCEPTION 'exam_no_module';
  END IF;
  IF v_exam.blueprint IS NULL OR jsonb_typeof(v_exam.blueprint) <> 'array'
     OR jsonb_array_length(v_exam.blueprint) = 0 THEN
    RAISE EXCEPTION 'exam_no_blueprint';
  END IF;

  FOR v_rule IN SELECT value FROM jsonb_array_elements(v_exam.blueprint) LOOP
    IF COALESCE(v_rule->>'count', '') !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'invalid_exam_blueprint';
    END IF;
    v_requested_count := (v_rule->>'count')::INTEGER;
    SELECT array_agg(id) INTO v_drawn FROM (
      SELECT id FROM question_bank
      WHERE module_id::text = v_exam.module_id::text
        AND (v_rule->>'topic' = '*' OR topic = v_rule->>'topic')
        AND (v_rule->>'difficulty' = '*' OR difficulty = v_rule->>'difficulty')
        AND COALESCE(is_deleted, false) = false
        AND id <> ALL(v_question_ids)
      ORDER BY random() LIMIT v_requested_count
    ) selected_questions;
    IF COALESCE(array_length(v_drawn, 1), 0) <> v_requested_count THEN
      RAISE EXCEPTION 'insufficient_questions_for_blueprint';
    END IF;
    v_question_ids := v_question_ids || v_drawn;
  END LOOP;

  INSERT INTO attempts (user_id, window_id, exam_id, status, answers, started_at, question_ids)
  VALUES (v_user_id, p_window_id, v_exam_id, 'in_progress', '{}'::JSONB, v_now, v_question_ids)
  RETURNING * INTO v_attempt;
  RETURN v_attempt;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_attempt_window_context(p_attempt_id UUID)
RETURNS TABLE (end_at BIGINT, is_trial BOOLEAN, class_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT ew.end_at, COALESCE(ew.is_trial, false), ew.class_id
  FROM attempts a
  JOIN exam_windows ew ON ew.id = a.window_id
  WHERE a.id = p_attempt_id
    AND (
      a.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'teacher'))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_attempt_answers(
  p_attempt_id UUID,
  p_answers JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_duration_minutes INTEGER;
  v_window_end BIGINT;
  v_deadline BIGINT;
  v_now BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF jsonb_typeof(COALESCE(p_answers, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;
  SELECT * INTO v_attempt FROM attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;
  SELECT e.duration_minutes, ew.end_at INTO v_duration_minutes, v_window_end
  FROM exams e JOIN exam_windows ew ON ew.id = v_attempt.window_id
  WHERE e.id = v_attempt.exam_id;
  IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_attempt.status <> 'in_progress' THEN RAISE EXCEPTION 'attempt_not_in_progress'; END IF;
  v_deadline := LEAST(v_window_end, v_attempt.started_at + v_duration_minutes * 60000);
  IF v_now > v_deadline THEN RAISE EXCEPTION 'attempt_expired'; END IF;
  IF EXISTS (
    WITH submitted AS (SELECT key FROM jsonb_object_keys(p_answers) AS key),
    allowed AS (
      SELECT id::text AS key FROM question_bank WHERE id = ANY(COALESCE(v_attempt.question_ids, '{}'::UUID[]))
      UNION
      SELECT id::text AS key FROM questions
      WHERE v_attempt.question_ids IS NULL AND exam_id = v_attempt.exam_id
    )
    SELECT 1 FROM submitted s WHERE NOT EXISTS (SELECT 1 FROM allowed a WHERE a.key = s.key)
  ) THEN RAISE EXCEPTION 'invalid_question_answer'; END IF;
  UPDATE attempts SET answers = p_answers, updated_at = now() WHERE id = p_attempt_id;
END;
$$;

DROP POLICY IF EXISTS "exam_windows_student_select" ON public.exam_windows;
DROP POLICY IF EXISTS "attempts_student_update_own" ON public.attempts;
DROP POLICY IF EXISTS "attempts_student_insert_own" ON public.attempts;

REVOKE ALL ON FUNCTION public.create_attempt_with_questions(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_available_exam_windows() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_exam_attempt(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_attempt_answers(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_attempt_window_context(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_exam_windows() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_attempt_answers(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attempt_window_context(UUID) TO authenticated;
