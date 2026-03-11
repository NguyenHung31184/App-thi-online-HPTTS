-- Sửa lỗi 404 khi gọi rpc/grade_attempt: đảm bảo function tồn tại và được GRANT cho authenticated.
-- Chạy trong Supabase SQL Editor (project App Thi) nếu nộp bài báo 404 Not Found.

-- 1. Cột auto_earned (cần cho phiên bản grade_attempt đầy đủ)
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS auto_earned NUMERIC(5,4);

-- 2. Bảng attempt_question_scores (nếu chưa có — dùng cho chấm tự luận)
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

-- 3. Function grade_attempt (phiên bản đầy đủ: single_choice, multiple_choice, drag_drop, tự luận)
-- Dùng schema public để PostgREST chắc chắn nhận RPC.
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
  total_max NUMERIC := 0;
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

  SELECT COALESCE(SUM(score), 0) INTO essay_sum
  FROM attempt_question_scores
  WHERE attempt_id = aid;

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

REVOKE EXECUTE ON FUNCTION public.grade_attempt(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.grade_attempt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_attempt(UUID) TO service_role;

COMMENT ON FUNCTION public.grade_attempt(UUID) IS 'Chấm bài: single_choice, multiple_choice, drag_drop tự động; video_paragraph/main_idea qua attempt_question_scores.';
