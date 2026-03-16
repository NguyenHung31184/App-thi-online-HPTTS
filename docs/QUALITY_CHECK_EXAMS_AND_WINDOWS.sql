-- KIỂM TRA CHẤT LƯỢNG CẤU HÌNH ĐỀ THI / KỲ THI TRƯỚC KHI MỞ CHO HỌC VIÊN
--
-- Cách dùng:
-- - Vào Supabase Dashboard → SQL Editor → New query
-- - Dán TỪNG KHỐI bên dưới và Run (hoặc Run all)
-- - Mục tiêu là tất cả các truy vấn đều trả về 0 dòng (hoặc chỉ những case bạn cố tình chấp nhận).
--
-- ================================================================
-- 1. Đề thi thiếu module_id (không thể đồng bộ sang TTDT)
-- ================================================================
SELECT
  e.id,
  e.title,
  e.module_id,
  e.total_questions,
  e.pass_threshold
FROM exams e
WHERE (e.module_id IS NULL OR TRIM(e.module_id::text) = '')
ORDER BY e.created_at DESC NULLS LAST;

-- Nếu có dòng xuất hiện:
-- - Vào màn quản trị Đề thi trong app
-- - Gắn mô-đun TTDT (module) tương ứng cho các đề này trước khi dùng.

-- ================================================================
-- 2. Kỳ thi (exam_windows) chưa gắn lớp (class_id)
--    → Học viên làm bài sẽ không được đồng bộ điểm sang TTDT
-- ================================================================
SELECT
  w.id AS window_id,
  w.access_code,
  w.start_at,
  w.end_at,
  w.class_id,
  e.id   AS exam_id,
  e.title AS exam_title
FROM exam_windows w
LEFT JOIN exams e ON e.id = w.exam_id
WHERE (w.class_id IS NULL OR TRIM(w.class_id::text) = '')
ORDER BY w.start_at DESC;

-- Nếu có dòng xuất hiện:
-- - Vào màn quản trị Kỳ thi trong app
-- - Chọn đúng Lớp TTDT (class) cho từng kỳ thi trước khi cấp mã cho học viên.

-- ================================================================
-- 3. Đề thi có total_questions không khớp với số câu hỏi thật
--    (dễ gây hiểu nhầm khi hiển thị hoặc blueprint sai)
-- ================================================================
SELECT
  e.id,
  e.title,
  e.total_questions,
  COUNT(q.id) AS actual_questions
FROM exams e
LEFT JOIN questions q ON q.exam_id = e.id
GROUP BY e.id, e.title, e.total_questions
HAVING COALESCE(e.total_questions, 0) <> COUNT(q.id)
ORDER BY e.created_at DESC NULLS LAST;

-- Nếu có dòng xuất hiện:
-- - Vào màn Đề thi hoặc Ngân hàng câu hỏi để kiểm tra:
--   + Hoặc cập nhật lại trường total_questions cho đúng
--   + Hoặc thêm / xoá câu hỏi để khớp với cấu hình mong muốn.

-- ================================================================
-- 4. Kỳ thi đã/ sắp diễn ra nhưng đề thi thiếu module_id hoặc kỳ thi thiếu class_id
--    (áp lực cao, nên xử lý dứt điểm trước khi cho thi)
-- ================================================================
WITH future_or_running_windows AS (
  SELECT *
  FROM exam_windows
  WHERE end_at >= EXTRACT(EPOCH FROM NOW()) * 1000 -- chưa kết thúc
)
SELECT
  w.id AS window_id,
  w.access_code,
  TO_CHAR(TO_TIMESTAMP(w.start_at / 1000), 'YYYY-MM-DD HH24:MI') AS start_time,
  TO_CHAR(TO_TIMESTAMP(w.end_at / 1000), 'YYYY-MM-DD HH24:MI')   AS end_time,
  w.class_id,
  e.id   AS exam_id,
  e.title AS exam_title,
  e.module_id,
  CASE
    WHEN e.module_id IS NULL OR TRIM(e.module_id::text) = '' THEN 'MISSING_MODULE'
    WHEN w.class_id IS NULL OR TRIM(w.class_id::text) = '' THEN 'MISSING_CLASS'
    ELSE 'OK'
  END AS status
FROM future_or_running_windows w
LEFT JOIN exams e ON e.id = w.exam_id
WHERE
  (e.module_id IS NULL OR TRIM(e.module_id::text) = '')
  OR (w.class_id IS NULL OR TRIM(w.class_id::text) = '')
ORDER BY w.start_at ASC;

-- Các dòng xuất hiện ở đây là "đỏ nhất":
-- - Nếu status = MISSING_MODULE: gắn module_id cho đề e.id.
-- - Nếu status = MISSING_CLASS: gắn class_id cho kỳ w.id.

