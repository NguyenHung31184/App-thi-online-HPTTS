-- Chạy từng bước trong Supabase SQL Editor (project có URL vmtztbmlzszuxkglubro).
-- Nếu bước 1 báo lỗi "relation attempts does not exist" → app đang trỏ sai project Supabase.

-- ========== BƯỚC 1: Kiểm tra function đã có chưa ==========
-- Chạy câu này trước. Nếu trả 0 rows → chưa có function, chạy tiếp Bước 2.
SELECT routine_schema, routine_name
FROM information_schema.routines
WHERE routine_name = 'grade_attempt';

-- ========== BƯỚC 2: Tạo function (chỉ cần có bảng attempts, questions) ==========
-- Copy từ dòng dưới đến hết, Run. Nếu báo lỗi "relation attempts does not exist" thì project này chưa có bảng thi → cần chạy migration 001_mvp_tables.sql trước.

-- Lưu tổng điểm tối đa vào attempts để các màn hình hiển thị/pass tính toán đúng.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS total_max NUMERIC;

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
  LOOP
    total_max := total_max + COALESCE(q.points, 0);
    ans := r.answers->>q.id::text;
    IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
      total_earned := total_earned + COALESCE(q.points, 0);
    END IF;
  END LOOP;

  UPDATE attempts
  SET
    status = 'completed',
    raw_score = total_earned,
    total_max = total_max,
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

REVOKE EXECUTE ON FUNCTION public.grade_attempt(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.grade_attempt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_attempt(UUID) TO service_role;

COMMENT ON FUNCTION public.grade_attempt(UUID) IS 'Chấm bài trắc nghiệm (RPC nộp bài).';
