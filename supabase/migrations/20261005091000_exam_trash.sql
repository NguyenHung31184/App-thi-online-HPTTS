-- The TTDT app's trash ("Thùng rác") for exam items: list, restore, hard delete. Staff accounts only.
-- kind: 'exam' (theory exam), 'exam_window' (theory window), 'practical_template', 'practical_session'.

CREATE OR REPLACE FUNCTION public.exam_trash_list()
RETURNS TABLE(kind text, id uuid, title text, detail text, deleted_at timestamptz, attempts integer, finished integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Chỉ nhân viên app quản lý được dùng thùng rác.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT 'exam'::text, e.id, e.title::text, NULL::text, e.deleted_at,
    (SELECT count(*)::int FROM attempts a WHERE a.exam_id = e.id),
    (SELECT count(*)::int FROM attempts a WHERE a.exam_id = e.id AND a.status = 'completed')
  FROM exams e WHERE e.is_deleted
  UNION ALL
  SELECT 'exam_window'::text, w.id, coalesce(e.title, 'Đề thi không rõ')::text,
    concat_ws(' · ', c.name, to_char(to_timestamp(w.start_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')),
    w.deleted_at,
    (SELECT count(*)::int FROM attempts a WHERE a.window_id = w.id),
    (SELECT count(*)::int FROM attempts a WHERE a.window_id = w.id AND a.status = 'completed')
  FROM exam_windows w
  LEFT JOIN exams e ON e.id = w.exam_id
  LEFT JOIN classes c ON c.id::text = w.class_id::text
  WHERE w.is_deleted
  UNION ALL
  SELECT 'practical_template'::text, t.id, t.title::text, NULL::text, t.deleted_at,
    (SELECT count(*)::int FROM practical_attempts a JOIN practical_exam_sessions s ON s.id = a.session_id WHERE s.template_id = t.id),
    (SELECT count(*)::int FROM practical_attempts a JOIN practical_exam_sessions s ON s.id = a.session_id
      WHERE s.template_id = t.id AND a.status IN ('graded', 'not_eligible'))
  FROM practical_exam_templates t WHERE t.is_deleted
  UNION ALL
  SELECT 'practical_session'::text, s.id, coalesce(t.title, 'Mẫu không rõ')::text,
    concat_ws(' · ', c.name, to_char(to_timestamp(s.start_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')),
    s.deleted_at,
    (SELECT count(*)::int FROM practical_attempts a WHERE a.session_id = s.id),
    (SELECT count(*)::int FROM practical_attempts a WHERE a.session_id = s.id AND a.status IN ('graded', 'not_eligible'))
  FROM practical_exam_sessions s
  LEFT JOIN practical_exam_templates t ON t.id = s.template_id
  LEFT JOIN classes c ON c.id::text = s.class_id::text
  WHERE s.is_deleted;
END $$;

CREATE OR REPLACE FUNCTION public.exam_trash_restore(p_kind text, p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window exam_windows%ROWTYPE;
  v_session practical_exam_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Chỉ nhân viên app quản lý được dùng thùng rác.' USING ERRCODE = '42501';
  END IF;
  IF p_kind = 'exam' THEN
    UPDATE exams SET is_deleted = false, deleted_at = NULL WHERE id = p_id AND is_deleted;
  ELSIF p_kind = 'exam_window' THEN
    SELECT * INTO v_window FROM exam_windows WHERE id = p_id AND is_deleted;
    IF FOUND AND EXISTS (SELECT 1 FROM exams WHERE id = v_window.exam_id AND is_deleted) THEN
      RAISE EXCEPTION 'Đề thi của kỳ thi này đang trong thùng rác. Khôi phục đề thi trước.';
    END IF;
    UPDATE exam_windows SET is_deleted = false, deleted_at = NULL WHERE id = p_id AND is_deleted;
  ELSIF p_kind = 'practical_template' THEN
    UPDATE practical_exam_templates SET is_deleted = false, deleted_at = NULL WHERE id = p_id AND is_deleted;
  ELSIF p_kind = 'practical_session' THEN
    SELECT * INTO v_session FROM practical_exam_sessions WHERE id = p_id AND is_deleted;
    IF FOUND AND EXISTS (SELECT 1 FROM practical_exam_templates WHERE id = v_session.template_id AND is_deleted) THEN
      RAISE EXCEPTION 'Mẫu đánh giá của ca chấm này đang trong thùng rác. Khôi phục mẫu trước.';
    END IF;
    IF FOUND AND EXISTS (
      SELECT 1 FROM practical_exam_sessions s WHERE NOT s.is_deleted AND s.class_id = v_session.class_id
        AND s.template_id = v_session.template_id AND s.mode = v_session.mode
    ) THEN
      RAISE EXCEPTION 'Lớp này đã có ca chấm khác với cùng mẫu. Xóa ca đó trước rồi khôi phục ca này.';
    END IF;
    UPDATE practical_exam_sessions SET is_deleted = false, deleted_at = NULL WHERE id = p_id AND is_deleted;
  ELSE
    RAISE EXCEPTION 'Loại mục không hợp lệ: %', p_kind;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy mục này trong thùng rác.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.exam_trash_hard_delete(p_kind text, p_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts uuid[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Chỉ nhân viên app quản lý được dùng thùng rác.' USING ERRCODE = '42501';
  END IF;
  -- Only an item already in the trash; the attempts its foreign keys will cascade to.
  IF p_kind = 'exam' THEN
    PERFORM 1 FROM exams WHERE id = p_id AND is_deleted;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy mục này trong thùng rác.'; END IF;
    SELECT array_agg(a.id) INTO v_attempts FROM attempts a
      WHERE a.exam_id = p_id OR a.window_id IN (SELECT w.id FROM exam_windows w WHERE w.exam_id = p_id);
  ELSIF p_kind = 'exam_window' THEN
    PERFORM 1 FROM exam_windows WHERE id = p_id AND is_deleted;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy mục này trong thùng rác.'; END IF;
    SELECT array_agg(a.id) INTO v_attempts FROM attempts a WHERE a.window_id = p_id;
  ELSIF p_kind = 'practical_template' THEN
    PERFORM 1 FROM practical_exam_templates WHERE id = p_id AND is_deleted;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy mục này trong thùng rác.'; END IF;
    SELECT array_agg(a.id) INTO v_attempts FROM practical_attempts a
      JOIN practical_exam_sessions s ON s.id = a.session_id WHERE s.template_id = p_id;
  ELSIF p_kind = 'practical_session' THEN
    PERFORM 1 FROM practical_exam_sessions WHERE id = p_id AND is_deleted;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy mục này trong thùng rác.'; END IF;
    SELECT array_agg(a.id) INTO v_attempts FROM practical_attempts a WHERE a.session_id = p_id;
  ELSE
    RAISE EXCEPTION 'Loại mục không hợp lệ: %', p_kind;
  END IF;

  -- Queued sends of attempts that will no longer exist; TTDT keeps the scores it already received.
  IF v_attempts IS NOT NULL THEN
    DELETE FROM exam_sync_jobs WHERE attempt_id = ANY(v_attempts);
  END IF;

  IF p_kind = 'exam' THEN
    UPDATE exam_windows SET exam_ids = array_remove(exam_ids, p_id) WHERE p_id = ANY(exam_ids);
    DELETE FROM exams WHERE id = p_id;
  ELSIF p_kind = 'exam_window' THEN
    DELETE FROM exam_windows WHERE id = p_id;
  ELSIF p_kind = 'practical_template' THEN
    DELETE FROM practical_exam_templates WHERE id = p_id;
  ELSE
    DELETE FROM practical_exam_sessions WHERE id = p_id;
  END IF;
  RETURN coalesce(array_length(v_attempts, 1), 0);
END $$;

REVOKE ALL ON FUNCTION public.exam_trash_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exam_trash_restore(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exam_trash_hard_delete(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exam_trash_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.exam_trash_restore(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exam_trash_hard_delete(text, uuid) TO authenticated;
