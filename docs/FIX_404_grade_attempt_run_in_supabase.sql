-- SỬA LỖI 404 KHI NỘP BÀI (POST .../rpc/grade_attempt 404 Not Found)
--
-- Quan trọng: Chạy script này trên ĐÚNG project Supabase mà app đang gọi.
-- Xem URL lỗi: https://XXXX.supabase.co/rest/v1/rpc/grade_attempt → project là XXXX.
-- Chi tiết: xem file docs/HUONG_DAN_SUA_404_NOP_BAI.md
--
-- Cách chạy: Supabase Dashboard → chọn project XXXX → SQL Editor → New query → dán toàn bộ file → Run.

-- 1. Cột bảng attempts (nếu chưa có)
-- Lưu ý: không dùng NUMERIC(5,4) vì tổng điểm có thể > 10 gây "numeric field overflow".
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS auto_earned NUMERIC;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS total_max NUMERIC;

-- Nếu cột đã tồn tại kiểu NUMERIC(5,4) từ bản cũ, nới kiểu để tránh overflow.
ALTER TABLE attempts ALTER COLUMN auto_earned TYPE NUMERIC;

-- 2. Bảng chấm tự luận (nếu chưa có)
CREATE TABLE IF NOT EXISTS attempt_question_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  max_points NUMERIC NOT NULL DEFAULT 0,
  graded_by UUID,
  graded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_attempt_question_scores_attempt ON attempt_question_scores(attempt_id);
ALTER TABLE attempt_question_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attempt_question_scores_admin_teacher" ON attempt_question_scores;
CREATE POLICY "attempt_question_scores_admin_teacher" ON attempt_question_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );

-- 3. Function grade_attempt (chấm bài + ghi total_max)
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

  -- Chỉ chấm những câu có trong answers (tránh lặp toàn bộ câu hỏi của đề → timeout khi đề nhiều câu).
  FOR q IN
    SELECT q2.id, q2.question_type, q2.answer_key, q2.points
    FROM questions q2
    WHERE q2.exam_id = r.exam_id
      AND (r.answers ? q2.id::text)
  LOOP
    -- Lưu answers theo key là question_id dạng string, nên phải cast UUID -> text
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

-- 4. Cho phép authenticated và service_role gọi RPC (bắt buộc để hết 404)
REVOKE EXECUTE ON FUNCTION public.grade_attempt(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.grade_attempt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_attempt(UUID) TO service_role;

COMMENT ON FUNCTION public.grade_attempt(UUID) IS 'Chấm bài khi nộp; ghi total_max vào attempts.';
