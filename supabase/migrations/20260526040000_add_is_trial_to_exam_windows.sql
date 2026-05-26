-- Kỳ thi thử: không đồng bộ điểm sang TTDT, không bắt buộc class_id/module_id
ALTER TABLE exam_windows
  ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false;

COMMENT ON COLUMN exam_windows.is_trial IS
  'Kỳ thi thử/kiểm tra nội dung — không đồng bộ điểm sang TTDT, không bắt buộc class_id';
