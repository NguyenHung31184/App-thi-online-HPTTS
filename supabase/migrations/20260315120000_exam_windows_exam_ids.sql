-- Kỳ thi có thể dùng nhiều đề: thí sinh vào thi sẽ "quay" ngẫu nhiên 1 trong các đề.
-- Nếu exam_ids có giá trị và không rỗng thì dùng pool này; ngược lại dùng exam_id (1 đề).
ALTER TABLE public.exam_windows
  ADD COLUMN IF NOT EXISTS exam_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN public.exam_windows.exam_ids IS 'Danh sách exam_id: thí sinh vào thi sẽ được gán ngẫu nhiên 1 trong các đề. Null hoặc rỗng thì dùng exam_id.';
