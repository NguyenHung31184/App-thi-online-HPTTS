-- Soft-delete cho bảng exams.
-- Xóa mềm thay cho DELETE cứng → giữ toàn vẹn dữ liệu attempts/dashboard,
-- tránh mất tên đề thi và pass_threshold khi JOIN từ attempts.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_exams_is_deleted ON exams(is_deleted);

COMMENT ON COLUMN exams.is_deleted IS
  'Soft-delete: true = đã xóa mềm, không hiển thị nhưng giữ nguyên để attempts/dashboard JOIN không bị null.';
COMMENT ON COLUMN exams.deleted_at IS
  'Thời điểm xóa mềm. NULL nếu chưa xóa.';
