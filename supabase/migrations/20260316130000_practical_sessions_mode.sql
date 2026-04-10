-- Phase 5 (bổ sung): Thêm mode cho kỳ thi thực hành
-- Phân biệt:
-- - 'student_upload'   : Học viên tự học / tự upload minh chứng
-- - 'teacher_grading'  : Giáo viên thực hành chấm trực tiếp tại sân thi

ALTER TABLE practical_exam_sessions
ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'student_upload'
  CHECK (mode IN ('student_upload', 'teacher_grading'));

COMMENT ON COLUMN practical_exam_sessions.mode IS 'Cách tổ chức kỳ thi thực hành: student_upload (HV tự upload) hoặc teacher_grading (GV chấm trực tiếp).';

