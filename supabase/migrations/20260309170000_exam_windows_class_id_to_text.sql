-- exam_windows.class_id phải là TEXT để khớp với bảng classes.id của TTDT (text, VD: lop176...).
-- Không thể ALTER TYPE cột đang được dùng trong policy → phải DROP policy, đổi kiểu, rồi CREATE lại policy.

DROP POLICY IF EXISTS "exam_windows_student_select" ON public.exam_windows;

ALTER TABLE public.exam_windows
  DROP CONSTRAINT IF EXISTS exam_windows_class_id_fkey;

ALTER TABLE public.exam_windows
  ALTER COLUMN class_id TYPE text USING class_id::text;

-- Tạo lại policy: thí sinh được xem cửa sổ thuộc lớp mình (class_id so sánh text với enrollments.class_id).
-- enrollments.student_id trong TTDT là TEXT, get_my_student_id() trả về UUID → cần cast để so sánh.
CREATE POLICY "exam_windows_student_select" ON public.exam_windows
  FOR SELECT USING (
    get_my_role() IN ('admin', 'teacher')
    OR get_my_student_id() IS NULL
    OR class_id IN (
      SELECT e.class_id FROM enrollments e
      WHERE e.student_id = (get_my_student_id())::text
    )
  );
