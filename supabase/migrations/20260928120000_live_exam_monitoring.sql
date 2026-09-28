-- ============================================================================
-- GIÁM SÁT THI TRỰC TUYẾN (2026-09-28): docs/implementation/2026-09-28-live-exam-monitoring.md
--
-- Rollback (dữ liệu last_seen_at chỉ là tín hiệu tạm, mất không sao):
--   DROP FUNCTION IF EXISTS public.get_live_exam_monitor();
--   DROP FUNCTION IF EXISTS public.touch_attempt(uuid);
--   ALTER TABLE public.attempts DROP COLUMN IF EXISTS last_seen_at;
-- ============================================================================

ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.attempts.last_seen_at IS
  'Lần gần nhất trang làm bài báo còn mở (touch_attempt, 20 giây/lần). Null với bài làm trước 2026-09-28.';

-- Chỉ chạm vào bài đang làm của chính người gọi; không đổi gì khác.
CREATE OR REPLACE FUNCTION public.touch_attempt(p_attempt_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.attempts
  SET last_seen_at = now()
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';
$$;

REVOKE ALL ON FUNCTION public.touch_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_attempt(uuid) TO authenticated;

-- Bài làm của các kỳ thi đang mở hoặc vừa đóng dưới 30 phút. Vi phạm = 7 sự kiện trang làm bài tính vào ngưỡng tự nộp.
CREATE OR REPLACE FUNCTION public.get_live_exam_monitor()
RETURNS TABLE (
  window_id uuid,
  class_id text,
  class_name text,
  enrolled integer,
  exam_title text,
  is_trial boolean,
  window_end_at bigint,
  attempt_id uuid,
  student_code text,
  student_name text,
  status text,
  started_at bigint,
  completed_at bigint,
  last_seen_at timestamptz,
  answered integer,
  total_questions integer,
  violations integer,
  last_violation text,
  last_violation_at timestamptz,
  disqualified boolean,
  -- Tính theo giờ máy chủ để đồng hồ lệch của máy giám thị không làm sai trạng thái.
  seconds_since_seen integer,
  seconds_since_violation integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now bigint := (extract(epoch FROM now()) * 1000)::bigint;
BEGIN
  IF coalesce(public.get_my_exam_role(), '') NOT IN ('admin', 'teacher', 'proctor') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.class_id,
    c.name::text,
    (SELECT count(*)::int FROM public.enrollments en
      WHERE en.class_id::text = w.class_id AND coalesce(en.is_deleted, false) = false),
    e.title::text,
    coalesce(w.is_trial, false),
    w.end_at,
    a.id,
    s.student_code::text,
    s.name::text,
    a.status,
    a.started_at,
    a.completed_at,
    a.last_seen_at,
    CASE WHEN jsonb_typeof(a.answers) = 'object'
      THEN (SELECT count(*)::int FROM jsonb_object_keys(a.answers)) ELSE 0 END,
    coalesce(array_length(a.question_ids, 1), 0),
    coalesce(v.cnt, 0),
    v.last_event,
    v.last_at,
    coalesce(a.disqualified, false),
    floor(extract(epoch FROM now() - coalesce(a.last_seen_at, to_timestamp(a.started_at / 1000.0))))::int,
    CASE WHEN v.last_at IS NULL THEN NULL ELSE floor(extract(epoch FROM now() - v.last_at))::int END
  FROM public.exam_windows w
  JOIN public.attempts a ON a.window_id = w.id
  JOIN public.exams e ON e.id = a.exam_id
  LEFT JOIN public.classes c ON c.id::text = w.class_id
  LEFT JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.students s ON s.id::text = p.student_id::text
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt,
           (array_agg(l.event ORDER BY l.created_at DESC))[1] AS last_event,
           max(l.created_at) AS last_at
    FROM public.attempt_audit_logs l
    WHERE l.attempt_id = a.id
      AND l.event IN ('visibility_hidden', 'focus_lost', 'fullscreen_exited',
                      'ai_no_face', 'ai_multiple_face', 'ai_cell_phone', 'ai_prohibited_object')
  ) v ON true
  WHERE w.start_at <= v_now
    AND w.end_at >= v_now - 1800000;
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_exam_monitor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_exam_monitor() TO authenticated;
