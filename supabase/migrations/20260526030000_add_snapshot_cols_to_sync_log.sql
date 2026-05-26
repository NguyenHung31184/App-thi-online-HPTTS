-- Lưu snapshot tại thời điểm ghi log để tránh phụ thuộc RLS join sau này
-- Trước đây syncLogService phải join attempts (bị RLS chặn admin) → hiển thị '—'
-- Fix: lưu exam_title, window_id, class_id, user_email, user_name ngay khi ghi log

ALTER TABLE exam_sync_log
  ADD COLUMN IF NOT EXISTS exam_title  text,
  ADD COLUMN IF NOT EXISTS window_id   uuid,
  ADD COLUMN IF NOT EXISTS class_id    text,
  ADD COLUMN IF NOT EXISTS user_email  text,
  ADD COLUMN IF NOT EXISTS user_name   text;

ALTER TABLE practical_sync_log
  ADD COLUMN IF NOT EXISTS class_id    text,
  ADD COLUMN IF NOT EXISTS user_email  text,
  ADD COLUMN IF NOT EXISTS user_name   text;

COMMENT ON COLUMN exam_sync_log.exam_title  IS 'Snapshot tên đề thi lúc đồng bộ';
COMMENT ON COLUMN exam_sync_log.window_id   IS 'Snapshot window_id lúc đồng bộ';
COMMENT ON COLUMN exam_sync_log.class_id    IS 'Snapshot class_id lúc đồng bộ';
COMMENT ON COLUMN exam_sync_log.user_email  IS 'Snapshot email học viên lúc đồng bộ';
COMMENT ON COLUMN exam_sync_log.user_name   IS 'Snapshot tên học viên lúc đồng bộ';
