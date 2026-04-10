-- Fix bảo mật: (1) RPC get_questions_for_student thiếu kiểm tra quyền
--              (2) RLS exam_windows cho phép user chưa link student_id xem tất cả cửa sổ

-- =============================================================================
-- FIX 1: RPC get_questions_for_student
-- Vấn đề: Bất kỳ user authenticated nào cũng có thể gọi RPC với exam_id bất kỳ
--         và lấy toàn bộ câu hỏi của đề đó — kể cả đề không thuộc về mình.
-- Fix: Thêm kiểm tra "user phải có attempt cho đề này" trước khi trả kết quả.
--      Admin/teacher được bỏ qua kiểm tra này.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_questions_for_student(eid UUID, qids UUID[] DEFAULT NULL)
RETURNS SETOF questions_for_student
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  -- Kiểm tra quyền: thí sinh chỉ được đọc câu hỏi nếu có attempt hợp lệ cho đề này
  IF get_my_role() NOT IN ('admin', 'teacher') THEN
    IF NOT EXISTS (
      SELECT 1 FROM attempts
      WHERE exam_id = eid AND user_id = auth.uid()
    ) THEN
      -- Trả về empty set thay vì throw lỗi để tránh lộ thông tin
      RETURN;
    END IF;
  END IF;

  IF qids IS NULL OR array_length(qids, 1) IS NULL THEN
    RETURN QUERY
      SELECT * FROM questions_for_student
      WHERE exam_id = eid
      ORDER BY created_at;
  ELSE
    RETURN QUERY
      SELECT * FROM questions_for_student
      WHERE exam_id = eid AND id = ANY(qids)
      ORDER BY array_position(qids, id);
  END IF;
END;
$$;

-- =============================================================================
-- FIX 2: RLS exam_windows — policy "exam_windows_student_select"
-- Vấn đề: Điều kiện `get_my_student_id() IS NULL` cho phép user MỚI (chưa
--         được gắn student_id) xem TOÀN BỘ cửa sổ thi — không phân biệt lớp.
-- Fix: User chưa có student_id chỉ được xem cửa sổ KHÔNG giới hạn lớp
--      (class_id IS NULL). Chỉ user có student_id mới xem được cửa sổ của lớp mình.
-- =============================================================================
DROP POLICY IF EXISTS "exam_windows_student_select" ON public.exam_windows;

CREATE POLICY "exam_windows_student_select" ON public.exam_windows
  FOR SELECT USING (
    -- Admin / teacher được xem tất cả
    get_my_role() IN ('admin', 'teacher')
    -- Cửa sổ thi không giới hạn lớp (mở cho tất cả)
    OR class_id IS NULL
    -- Thí sinh có student_id chỉ xem cửa sổ thuộc lớp mình đã đăng ký
    OR (
      get_my_student_id() IS NOT NULL
      AND class_id IN (
        SELECT e.class_id FROM enrollments e
        WHERE e.student_id = (get_my_student_id())::text
      )
    )
  );

COMMENT ON FUNCTION get_questions_for_student(UUID, UUID[]) IS
  'Trả câu hỏi cho thí sinh (không có answer_key). Yêu cầu: admin/teacher hoặc có attempt cho đề đó.';
