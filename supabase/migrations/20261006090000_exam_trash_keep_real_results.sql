-- The trash no longer hard-deletes an item that carries real results (Thông tư 79/2026/TT-BGDĐT: result records are
-- kept long term). A result is real unless it belongs to a trial window (exam_windows.is_trial) or to a test class
-- (classes.code starting with TEST). Unfinished attempts never block.

BEGIN;

-- How many real results a hard delete of this item would remove. Internal: called by the trash functions only.
CREATE OR REPLACE FUNCTION public.exam_trash_real_results(p_kind text, p_id uuid)
RETURNS integer
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_kind IN ('exam', 'exam_window') THEN (
      SELECT count(*)::int FROM attempts a
      LEFT JOIN exam_windows w ON w.id = a.window_id
      LEFT JOIN classes c ON c.id::text = w.class_id::text
      WHERE a.status = 'completed'
        AND NOT coalesce(w.is_trial, false)
        AND coalesce(c.code, '') NOT ILIKE 'TEST%'
        AND CASE WHEN p_kind = 'exam'
              THEN a.exam_id = p_id OR a.window_id IN (SELECT x.id FROM exam_windows x WHERE x.exam_id = p_id)
              ELSE a.window_id = p_id END
    )
    ELSE (
      SELECT count(*)::int FROM practical_attempts a
      JOIN practical_exam_sessions s ON s.id = a.session_id
      LEFT JOIN classes c ON c.id::text = s.class_id::text
      WHERE a.status IN ('graded', 'not_eligible')
        AND coalesce(c.code, '') NOT ILIKE 'TEST%'
        AND CASE WHEN p_kind = 'practical_template' THEN s.template_id = p_id ELSE s.id = p_id END
    )
  END
$$;
REVOKE ALL ON FUNCTION public.exam_trash_real_results(text, uuid) FROM PUBLIC, anon, authenticated;

-- The list gains real_results; a changed return type needs a drop.
DROP FUNCTION public.exam_trash_list();
CREATE FUNCTION public.exam_trash_list()
RETURNS TABLE(kind text, id uuid, title text, detail text, deleted_at timestamptz, attempts integer, finished integer, real_results integer)
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
    (SELECT count(*)::int FROM attempts a WHERE a.exam_id = e.id AND a.status = 'completed'),
    public.exam_trash_real_results('exam', e.id)
  FROM exams e WHERE e.is_deleted
  UNION ALL
  SELECT 'exam_window'::text, w.id, coalesce(e.title, 'Đề thi không rõ')::text,
    concat_ws(' · ', c.name, to_char(to_timestamp(w.start_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')),
    w.deleted_at,
    (SELECT count(*)::int FROM attempts a WHERE a.window_id = w.id),
    (SELECT count(*)::int FROM attempts a WHERE a.window_id = w.id AND a.status = 'completed'),
    public.exam_trash_real_results('exam_window', w.id)
  FROM exam_windows w
  LEFT JOIN exams e ON e.id = w.exam_id
  LEFT JOIN classes c ON c.id::text = w.class_id::text
  WHERE w.is_deleted
  UNION ALL
  SELECT 'practical_template'::text, t.id, t.title::text, NULL::text, t.deleted_at,
    (SELECT count(*)::int FROM practical_attempts a JOIN practical_exam_sessions s ON s.id = a.session_id WHERE s.template_id = t.id),
    (SELECT count(*)::int FROM practical_attempts a JOIN practical_exam_sessions s ON s.id = a.session_id
      WHERE s.template_id = t.id AND a.status IN ('graded', 'not_eligible')),
    public.exam_trash_real_results('practical_template', t.id)
  FROM practical_exam_templates t WHERE t.is_deleted
  UNION ALL
  SELECT 'practical_session'::text, s.id, coalesce(t.title, 'Mẫu không rõ')::text,
    concat_ws(' · ', c.name, to_char(to_timestamp(s.start_at / 1000.0) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')),
    s.deleted_at,
    (SELECT count(*)::int FROM practical_attempts a WHERE a.session_id = s.id),
    (SELECT count(*)::int FROM practical_attempts a WHERE a.session_id = s.id AND a.status IN ('graded', 'not_eligible')),
    public.exam_trash_real_results('practical_session', s.id)
  FROM practical_exam_sessions s
  LEFT JOIN practical_exam_templates t ON t.id = s.template_id
  LEFT JOIN classes c ON c.id::text = s.class_id::text
  WHERE s.is_deleted;
END $$;
REVOKE ALL ON FUNCTION public.exam_trash_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exam_trash_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.exam_trash_hard_delete(p_kind text, p_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts uuid[];
  v_real integer;
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

  v_real := public.exam_trash_real_results(p_kind, p_id);
  IF v_real > 0 THEN
    RAISE EXCEPTION 'Mục này có % bài đã có kết quả của lớp thật. Kết quả thi phải lưu lâu dài nên không xóa vĩnh viễn được. Mục vẫn nằm trong thùng rác và khôi phục được.', v_real;
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

COMMIT;
