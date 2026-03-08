-- Phase 2: Chấm bài server-side — RPC grade_attempt
-- Chạy trong Supabase SQL Editor sau 001_mvp_tables.sql

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
  -- Chỉ chấm khi status = in_progress
  SELECT a.id, a.exam_id, a.answers, a.status INTO r
  FROM attempts a WHERE a.id = aid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  FOR q IN
    SELECT id, answer_key, points
    FROM questions
    WHERE exam_id = r.exam_id
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

-- Cho phép anon/authenticated gọi (RLS vẫn áp dụng cho bảng attempts)
GRANT EXECUTE ON FUNCTION grade_attempt(UUID) TO anon;
GRANT EXECUTE ON FUNCTION grade_attempt(UUID) TO authenticated;
