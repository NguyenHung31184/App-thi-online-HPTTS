-- Số lần thi tối đa mỗi học viên được phép làm trong một cửa sổ thi.
-- Mặc định 2 = 1 lần thi thật + 1 lần thi lại (đúng quy định hàng hải).
-- Kỳ thi thử (is_trial = true) không áp dụng giới hạn này.
ALTER TABLE exam_windows
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 2;
