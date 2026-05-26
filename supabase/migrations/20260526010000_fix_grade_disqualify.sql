-- ===================================================================
-- Fix 1: grade_attempt — doi ten bien local total_max → v_total_max
--   Tranh loi "column reference total_max is ambiguous" vi bang attempts
--   co cot total_max (them tu migration 20260316120000).
--   Dong thoi them total_max = v_total_max vao UPDATE de luu dung.
--
-- Fix 2: them ham disqualify_attempt(aid UUID)
--   Danh dau attempt da vi pham: score=0, disqualified=true, khong tinh diem.
--   Goi khi hoc vien du 5 lan vi pham (thay vi goi grade_attempt).
-- ===================================================================

-- ───────────────────────────────────────────────────────────────────
-- 1. grade_attempt: doi v_total_max, bo sung ghi total_max vao DB
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION grade_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r            RECORD;
  q            RECORD;
  total_earned NUMERIC := 0;
  v_total_max  NUMERIC := 0;  -- prefix v_ tranh ambiguous voi cot attempts.total_max
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

  -- Dual-path: attempt moi (question_ids) → question_bank
  --            attempt cu  (question_ids NULL) → questions table
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
      -- single_choice (default)
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
$$;

COMMENT ON FUNCTION grade_attempt(UUID) IS
  'Cham bai: question_bank (moi) va questions table (cu). '
  'Doi ten bien v_total_max de tranh ambiguous voi cot attempts.total_max.';

-- ───────────────────────────────────────────────────────────────────
-- 2. disqualify_attempt: danh dau vi pham, score=0, khong tinh diem
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION disqualify_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT a.id, a.user_id, a.status
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

  UPDATE attempts
  SET
    status       = 'completed',
    score        = 0,
    raw_score    = 0,
    total_max    = NULL,
    disqualified = true,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object('ok', true, 'score', 0, 'disqualified', true);
END;
$$;

GRANT EXECUTE ON FUNCTION disqualify_attempt(UUID) TO authenticated;

COMMENT ON FUNCTION disqualify_attempt(UUID) IS
  'Danh dau bai thi bi huy do vi pham: score=0, disqualified=true. '
  'Khong tinh diem — dung khi hoc vien du so lan vi pham quy dinh.';
