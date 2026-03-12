-- Phase 4: Lưu điểm tự động (auto_earned) + RPC cập nhật điểm sau khi chấm tự luận
-- Chạy sau 005.

-- Cột điểm từ chấm tự động (để cộng với điểm tự luận khi GV chấm xong)
-- Không dùng NUMERIC(5,4) vì tổng điểm có thể > 10 gây overflow.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS auto_earned NUMERIC;
ALTER TABLE attempts ALTER COLUMN auto_earned TYPE NUMERIC;

-- Backfill: attempts đã completed coi raw_score hiện tại = auto_earned
UPDATE attempts SET auto_earned = raw_score WHERE status = 'completed' AND auto_earned IS NULL;

-- Cập nhật grade_attempt: ghi auto_earned khi nộp bài
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
      ans_json := ans::jsonb;
      key_json := q.answer_key::jsonb;
      IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(key_json) ORDER BY 1) INTO key_arr;
        SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json) ORDER BY 1) INTO ans_arr;
        IF ans_arr = key_arr THEN
          total_earned := total_earned + q.points;
        END IF;
      END IF;
    ELSIF q.question_type = 'drag_drop' THEN
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
    ELSIF q.question_type IN ('video_paragraph', 'main_idea') THEN
      NULL;
    ELSE
      IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
        total_earned := total_earned + q.points;
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(score), 0) INTO essay_sum FROM attempt_question_scores WHERE attempt_id = aid;

  UPDATE attempts
  SET
    status = 'completed',
    auto_earned = total_earned,
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

-- RPC: Cập nhật điểm tổng attempt sau khi GV chấm/sửa điểm tự luận
CREATE OR REPLACE FUNCTION recompute_attempt_score(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  total_max NUMERIC := 0;
  essay_sum NUMERIC := 0;
  new_raw NUMERIC;
  new_score NUMERIC;
BEGIN
  SELECT a.id, a.auto_earned, a.exam_id INTO r FROM attempts a WHERE a.id = aid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF get_my_role() NOT IN ('admin', 'teacher') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO total_max FROM questions WHERE exam_id = r.exam_id;
  SELECT COALESCE(SUM(score), 0) INTO essay_sum FROM attempt_question_scores WHERE attempt_id = aid;

  new_raw := COALESCE(r.auto_earned, 0) + essay_sum;
  new_score := CASE WHEN total_max > 0 THEN new_raw / total_max ELSE 0 END;

  UPDATE attempts
  SET raw_score = new_raw, score = new_score, updated_at = now()
  WHERE id = aid;

  RETURN jsonb_build_object('ok', true, 'raw_score', new_raw, 'total_max', total_max, 'score', new_score);
END;
$$;

REVOKE EXECUTE ON FUNCTION recompute_attempt_score(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION recompute_attempt_score(UUID) TO authenticated;

COMMENT ON FUNCTION recompute_attempt_score(UUID) IS 'Cập nhật raw_score và score của attempt sau khi chấm/sửa điểm tự luận (attempt_question_scores).';
