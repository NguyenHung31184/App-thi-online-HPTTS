-- Fix disqualify_attempt: tính và lưu total_max thay vì để NULL
-- Trước đây total_max = NULL khi disqualify → frontend fallback về exam.total_questions (số câu, không phải tổng điểm)
-- Fix: tính tổng points từ question_bank / questions table (dual-path) rồi lưu vào total_max

CREATE OR REPLACE FUNCTION disqualify_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r           RECORD;
  v_total_max NUMERIC := 0;
BEGIN
  SELECT a.id, a.user_id, a.status, a.question_ids, a.exam_id
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

  -- Tính tổng điểm tối đa (dual-path giống grade_attempt)
  SELECT COALESCE(SUM(pts), 0)
  INTO   v_total_max
  FROM (
    SELECT qb.points AS pts
    FROM   question_bank qb
    WHERE  r.question_ids IS NOT NULL
      AND  array_length(r.question_ids, 1) IS NOT NULL
      AND  qb.id = ANY(r.question_ids)
      AND  qb.is_deleted = false
    UNION ALL
    SELECT qt.points AS pts
    FROM   questions qt
    WHERE  (r.question_ids IS NULL OR array_length(r.question_ids, 1) IS NULL)
      AND  qt.exam_id = r.exam_id
  ) sub;

  UPDATE attempts
  SET
    status       = 'completed',
    score        = 0,
    raw_score    = 0,
    total_max    = v_total_max,
    disqualified = true,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object('ok', true, 'score', 0, 'disqualified', true, 'total_max', v_total_max);
END;
$$;

GRANT EXECUTE ON FUNCTION disqualify_attempt(UUID) TO authenticated;

COMMENT ON FUNCTION disqualify_attempt(UUID) IS
  'Danh dau bai thi bi huy do vi pham: score=0, disqualified=true. '
  'Tinh va luu total_max de frontend hien thi dung (0/100 thay vi 0/so_cau).';
