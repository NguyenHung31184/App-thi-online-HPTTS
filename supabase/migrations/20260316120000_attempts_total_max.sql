-- Lưu total_max vào attempts khi chấm bài để trang kết quả hiển thị đúng (thí sinh không đọc được bảng questions do RLS).
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS total_max NUMERIC;

COMMENT ON COLUMN attempts.total_max IS 'Tổng điểm tối đa của đề (sum questions.points) tại thời điểm nộp bài; dùng cho màn kết quả.';

-- Cập nhật grade_attempt ghi total_max vào bản ghi attempt
CREATE OR REPLACE FUNCTION public.grade_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  q RECORD;
  total_earned NUMERIC := 0;
  v_total_max NUMERIC := 0;
  ans TEXT;
  ans_json JSONB;
  key_json JSONB;
  ans_arr TEXT[];
  key_arr TEXT[];
  i INT;
  match BOOLEAN;
  essay_sum NUMERIC := 0;
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

  -- Tổng điểm tối đa phải tính theo TOÀN BỘ câu của đề (không phụ thuộc số câu đã làm),
  -- nếu không thí sinh làm đúng vài câu cũng có thể "Đạt" vì mẫu số nhỏ.
  SELECT COALESCE(SUM(points), 0) INTO v_total_max
  FROM questions
  WHERE exam_id = r.exam_id;

  -- Chỉ chấm những câu có trong answers (tránh timeout khi đề có nhiều câu trong DB).
  FOR q IN
    SELECT q2.id, q2.question_type, q2.answer_key, q2.points
    FROM questions q2
    WHERE q2.exam_id = r.exam_id
      AND (r.answers ? q2.id::text)
  LOOP
    ans := r.answers->>(q.id::text);

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

  SELECT COALESCE(SUM(score), 0) INTO essay_sum
  FROM attempt_question_scores
  WHERE attempt_id = aid;

  UPDATE attempts
  SET
    status = 'completed',
    auto_earned = total_earned,
    raw_score = total_earned + essay_sum,
    total_max = v_total_max,
    score = CASE WHEN v_total_max > 0 THEN (total_earned + essay_sum) / v_total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok', true,
    'raw_score', total_earned + essay_sum,
    'total_max', v_total_max,
    'score', CASE WHEN v_total_max > 0 THEN (total_earned + essay_sum) / v_total_max ELSE 0 END
  );
END;
$$;

COMMENT ON FUNCTION public.grade_attempt(UUID) IS 'Chấm bài: ghi total_max vào attempts để trang kết quả hiển thị đúng tổng điểm.';
