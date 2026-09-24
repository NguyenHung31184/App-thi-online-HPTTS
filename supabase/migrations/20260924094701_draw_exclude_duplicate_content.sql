-- A module shared by several courses can hold one copy of the same question per course
-- (QTHH-AT: 600 rows, 150 distinct questions). The draw used to exclude repeats by id only,
-- so one attempt could receive the same question two or more times.
--
-- Two rows count as the same question when stem and options match after lowercasing and
-- collapsing whitespace. The image URL is ignored because each course copy uploaded its own
-- image file; when copies differ, the one that has an image is preferred.
--
-- Everything else is unchanged from the definition in production on 2026-09-24
-- (window, class, access code, rate limit, attempt limit, lock and blueprint checks).

CREATE OR REPLACE FUNCTION public.start_exam_attempt(p_window_id uuid, p_access_code text)
 RETURNS attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_window public.exam_windows%ROWTYPE; v_exam public.exams%ROWTYPE; v_user_id UUID := auth.uid(); v_exam_id UUID; v_rule JSONB; v_drawn UUID[]; v_drawn_keys TEXT[]; v_question_ids UUID[] := '{}'::UUID[]; v_used_keys TEXT[] := '{}'::TEXT[]; v_requested_count INTEGER; v_attempt public.attempts%ROWTYPE; v_failure_count INTEGER := 0; v_last_failure TIMESTAMPTZ; v_now BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_window_id::text)); SELECT * INTO v_window FROM exam_windows WHERE id = p_window_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'exam_window_not_found'; END IF;
 IF v_now < v_window.start_at OR v_now > v_window.end_at THEN RAISE EXCEPTION 'exam_window_closed'; END IF;
 IF v_window.class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles p JOIN enrollments en ON en.student_id::text = p.student_id::text WHERE p.id = v_user_id AND en.class_id::text = v_window.class_id) THEN RAISE EXCEPTION 'exam_window_not_allowed'; END IF;
 SELECT failure_count, last_failed_at INTO v_failure_count, v_last_failure FROM exam_access_failures WHERE user_id = v_user_id AND window_id = p_window_id;
 IF v_last_failure IS NULL OR v_last_failure < clock_timestamp() - INTERVAL '10 minutes' THEN v_failure_count := 0; END IF; IF v_failure_count >= 5 THEN RAISE EXCEPTION 'access_code_rate_limited'; END IF;
 IF COALESCE(p_access_code, '') <> v_window.access_code THEN INSERT INTO exam_access_failures (user_id, window_id, failure_count, last_failed_at) VALUES (v_user_id, p_window_id, 1, clock_timestamp()) ON CONFLICT (user_id, window_id) DO UPDATE SET failure_count = CASE WHEN exam_access_failures.last_failed_at < clock_timestamp() - INTERVAL '10 minutes' THEN 1 ELSE exam_access_failures.failure_count + 1 END, last_failed_at = clock_timestamp(); RETURN NULL; END IF;
 IF NOT COALESCE(v_window.is_trial, false) AND COALESCE(v_window.max_attempts, 2) > 0 AND (SELECT COUNT(*) FROM attempts WHERE user_id = v_user_id AND window_id = p_window_id) >= v_window.max_attempts THEN RAISE EXCEPTION 'attempt_limit_reached'; END IF;
 SELECT unnest(COALESCE(NULLIF(v_window.exam_ids, '{}'::UUID[]), ARRAY[v_window.exam_id])) ORDER BY random() LIMIT 1 INTO v_exam_id; SELECT * INTO v_exam FROM exams WHERE id = v_exam_id AND COALESCE(is_deleted, false) = false; IF NOT FOUND THEN RAISE EXCEPTION 'exam_not_available'; END IF; IF v_exam.locked_at IS NULL THEN RAISE EXCEPTION 'exam_not_locked'; END IF; IF v_exam.module_id IS NULL OR btrim(v_exam.module_id::text) = '' THEN RAISE EXCEPTION 'exam_no_module'; END IF; IF v_exam.blueprint IS NULL OR jsonb_typeof(v_exam.blueprint) <> 'array' OR jsonb_array_length(v_exam.blueprint) = 0 THEN RAISE EXCEPTION 'exam_no_blueprint'; END IF;
 FOR v_rule IN SELECT value FROM jsonb_array_elements(v_exam.blueprint) LOOP
  IF COALESCE(v_rule->>'count', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'invalid_exam_blueprint'; END IF;
  v_requested_count := (v_rule->>'count')::INTEGER;
  -- One row per distinct question (content_key), then a random pick among them.
  -- v_used_keys also stops a later blueprint rule from drawing a question an earlier rule took.
  SELECT array_agg(id), array_agg(content_key) INTO v_drawn, v_drawn_keys FROM (
   SELECT id, content_key FROM (
    SELECT DISTINCT ON (content_key) id, content_key FROM (
     SELECT id, image_url,
      lower(regexp_replace(btrim(COALESCE(stem, '')), '\s+', ' ', 'g')) || '|' || lower(regexp_replace(COALESCE(options::text, ''), '\s+', ' ', 'g')) AS content_key
     FROM question_bank
     WHERE module_id::text = v_exam.module_id::text AND (v_rule->>'topic' = '*' OR topic = v_rule->>'topic') AND (v_rule->>'difficulty' = '*' OR difficulty = v_rule->>'difficulty') AND COALESCE(is_deleted, false) = false AND COALESCE(status, 'published') = 'published' AND id <> ALL(v_question_ids)
    ) candidates
    WHERE content_key <> ALL(v_used_keys)
    ORDER BY content_key, (image_url IS NULL), random()
   ) distinct_questions
   ORDER BY random() LIMIT v_requested_count
  ) selected_questions;
  IF COALESCE(array_length(v_drawn, 1), 0) <> v_requested_count THEN RAISE EXCEPTION 'insufficient_questions_for_blueprint'; END IF;
  v_question_ids := v_question_ids || v_drawn;
  v_used_keys := v_used_keys || v_drawn_keys;
 END LOOP;
 INSERT INTO attempts (user_id, window_id, exam_id, status, answers, started_at, question_ids) VALUES (v_user_id, p_window_id, v_exam_id, 'in_progress', '{}'::JSONB, v_now, v_question_ids) RETURNING * INTO v_attempt; RETURN v_attempt;
END; $function$;
