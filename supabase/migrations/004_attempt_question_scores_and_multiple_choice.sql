-- Phase 4: Bảng chấm tay câu tự luận + grade_attempt hỗ trợ multiple_choice
-- Chạy sau 003.

-- Bảng điểm từng câu (chấm tay cho video_paragraph, main_idea)
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

CREATE POLICY "attempt_question_scores_admin_teacher" ON attempt_question_scores
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- Cập nhật grade_attempt: hỗ trợ multiple_choice (answer_key và answer là JSON array)
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
    ELSE
      IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
        total_earned := total_earned + q.points;
      END IF;
    END IF;
  END LOOP;

  UPDATE attempts
  SET
    status = 'completed',
    raw_score = total_earned,
    score = CASE WHEN total_max > 0 THEN total_earned / total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok', true,
    'raw_score', total_earned,
    'total_max', total_max,
    'score', CASE WHEN total_max > 0 THEN total_earned / total_max ELSE 0 END
  );
END;
$$;

COMMENT ON TABLE attempt_question_scores IS 'Phase 4: Điểm từng câu chấm tay (tự luận, video_paragraph, main_idea).';
