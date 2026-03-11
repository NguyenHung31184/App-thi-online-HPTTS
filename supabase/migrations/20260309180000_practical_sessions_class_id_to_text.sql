-- practical_exam_sessions.class_id phải là TEXT để khớp với TTDT (classes.id, enrollments.class_id dạng text, VD: lop177...).
-- Nếu không, query .in('class_id', ['lop1773127765170']) sẽ gây 400 Bad Request do cast string -> UUID lỗi.

DROP POLICY IF EXISTS "practical_sessions_student_select" ON public.practical_exam_sessions;

ALTER TABLE public.practical_exam_sessions
  ALTER COLUMN class_id TYPE text USING class_id::text;

-- Thí sinh được xem kỳ thi thực hành thuộc lớp mình (class_id so sánh text với enrollments.class_id).
CREATE POLICY "practical_sessions_student_select" ON public.practical_exam_sessions
  FOR SELECT USING (
    get_my_role() IN ('admin', 'teacher')
    OR get_my_student_id() IS NULL
    OR class_id IN (
      SELECT e.class_id FROM enrollments e
      WHERE e.student_id = (get_my_student_id())::text
    )
  );
