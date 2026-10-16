-- Giám thị xem và mở khóa học viên nhập sai mã truy cập (16/10/2026).
--
-- start_exam_attempt khóa một học viên ở một kỳ thi sau 5 lần sai mã, trong 10 phút kể từ lần sai cuối. Ngày 16/10 năm
-- học viên lớp NBN-GN3.4, NBN-GN4.5 nhập mã thi thử cũ ở kỳ thi thật và bị khóa; người bị khóa chưa có lượt làm bài
-- nên không hiện trên màn giám sát. Chủ dự án chốt: ai mở được màn giám sát (admin, teacher, proctor) thì xem và mở
-- khóa được; mức khóa giữ nguyên; mỗi lần mở khóa được ghi lại.
--
-- get_exam_access_failures(): học viên đang nhập sai mã ở kỳ thi đang mở (lần sai cuối trong 10 phút).
-- unlock_exam_access(window, user): xóa bộ đếm, ghi exam_access_unlocks. Không đụng tới bài làm hay điểm.
-- Rollback: drop hai hàm và bảng exam_access_unlocks (xem docs/rollback/2026-10-16-mo-khoa-nhap-ma.md).

BEGIN;

CREATE TABLE IF NOT EXISTS public.exam_access_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id uuid NOT NULL REFERENCES public.exam_windows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  failure_count integer NOT NULL,
  last_failed_at timestamptz NOT NULL,
  unlocked_by uuid,
  unlocked_by_name text,
  unlocked_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exam_access_unlocks IS
  'Lịch sử giám thị mở khóa học viên nhập sai mã truy cập. Chỉ thêm qua unlock_exam_access.';

ALTER TABLE public.exam_access_unlocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_access_unlocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.exam_access_unlocks TO authenticated;
DROP POLICY IF EXISTS exam_access_unlocks_select ON public.exam_access_unlocks;
CREATE POLICY exam_access_unlocks_select ON public.exam_access_unlocks
  FOR SELECT TO authenticated USING (coalesce(public.get_my_exam_role(), '') IN ('admin', 'teacher', 'proctor'));

CREATE OR REPLACE FUNCTION public.get_exam_access_failures()
RETURNS TABLE (
  window_id uuid, class_name text, exam_title text, user_id uuid, student_code text, student_name text,
  failure_count integer, last_failed_at timestamptz, locked_until timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now bigint := (extract(epoch FROM now()) * 1000)::bigint;
BEGIN
  IF coalesce(public.get_my_exam_role(), '') NOT IN ('admin', 'teacher', 'proctor') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT f.window_id, c.name::text, e.title::text, f.user_id, s.student_code::text,
    coalesce(s.name, p.email)::text, f.failure_count, f.last_failed_at,
    CASE WHEN f.failure_count >= 5 THEN f.last_failed_at + interval '10 minutes' END
  FROM public.exam_access_failures f
  JOIN public.exam_windows w ON w.id = f.window_id
  LEFT JOIN public.exams e ON e.id = w.exam_id
  LEFT JOIN public.classes c ON c.id::text = w.class_id
  LEFT JOIN public.profiles p ON p.id = f.user_id
  LEFT JOIN public.students s ON s.id::text = p.student_id::text
  WHERE NOT w.is_deleted AND w.start_at <= v_now AND w.end_at >= v_now
    AND f.failure_count > 0 AND f.last_failed_at > now() - interval '10 minutes'
  ORDER BY f.failure_count DESC, f.last_failed_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.unlock_exam_access(p_window_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.exam_access_failures%ROWTYPE;
BEGIN
  IF coalesce(public.get_my_exam_role(), '') NOT IN ('admin', 'teacher', 'proctor') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.exam_access_failures
  WHERE window_id = p_window_id AND user_id = p_user_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.exam_access_unlocks (window_id, user_id, failure_count, last_failed_at, unlocked_by, unlocked_by_name)
  VALUES (p_window_id, p_user_id, v_row.failure_count, v_row.last_failed_at, auth.uid(),
    (SELECT pr.name FROM public.profiles pr WHERE pr.id = auth.uid()));
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.get_exam_access_failures() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlock_exam_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_access_failures() TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_exam_access(uuid, uuid) TO authenticated;

COMMIT;
