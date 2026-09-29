-- Depends on the shared TTDT exam_role migration (20260925014616).
-- Existing completed attempts retain their original scores. New attempts capture an immutable paper.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS exam_private;
REVOKE ALL ON SCHEMA exam_private FROM PUBLIC, anon, authenticated;
CREATE TABLE exam_private.attempt_papers (
  attempt_id uuid PRIMARY KEY REFERENCES public.attempts(id) ON DELETE CASCADE,
  questions jsonb NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  deadline bigint NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE exam_private.attempt_papers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exam_private.attempt_papers FROM PUBLIC, anon, authenticated;

CREATE FUNCTION exam_private.capture_attempt_paper()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE paper jsonb; deadline_ms bigint;
BEGIN
  IF coalesce(cardinality(NEW.question_ids), 0) = 0 THEN RETURN NEW; END IF;
  SELECT jsonb_agg(to_jsonb(q) ORDER BY array_position(NEW.question_ids, q.id)) INTO paper
  FROM (SELECT * FROM public.question_bank WHERE id = ANY(NEW.question_ids) FOR SHARE) q;
  IF coalesce(jsonb_array_length(paper), 0) <> cardinality(NEW.question_ids) THEN
    RAISE EXCEPTION 'incomplete_attempt_paper';
  END IF;
  SELECT LEAST(w.end_at, NEW.started_at + e.duration_minutes::bigint * 60000)
  INTO deadline_ms FROM public.exams e JOIN public.exam_windows w ON w.id = NEW.window_id
  WHERE e.id = NEW.exam_id;
  INSERT INTO exam_private.attempt_papers(attempt_id, questions, deadline)
  VALUES (NEW.id, paper, deadline_ms);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.capture_attempt_paper() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_attempt_paper AFTER INSERT ON public.attempts
FOR EACH ROW EXECUTE FUNCTION exam_private.capture_attempt_paper();

-- No backfill: an earlier paper cannot be reconstructed honestly from today's question bank.
CREATE FUNCTION exam_private.bank_questions(aid uuid)
RETURNS SETOF public.question_bank LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE paper jsonb;
BEGIN
  SELECT questions INTO paper FROM exam_private.attempt_papers WHERE attempt_id = aid;
  IF FOUND THEN
    RETURN QUERY SELECT * FROM jsonb_populate_recordset(NULL::public.question_bank, paper);
  ELSE
    RETURN QUERY SELECT q.* FROM public.question_bank q JOIN public.attempts a
      ON a.id = aid AND q.id = ANY(a.question_ids);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.bank_questions(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION exam_private.attempt_deadline(aid uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(p.deadline, LEAST(w.end_at, a.started_at + e.duration_minutes::bigint * 60000))
  FROM public.attempts a JOIN public.exams e ON e.id = a.exam_id
  JOIN public.exam_windows w ON w.id = a.window_id
  LEFT JOIN exam_private.attempt_papers p ON p.attempt_id = a.id WHERE a.id = aid;
$$;
REVOKE ALL ON FUNCTION exam_private.attempt_deadline(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_attempt_window_context(p_attempt_id uuid)
RETURNS TABLE(end_at bigint,is_trial boolean,class_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT exam_private.attempt_deadline(a.id),coalesce(w.is_trial,false),w.class_id::text
  FROM public.attempts a JOIN public.exam_windows w ON w.id = a.window_id
  WHERE a.id = p_attempt_id AND auth.uid() IS NOT NULL
    AND (a.user_id = auth.uid() OR coalesce(public.get_my_exam_role(),'') IN ('admin','teacher'));
$$;
REVOKE ALL ON FUNCTION public.get_attempt_window_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_window_context(uuid) TO authenticated;

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
    FROM exam_private.bank_questions(aid) qb
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
  FROM   attempts a WHERE a.id = aid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  FOR q IN
    SELECT qb.id, qb.question_type, qb.answer_key, qb.points
    FROM   exam_private.bank_questions(aid) qb
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
  FROM   attempts a WHERE a.id = aid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  SELECT COALESCE(SUM(pts), 0)
  INTO   v_total_max
  FROM (
    SELECT qb.points AS pts
    FROM   exam_private.bank_questions(aid) qb
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
  v_deadline := exam_private.attempt_deadline(p_attempt_id);
  v_now := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  IF v_now > v_deadline THEN RAISE EXCEPTION 'attempt_expired'; END IF;
  IF EXISTS (
    WITH submitted AS (SELECT key FROM jsonb_object_keys(p_answers) AS key),
    allowed AS (
      SELECT id::text AS key FROM exam_private.bank_questions(p_attempt_id) WHERE id = ANY(COALESCE(v_attempt.question_ids,'{}'::UUID[]))
      UNION
      SELECT id::text AS key FROM questions WHERE v_attempt.question_ids IS NULL AND exam_id = v_attempt.exam_id
    )
    SELECT 1 FROM submitted s WHERE NOT EXISTS (SELECT 1 FROM allowed a WHERE a.key = s.key)
  ) THEN RAISE EXCEPTION 'invalid_question_answer'; END IF;
  UPDATE attempts SET answers = p_answers, updated_at = now() WHERE id = p_attempt_id;
END;
$function$;

CREATE FUNCTION public.finalize_exam_attempt(p_attempt_id uuid, p_answers jsonb DEFAULT NULL, p_disqualify boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.attempts; result jsonb; deadline_ms bigint;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  SELECT * INTO a FROM public.attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;
  IF a.user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF a.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'score', a.score, 'raw_score', a.raw_score, 'total_max', a.total_max);
  END IF;
  IF a.status <> 'in_progress' THEN RAISE EXCEPTION 'attempt_not_in_progress'; END IF;
  deadline_ms := exam_private.attempt_deadline(a.id);
  IF p_answers IS NOT NULL AND (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint <= deadline_ms THEN
    BEGIN
      PERFORM public.save_attempt_answers(a.id, p_answers);
    EXCEPTION WHEN raise_exception THEN
      -- The deadline may elapse between the two checks. Never accept late answers.
      IF SQLERRM <> 'attempt_expired' THEN RAISE; END IF;
    END;
  END IF;
  IF p_disqualify THEN result := public.disqualify_attempt(a.id);
  ELSE result := public.grade_attempt(a.id);
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_exam_attempt(uuid,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_exam_attempt(uuid,jsonb,boolean) TO authenticated, service_role;

-- Only the scheduled server worker may enumerate and finish expired attempts.
CREATE FUNCTION public.finalize_expired_exam_attempts(p_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a record; processed integer := 0; result jsonb;
BEGIN
  FOR a IN
    SELECT t.id FROM public.attempts t
    JOIN exam_private.attempt_papers p ON p.attempt_id = t.id
    WHERE t.status = 'in_progress' AND p.deadline < (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
    ORDER BY p.deadline LIMIT LEAST(GREATEST(p_limit, 1), 100) FOR UPDATE OF t SKIP LOCKED
  LOOP
    result := public.finalize_exam_attempt(a.id);
    IF coalesce((result->>'ok')::boolean, false) THEN processed := processed + 1; END IF;
  END LOOP;
  RETURN processed;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_expired_exam_attempts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_expired_exam_attempts(integer) TO service_role;
COMMIT;

