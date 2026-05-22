-- Fix #3: Thay cơ chế "snapshot file trên Storage" bằng cột locked_at.
--   Khi locked_at IS NOT NULL → đề đã khóa, không cho sửa/xóa câu hỏi.
-- Fix #6: Soft-delete cho questions và question_bank (is_deleted + deleted_at).
--   Xóa mềm thay cho DELETE cứng → giữ audit trail, bài làm không mất tham chiếu.

-- ============================================================
-- 1. Thêm locked_at vào bảng exams
-- ============================================================
ALTER TABLE exams ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- ============================================================
-- 2. Soft-delete cho bảng questions
-- ============================================================
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_questions_is_deleted ON questions(is_deleted);

-- ============================================================
-- 3. Soft-delete cho bảng question_bank
-- ============================================================
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_question_bank_is_deleted ON question_bank(is_deleted);

-- ============================================================
-- 4. Cập nhật view questions_for_student: loại câu đã xóa mềm
-- ============================================================
CREATE OR REPLACE VIEW questions_for_student AS
  SELECT id, exam_id, question_type, stem, options, points, topic, difficulty,
         image_url, media_url, created_at, updated_at
  FROM questions
  WHERE is_deleted = false;

-- ============================================================
-- 5. Cập nhật RPC grade_attempt: bỏ qua câu đã xóa mềm
-- ============================================================
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
    SELECT id, answer_key, points
    FROM questions
    WHERE exam_id = r.exam_id
      AND is_deleted = false
  LOOP
    total_max := total_max + q.points;
    ans := r.answers->>q.id;
    IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
      total_earned := total_earned + q.points;
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

COMMENT ON COLUMN exams.locked_at IS
  'Thời điểm khóa đề. Khi IS NOT NULL: không cho thêm/sửa/xóa câu hỏi.';
COMMENT ON COLUMN questions.is_deleted IS
  'Soft-delete: true = đã xóa mềm, không hiển thị nhưng giữ để audit.';
COMMENT ON COLUMN question_bank.is_deleted IS
  'Soft-delete: true = đã xóa mềm khỏi ngân hàng.';
