-- Fix #10: question_bank có policy "Allow all for now" → lộ answer_key cho mọi user.
-- Thay bằng policy chặt: chỉ admin/teacher được đọc/ghi bảng này.
-- Học viên không cần truy cập question_bank trực tiếp (chỉ admin dùng khi soạn đề).

DROP POLICY IF EXISTS "Allow all for now" ON question_bank;

-- Chỉ admin/teacher được đọc và ghi question_bank (chứa answer_key)
CREATE POLICY "question_bank_admin_teacher_all" ON question_bank
  FOR ALL
  USING (get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- occupations: admin/teacher full; student có thể đọc tên nghề (không chứa dữ liệu nhạy cảm)
DROP POLICY IF EXISTS "Allow all for now" ON occupations;

CREATE POLICY "occupations_admin_teacher_all" ON occupations
  FOR ALL
  USING (get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (get_my_role() IN ('admin', 'teacher'));

CREATE POLICY "occupations_student_select" ON occupations
  FOR SELECT
  USING (true);

COMMENT ON TABLE question_bank IS
  'Ngân hàng câu hỏi theo nghề. Chứa answer_key — chỉ admin/teacher được đọc qua RLS.';
