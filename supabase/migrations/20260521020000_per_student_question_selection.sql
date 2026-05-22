-- Per-student question selection: mỗi thí sinh bốc thăm bộ câu riêng từ question_bank
-- khi tạo attempt, thay vì tất cả cùng dùng bộ câu cố định trong bảng questions.
--
-- Backward compatible: bài làm cũ (question_ids IS NULL) vẫn chấm từ bảng questions.

-- ============================================================
-- 1. Thêm cột question_ids vào attempts
-- ============================================================
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS question_ids UUID[];

-- ============================================================
-- 2. RPC tạo attempt và bốc thăm câu hỏi từ ngân hàng
--    Đọc blueprint từ exam, bốc ngẫu nhiên từ question_bank theo từng rule.
-- ============================================================
CREATE OR REPLACE FUNCTION create_attempt_with_questions(
  p_window_id UUID,
  p_exam_id   UUID
)
RETURNS attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint  JSONB;
  v_module_id  TEXT;
  v_rule       JSONB;
  v_drawn      UUID[];
  v_all_ids    UUID[] := '{}';
  v_new_attempt attempts;
BEGIN
  -- Đọc blueprint và module_id của đề
  SELECT blueprint, module_id
  INTO   v_blueprint, v_module_id
  FROM   exams
  WHERE  id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'exam_not_found';
  END IF;

  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'exam_no_module: Đề thi chưa gắn mô-đun, không thể bốc thăm câu hỏi.';
  END IF;

  IF v_blueprint IS NULL OR jsonb_array_length(v_blueprint) = 0 THEN
    RAISE EXCEPTION 'exam_no_blueprint: Đề thi chưa có blueprint, không thể bốc thăm câu hỏi.';
  END IF;

  -- Bốc thăm theo từng rule trong blueprint
  FOR v_rule IN
    SELECT value FROM jsonb_array_elements(v_blueprint)
  LOOP
    SELECT array_agg(id)
    INTO   v_drawn
    FROM (
      SELECT id
      FROM   question_bank
      WHERE  module_id   = v_module_id
        AND  (v_rule->>'topic'      = '*' OR topic      = v_rule->>'topic')
        AND  (v_rule->>'difficulty' = '*' OR difficulty = v_rule->>'difficulty')
        AND  is_deleted  = false
        AND  id <> ALL(v_all_ids)
      ORDER BY RANDOM()
      LIMIT (v_rule->>'count')::INT
    ) sub;

    v_all_ids := v_all_ids || COALESCE(v_drawn, '{}');
  END LOOP;

  IF array_length(v_all_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_questions_drawn: Không bốc được câu hỏi từ ngân hàng. Kiểm tra blueprint và ngân hàng câu hỏi của mô-đun.';
  END IF;

  -- Tạo attempt với danh sách câu đã bốc
  INSERT INTO attempts (
    user_id, window_id, exam_id, status, answers,
    started_at, question_ids
  )
  VALUES (
    auth.uid(), p_window_id, p_exam_id, 'in_progress', '{}',
    (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    v_all_ids
  )
  RETURNING * INTO v_new_attempt;

  RETURN v_new_attempt;
END;
$$;

COMMENT ON FUNCTION create_attempt_with_questions(UUID, UUID) IS
  'Tạo attempt và bốc thăm ngay bộ câu hỏi riêng cho thí sinh từ question_bank theo blueprint.';

-- ============================================================
-- 3. RPC lấy câu hỏi cho một bài làm (không trả answer_key)
--    Đọc từ question_bank theo question_ids của attempt.
--    Trả về shape giống questions_for_student (có exam_id) để tương thích client.
-- ============================================================
CREATE OR REPLACE FUNCTION get_questions_for_attempt(aid UUID)
RETURNS TABLE (
  id            UUID,
  exam_id       UUID,
  question_type TEXT,
  stem          TEXT,
  options       JSONB,
  points        INT,
  topic         TEXT,
  difficulty    TEXT,
  image_url     TEXT,
  media_url     TEXT,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id     UUID;
  v_exam_id     UUID;
  v_question_ids UUID[];
BEGIN
  SELECT a.user_id, a.exam_id, a.question_ids
  INTO   v_user_id, v_exam_id, v_question_ids
  FROM   attempts a
  WHERE  a.id = aid;

  IF NOT FOUND THEN RETURN; END IF;

  -- Thí sinh chỉ được đọc câu hỏi của bài làm của chính mình
  IF get_my_role() NOT IN ('admin', 'teacher') THEN
    IF v_user_id IS DISTINCT FROM auth.uid() THEN
      RETURN;
    END IF;
  END IF;

  IF v_question_ids IS NULL OR array_length(v_question_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      qb.id,
      v_exam_id     AS exam_id,
      qb.question_type,
      qb.stem,
      qb.options::JSONB,
      qb.points,
      qb.topic,
      qb.difficulty,
      qb.image_url,
      qb.media_url,
      qb.created_at,
      qb.updated_at
    FROM   question_bank qb
    WHERE  qb.id = ANY(v_question_ids)
      AND  qb.is_deleted = false
    ORDER BY array_position(v_question_ids, qb.id);
END;
$$;

COMMENT ON FUNCTION get_questions_for_attempt(UUID) IS
  'Trả câu hỏi (không có answer_key) cho một bài làm. Đọc từ question_bank theo question_ids.';

-- ============================================================
-- 4. Cập nhật grade_attempt: backward compat hai chế độ
--    - Có question_ids → chấm từ question_bank (bài làm mới)
--    - Không có question_ids → chấm từ questions table (bài làm cũ)
-- ============================================================
CREATE OR REPLACE FUNCTION grade_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r             RECORD;
  q             RECORD;
  total_earned  NUMERIC := 0;
  total_max     NUMERIC := 0;
  ans           TEXT;
BEGIN
  SELECT a.id, a.user_id, a.exam_id, a.answers, a.status, a.question_ids
  INTO   r
  FROM   attempts a
  WHERE  a.id = aid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  -- Bài làm mới (có question_ids): chấm từ question_bank
  IF r.question_ids IS NOT NULL AND array_length(r.question_ids, 1) IS NOT NULL THEN
    FOR q IN
      SELECT id, answer_key, points
      FROM   question_bank
      WHERE  id = ANY(r.question_ids)
        AND  is_deleted = false
    LOOP
      total_max    := total_max + q.points;
      ans          := r.answers->>(q.id::TEXT);
      IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
        total_earned := total_earned + q.points;
      END IF;
    END LOOP;

  ELSE
    -- Bài làm cũ (không có question_ids): chấm từ bảng questions
    FOR q IN
      SELECT id, answer_key, points
      FROM   questions
      WHERE  exam_id    = r.exam_id
        AND  is_deleted = false
    LOOP
      total_max    := total_max + q.points;
      ans          := r.answers->>(q.id::TEXT);
      IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
        total_earned := total_earned + q.points;
      END IF;
    END LOOP;
  END IF;

  UPDATE attempts
  SET
    status       = 'completed',
    raw_score    = total_earned,
    score        = CASE WHEN total_max > 0 THEN total_earned / total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok',        true,
    'raw_score', total_earned,
    'total_max', total_max,
    'score',     CASE WHEN total_max > 0 THEN total_earned / total_max ELSE 0 END
  );
END;
$$;

COMMENT ON COLUMN attempts.question_ids IS
  'UUID[] câu hỏi riêng của thí sinh này, bốc từ question_bank khi bắt đầu thi. NULL = bài làm cũ (dùng questions table).';
