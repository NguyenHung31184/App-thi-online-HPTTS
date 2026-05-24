-- Fix get_my_role() để nhận diện GV từ Sổ Chuyên Cần (SCC).
-- SCC instructor profiles có satellite_role='teacher', nhưng profiles.role bị ràng buộc
-- bởi TTDT CHECK constraint (chỉ cho phép: admin, academic_affairs, accountant, director, other).
-- Kết quả: GV thực hành trong SCC không vào được các bảng practical_exam_* vì RLS trả về 'other'.
--
-- Fix: ưu tiên satellite_role nếu là 'teacher' hoặc 'admin'; fallback về role nếu không có.
-- Không ảnh hưởng App thi online native users (satellite_role = NULL → vẫn dùng role).

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN satellite_role IN ('teacher', 'admin') THEN satellite_role
      ELSE role
    END
  FROM profiles
  WHERE id = auth.uid();
$$;
