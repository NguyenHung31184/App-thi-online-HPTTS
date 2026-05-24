-- Essay key-based grading: chấm câu tự luận tự động bằng key matching
-- answer_key của video_paragraph/main_idea có thể là JSON array:
--   [{"text": "tai nạn", "points": 2}, {"text": "sai quy trình", "points": 2}, ...]
-- Matching: case-insensitive substring (POSITION)
-- Nếu answer_key rỗng hoặc không phải JSON array → skip (0 điểm, GV chấm thủ công)
-- GV vẫn có thể override điểm qua AdminEssayGradingPage → recomputeAttemptScore

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
  total_max NUMERIC := 0;
  ans TEXT;
  ans_json JSONB;
  key_json JSONB;
  ans_arr TEXT[];
  key_arr TEXT[];
  i INT;
  match BOOLEAN;
  essay_sum NUMERIC;
  essay_earned NUMERIC;
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
      EXCEPTION WHEN OTHERS THEN
        NULL;
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
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

    ELSIF q.question_type IN ('video_paragraph', 'main_idea') THEN
      -- Thử parse answer_key thành JSON array keys
      key_json := NULL;
      BEGIN
        IF q.answer_key IS NOT NULL AND LENGTH(TRIM(q.answer_key)) > 0 THEN
          key_json := q.answer_key::jsonb;
          IF jsonb_typeof(key_json) != 'array' THEN
            key_json := NULL;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        key_json := NULL;
      END;

      IF key_json IS NOT NULL
         AND jsonb_array_length(key_json) > 0
         AND ans IS NOT NULL
         AND LENGTH(TRIM(ans)) > 0
      THEN
        -- Tính điểm key: cộng điểm từng key xuất hiện trong bài làm (substring, case-insensitive)
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

        -- Không cho vượt điểm tối đa của câu
        essay_earned := LEAST(essay_earned, q.points);

        -- Lưu vào attempt_question_scores để GV có thể xem và override
        INSERT INTO attempt_question_scores (attempt_id, question_id, score, max_points)
        VALUES (aid, q.id, essay_earned, q.points)
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET score = EXCLUDED.score, max_points = EXCLUDED.max_points;
      END IF;
      -- Nếu key_json NULL (answer_key rỗng): không insert → GV chấm thủ công

    ELSE
      -- single_choice
      IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
        total_earned := total_earned + q.points;
      END IF;
    END IF;
  END LOOP;

  -- essay_sum bao gồm cả điểm key tự động (đã insert ở trên) và điểm GV chấm thủ công
  SELECT COALESCE(SUM(score), 0) INTO essay_sum
  FROM attempt_question_scores WHERE attempt_id = aid;

  UPDATE attempts
  SET
    status = 'completed',
    auto_earned = total_earned,  -- chỉ tính phần trắc nghiệm/drag_drop
    raw_score = total_earned + essay_sum,
    score = CASE WHEN total_max > 0 THEN (total_earned + essay_sum) / total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok', true,
    'raw_score', total_earned + essay_sum,
    'total_max', total_max,
    'score', CASE WHEN total_max > 0 THEN (total_earned + essay_sum) / total_max ELSE 0 END
  );
END;
$$;

COMMENT ON FUNCTION grade_attempt(UUID) IS
  'Chấm bài thi: trắc nghiệm/drag_drop tự động; essay dùng key matching (JSON array answer_key) hoặc để GV chấm thủ công nếu answer_key rỗng.';
