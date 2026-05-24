-- Thêm module_id vào practical_exam_templates để link kỳ thi thực hành với mô-đun trong TTDT.
-- module_id là TEXT (khớp với kiểu module_id trong exams và question_bank).
-- Dùng khi đồng bộ điểm thực hành sang TTDT (receive-exam-results cần module_id).

ALTER TABLE practical_exam_templates
  ADD COLUMN IF NOT EXISTS module_id TEXT;

COMMENT ON COLUMN practical_exam_templates.module_id IS
  'FK đến modules.id trong TTDT (text). Gắn đề thi thực hành với mô-đun để đồng bộ điểm đúng.';
