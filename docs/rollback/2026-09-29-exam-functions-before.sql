CREATE OR REPLACE FUNCTION public.disqualify_attempt(aid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r           RECORD;
  v_total_max NUMERIC := 0;
BEGIN
  SELECT a.id, a.user_id, a.status, a.question_ids, a.exam_id
  INTO   r
  FROM   attempts a WHERE a.id = aid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  SELECT COALESCE(SUM(pts), 0)
  INTO   v_total_max
  FROM (
    SELECT qb.points AS pts
    FROM   question_bank qb
    WHERE  r.question_ids IS NOT NULL
      AND  array_length(r.question_ids, 1) IS NOT NULL
      AND  qb.id = ANY(r.question_ids)
      AND  qb.is_deleted = false
    UNION ALL
    SELECT qt.points AS pts
    FROM   questions qt
    WHERE  (r.question_ids IS NULL OR array_length(r.question_ids, 1) IS NULL)
      AND  qt.exam_id = r.exam_id
  ) sub;

  UPDATE attempts
  SET
    status       = 'completed',
    score        = 0,
    raw_score    = 0,
    total_max    = v_total_max,
    disqualified = true,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object('ok', true, 'score', 0, 'disqualified', true, 'total_max', v_total_max);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_questions_for_attempt(aid uuid)
 RETURNS TABLE(id uuid, exam_id uuid, question_type text, stem text, options jsonb, points integer, topic text, difficulty text, image_url text, media_url text, matching_right text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id      UUID;
  v_exam_id      UUID;
  v_question_ids UUID[];
  v_row          RECORD;
BEGIN
  SELECT a.user_id, a.exam_id, a.question_ids
  INTO   v_user_id, v_exam_id, v_question_ids
  FROM   attempts a
  WHERE  a.id = aid;

  IF NOT FOUND THEN RETURN; END IF;

  IF coalesce(public.get_my_exam_role(), '') NOT IN ('admin', 'teacher') THEN
    IF v_user_id IS DISTINCT FROM auth.uid() THEN
      RETURN;
    END IF;
  END IF;

  IF v_question_ids IS NULL OR array_length(v_question_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR v_row IN
    SELECT
      qb.id,
      qb.question_type,
      qb.stem,
      qb.options::JSONB  AS options,
      qb.points,
      qb.topic,
      qb.difficulty,
      qb.image_url,
      qb.media_url,
      qb.answer_key,
      qb.created_at,
      qb.updated_at
    FROM question_bank qb
    WHERE qb.id = ANY(v_question_ids)
      AND qb.is_deleted = false
    ORDER BY array_position(v_question_ids, qb.id)
  LOOP
    id            := v_row.id;
    exam_id       := v_exam_id;
    question_type := v_row.question_type;
    stem          := v_row.stem;
    options       := v_row.options;
    points        := v_row.points;
    topic         := v_row.topic;
    difficulty    := v_row.difficulty;
    image_url     := v_row.image_url;
    media_url     := v_row.media_url;
    created_at    := v_row.created_at;
    updated_at    := v_row.updated_at;

    matching_right := NULL;
    IF v_row.question_type = 'matching'
       AND v_row.answer_key IS NOT NULL
       AND v_row.answer_key != ''
    THEN
      BEGIN
        matching_right := (v_row.answer_key::JSONB -> 'right')::TEXT;
      EXCEPTION WHEN OTHERS THEN
        matching_right := NULL;
      END;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grade_attempt(aid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r            RECORD;
  q            RECORD;
  total_earned NUMERIC := 0;
  v_total_max  NUMERIC := 0;
  ans          TEXT;
  ans_json     JSONB;
  key_json     JSONB;
  ans_arr      TEXT[];
  key_arr      TEXT[];
  i            INT;
  match_flag   BOOLEAN;
  essay_sum    NUMERIC;
  essay_earned NUMERIC;
  n_items      INT;
  n_correct    INT;
  key_map      JSONB;
  kv_key       TEXT;
BEGIN
  SELECT a.id, a.user_id, a.exam_id, a.answers, a.status, a.question_ids
  INTO   r
  FROM   attempts a WHERE a.id = aid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  FOR q IN
    SELECT qb.id, qb.question_type, qb.answer_key, qb.points
    FROM   question_bank qb
    WHERE  r.question_ids IS NOT NULL
      AND  array_length(r.question_ids, 1) IS NOT NULL
      AND  qb.id = ANY(r.question_ids)
      AND  qb.is_deleted = false
    UNION ALL
    SELECT qt.id, qt.question_type, qt.answer_key, qt.points
    FROM   questions qt
    WHERE  (r.question_ids IS NULL OR array_length(r.question_ids, 1) IS NULL)
      AND  qt.exam_id = r.exam_id
  LOOP
    v_total_max := v_total_max + q.points;
    ans := r.answers->>(q.id::TEXT);

    IF q.question_type = 'multiple_choice' THEN
      BEGIN
        ans_json := ans::JSONB;
        key_json := q.answer_key::JSONB;
        IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(key_json) ORDER BY 1) INTO key_arr;
          SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json) ORDER BY 1) INTO ans_arr;
          IF ans_arr = key_arr THEN
            total_earned := total_earned + q.points;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type = 'drag_drop' THEN
      BEGIN
        ans_json := ans::JSONB;
        key_json := q.answer_key::JSONB;
        IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(key_json)) INTO key_arr;
          SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json)) INTO ans_arr;
          IF array_length(key_arr, 1) = array_length(ans_arr, 1) THEN
            match_flag := true;
            FOR i IN 1..array_length(key_arr, 1) LOOP
              IF key_arr[i] IS DISTINCT FROM ans_arr[i] THEN
                match_flag := false; EXIT;
              END IF;
            END LOOP;
            IF match_flag THEN total_earned := total_earned + q.points; END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type = 'true_false_multi' THEN
      BEGIN
        ans_json := ans::JSONB;
        key_json := q.answer_key::JSONB;
        IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(key_json)) INTO key_arr;
          SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json)) INTO ans_arr;
          n_items := array_length(key_arr, 1);
          IF n_items > 0 AND array_length(ans_arr, 1) = n_items THEN
            n_correct := 0;
            FOR i IN 1..n_items LOOP
              IF UPPER(TRIM(key_arr[i])) = UPPER(TRIM(ans_arr[i])) THEN
                n_correct := n_correct + 1;
              END IF;
            END LOOP;
            total_earned := total_earned + ROUND((q.points::NUMERIC * n_correct / n_items)::NUMERIC, 2);
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type = 'matching' THEN
      BEGIN
        key_json := q.answer_key::JSONB;
        ans_json := ans::JSONB;
        IF jsonb_typeof(key_json) = 'object' AND jsonb_typeof(ans_json) = 'object' THEN
          key_map := key_json -> 'map';
          IF jsonb_typeof(key_map) = 'object' THEN
            n_items := (SELECT COUNT(*) FROM jsonb_object_keys(key_map));
            IF n_items > 0 THEN
              n_correct := 0;
              FOR kv_key IN SELECT key FROM jsonb_each_text(key_map) LOOP
                IF (ans_json ->> kv_key) IS NOT DISTINCT FROM (key_map ->> kv_key) THEN
                  n_correct := n_correct + 1;
                END IF;
              END LOOP;
              total_earned := total_earned + ROUND((q.points::NUMERIC * n_correct / n_items)::NUMERIC, 2);
            END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type IN ('video_paragraph', 'main_idea') THEN
      key_json := NULL;
      BEGIN
        IF q.answer_key IS NOT NULL AND LENGTH(TRIM(q.answer_key)) > 0 THEN
          key_json := q.answer_key::JSONB;
          IF jsonb_typeof(key_json) != 'array' THEN key_json := NULL; END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN key_json := NULL;
      END;

      IF key_json IS NOT NULL
         AND jsonb_array_length(key_json) > 0
         AND ans IS NOT NULL AND LENGTH(TRIM(ans)) > 0
      THEN
        SELECT COALESCE(SUM(
          CASE
            WHEN kv->>'text' IS NOT NULL
              AND LENGTH(TRIM(kv->>'text')) > 0
              AND (kv->>'points')::NUMERIC > 0
              AND POSITION(LOWER(TRIM(kv->>'text')) IN LOWER(ans)) > 0
            THEN (kv->>'points')::NUMERIC
            ELSE 0
          END
        ), 0)
        INTO essay_earned
        FROM jsonb_array_elements(key_json) AS kv;

        essay_earned := LEAST(essay_earned, q.points);

        INSERT INTO attempt_question_scores (attempt_id, question_id, score, max_points)
        VALUES (aid, q.id, essay_earned, q.points)
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET score = EXCLUDED.score, max_points = EXCLUDED.max_points;
      END IF;

    ELSE
      IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
        total_earned := total_earned + q.points;
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(score), 0) INTO essay_sum
  FROM attempt_question_scores WHERE attempt_id = aid;

  UPDATE attempts
  SET
    status       = 'completed',
    raw_score    = total_earned + essay_sum,
    total_max    = v_total_max,
    score        = CASE WHEN v_total_max > 0 THEN (total_earned + essay_sum) / v_total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok',        true,
    'raw_score', total_earned + essay_sum,
    'total_max', v_total_max,
    'score',     CASE WHEN v_total_max > 0 THEN (total_earned + essay_sum) / v_total_max ELSE 0 END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_attempt_answers(p_attempt_id uuid, p_answers jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_duration_minutes INTEGER;
  v_window_end BIGINT;
  v_deadline BIGINT;
  v_now BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF jsonb_typeof(COALESCE(p_answers,'{}'::JSONB)) <> 'object' THEN RAISE EXCEPTION 'invalid_answers'; END IF;
  SELECT * INTO v_attempt FROM attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;
  SELECT e.duration_minutes, ew.end_at INTO v_duration_minutes, v_window_end
  FROM exams e JOIN exam_windows ew ON ew.id = v_attempt.window_id WHERE e.id = v_attempt.exam_id;
  IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_attempt.status <> 'in_progress' THEN RAISE EXCEPTION 'attempt_not_in_progress'; END IF;
  v_deadline := LEAST(v_window_end, v_attempt.started_at + v_duration_minutes * 60000);
  IF v_now > v_deadline THEN RAISE EXCEPTION 'attempt_expired'; END IF;
  IF EXISTS (
    WITH submitted AS (SELECT key FROM jsonb_object_keys(p_answers) AS key),
    allowed AS (
      SELECT id::text AS key FROM question_bank WHERE id = ANY(COALESCE(v_attempt.question_ids,'{}'::UUID[]))
      UNION
      SELECT id::text AS key FROM questions WHERE v_attempt.question_ids IS NULL AND exam_id = v_attempt.exam_id
    )
    SELECT 1 FROM submitted s WHERE NOT EXISTS (SELECT 1 FROM allowed a WHERE a.key = s.key)
  ) THEN RAISE EXCEPTION 'invalid_question_answer'; END IF;
  UPDATE attempts SET answers = p_answers, updated_at = now() WHERE id = p_attempt_id;
END;
$function$;

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
