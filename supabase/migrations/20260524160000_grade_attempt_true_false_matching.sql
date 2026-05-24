-- Mở rộng grade_attempt() để chấm 2 loại câu hỏi mới:
--
-- true_false_multi: answer_key = JSON array ["T","F","T","F"]
--   student answer = JSON array ["T","F","T","F"]
--   Điểm: partial — mỗi phát biểu đúng đóng góp (points / n_statements)
--
-- matching: answer_key = JSON object {"right":["text1",...], "map":{"A":"1","B":"2",...}}
--   student answer = JSON object {"A":"1","B":"2",...}
--   Điểm: partial — mỗi cặp đúng đóng góp (points / n_pairs)

CREATE OR REPLACE FUNCTION grade_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  q RECORD;
  total_earned NUMERIC := 0;
  total_max    NUMERIC := 0;
  ans TEXT;
  ans_json     JSONB;
  key_json     JSONB;
  ans_arr      TEXT[];
  key_arr      TEXT[];
  i            INT;
  match        BOOLEAN;
  essay_sum    NUMERIC;
  essay_earned NUMERIC;
  -- true_false_multi / matching
  n_items      INT;
  n_correct    INT;
  key_map      JSONB;
  student_val  TEXT;
BEGIN
  SELECT a.id, a.user_id, a.exam_id, a.answers, a.status INTO r
  FROM attempts a WHERE a.id = aid;
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
    SELECT id, question_type, answer_key, points
    FROM questions
    WHERE exam_id = r.exam_id
  LOOP
    total_max := total_max + q.points;
    ans := r.answers->>q.id;

    IF q.question_type = 'multiple_choice' THEN
      BEGIN
        ans_json := ans::jsonb;
        key_json := q.answer_key::jsonb;
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
        ans_json := ans::jsonb;
        key_json := q.answer_key::jsonb;
        IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(key_json)) INTO key_arr;
          SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json)) INTO ans_arr;
          IF array_length(key_arr, 1) = array_length(ans_arr, 1) THEN
            match := true;
            FOR i IN 1..array_length(key_arr, 1) LOOP
              IF key_arr[i] IS DISTINCT FROM ans_arr[i] THEN
                match := false;
                EXIT;
              END IF;
            END LOOP;
            IF match THEN
              total_earned := total_earned + q.points;
            END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type = 'true_false_multi' THEN
      -- answer_key: ["T","F","T","F"]  /  student ans: ["T","F","T","F"]
      BEGIN
        ans_json := ans::jsonb;
        key_json := q.answer_key::jsonb;
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
      -- answer_key: {"right":[...],"map":{"A":"1","B":"2",...}}
      -- student ans: {"A":"1","B":"2",...}
      BEGIN
        key_json := q.answer_key::jsonb;
        ans_json := ans::jsonb;
        IF jsonb_typeof(key_json) = 'object' AND jsonb_typeof(ans_json) = 'object' THEN
          key_map := key_json->'map';
          IF jsonb_typeof(key_map) = 'object' THEN
            n_items := (SELECT COUNT(*) FROM jsonb_object_keys(key_map));
            IF n_items > 0 THEN
              n_correct := 0;
              FOR student_val IN
                SELECT kv.key FROM jsonb_each_text(key_map) kv
              LOOP
                IF (ans_json->>student_val) IS NOT DISTINCT FROM (key_map->>student_val) THEN
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
          key_json := q.answer_key::jsonb;
          IF jsonb_typeof(key_json) != 'array' THEN key_json := NULL; END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN key_json := NULL;
      END;

      IF key_json IS NOT NULL
         AND jsonb_array_length(key_json) > 0
         AND ans IS NOT NULL
         AND LENGTH(TRIM(ans)) > 0
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
      -- single_choice
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
    auto_earned  = total_earned,
    raw_score    = total_earned + essay_sum,
    score        = CASE WHEN total_max > 0 THEN (total_earned + essay_sum) / total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok',        true,
    'raw_score', total_earned + essay_sum,
    'total_max', total_max,
    'score',     CASE WHEN total_max > 0 THEN (total_earned + essay_sum) / total_max ELSE 0 END
  );
END;
$$;

COMMENT ON FUNCTION grade_attempt(UUID) IS
  'Chấm bài: single_choice/multiple_choice/drag_drop (all-or-nothing); '
  'true_false_multi/matching (partial credit theo số đúng/tổng); '
  'video_paragraph/main_idea (key matching hoặc GV chấm thủ công).';
