-- Phase 3: RLS đầy đủ theo role — profiles, view câu hỏi không đáp án, policy từng bảng.
-- Chạy sau 001 và 002.
-- Yêu cầu: Bảng enrollments (student_id, class_id) phải tồn tại nếu thí sinh có student_id và cần lọc cửa sổ theo lớp; nếu chưa có thì tạo bảng trống: CREATE TABLE IF NOT EXISTS enrollments (student_id UUID, class_id UUID);

-- 1. Bảng profiles (map auth.uid() -> role, student_id TTDT)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin', 'proctor')),
  student_id UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Đảm bảo có đủ cột nếu bảng đã tồn tại (vd. từ Supabase hoặc lần chạy trước)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'student';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'student_id') THEN
    ALTER TABLE profiles ADD COLUMN student_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger: tạo profile khi user đăng ký (role mặc định student)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role) VALUES (new.id, 'student')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. View câu hỏi không có answer_key (cho thí sinh)
CREATE OR REPLACE VIEW questions_for_student AS
  SELECT id, exam_id, question_type, stem, options, points, topic, difficulty, image_url, media_url, created_at, updated_at
  FROM questions;

-- 3. RPC: lấy câu hỏi theo exam_id và danh sách id (không trả answer_key). Nếu qids NULL/empty thì trả tất cả câu hỏi của đề.
CREATE OR REPLACE FUNCTION get_questions_for_student(eid UUID, qids UUID[] DEFAULT NULL)
RETURNS SETOF questions_for_student
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  IF qids IS NULL OR array_length(qids, 1) IS NULL THEN
    RETURN QUERY SELECT * FROM questions_for_student WHERE exam_id = eid ORDER BY created_at;
  ELSE
    RETURN QUERY SELECT * FROM questions_for_student
    WHERE exam_id = eid AND id = ANY(qids)
    ORDER BY array_position(qids, id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_questions_for_student(UUID, UUID[]) TO authenticated;

-- 4. Hàm tiện ích cho RLS
CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_student_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM profiles WHERE id = auth.uid();
$$;

-- 5. Xóa policy tạm "Allow all for now"
DROP POLICY IF EXISTS "Allow all for now" ON exams;
DROP POLICY IF EXISTS "Allow all for now" ON questions;
DROP POLICY IF EXISTS "Allow all for now" ON exam_windows;
DROP POLICY IF EXISTS "Allow all for now" ON attempts;
DROP POLICY IF EXISTS "Allow all for now" ON attempt_audit_logs;
DROP POLICY IF EXISTS "Allow all for now" ON exam_sync_log;

-- 6. Policy exams: admin/teacher full; thí sinh chỉ SELECT đề mà mình có attempt
CREATE POLICY "exams_admin_teacher_all" ON exams
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));
CREATE POLICY "exams_student_select_own_attempts" ON exams
  FOR SELECT USING (
    id IN (SELECT exam_id FROM attempts WHERE user_id = auth.uid())
  );

-- 7. Policy questions: chỉ admin/teacher (thí sinh dùng RPC get_questions_for_student)
CREATE POLICY "questions_admin_teacher_all" ON questions
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- 8. Policy exam_windows: admin/teacher full; thí sinh SELECT cửa sổ thuộc lớp mình hoặc chưa có student_id (xem tất cả)
CREATE POLICY "exam_windows_admin_teacher_all" ON exam_windows
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));
CREATE POLICY "exam_windows_student_select" ON exam_windows
  FOR SELECT USING (
    get_my_role() IN ('admin', 'teacher')
    OR get_my_student_id() IS NULL
    OR (class_id) IN (
      SELECT (e.class_id)::uuid FROM enrollments e WHERE (e.student_id)::uuid = get_my_student_id()
    )
  );

-- 9. Policy attempts: thí sinh SELECT/UPDATE của mình; admin/teacher SELECT/UPDATE tất cả
CREATE POLICY "attempts_student_own" ON attempts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "attempts_student_update_own" ON attempts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts_student_insert_own" ON attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts_admin_teacher_all" ON attempts
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- 10. Policy attempt_audit_logs: thí sinh INSERT (chỉ cho attempt của mình); admin/teacher SELECT
CREATE POLICY "attempt_audit_logs_student_insert" ON attempt_audit_logs
  FOR INSERT WITH CHECK (
    attempt_id IN (SELECT id FROM attempts WHERE user_id = auth.uid())
  );
CREATE POLICY "attempt_audit_logs_admin_teacher_select" ON attempt_audit_logs
  FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));

-- 11. Policy exam_sync_log: thí sinh INSERT (khi gọi sync); admin/teacher SELECT
CREATE POLICY "exam_sync_log_student_insert" ON exam_sync_log
  FOR INSERT WITH CHECK (
    attempt_id IN (SELECT id FROM attempts WHERE user_id = auth.uid())
  );
CREATE POLICY "exam_sync_log_admin_teacher_select" ON exam_sync_log
  FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));

-- 12. Cho phép service_role bỏ qua RLS (dùng khi cần)
-- Service role đã mặc định bypass RLS trong Supabase.

COMMENT ON TABLE profiles IS 'Phase 3: map auth user -> role và student_id (TTDT). Cập nhật role bằng SQL hoặc dashboard.';

-- 13. grade_attempt: chỉ chủ attempt mới được gọi; thu hồi anon
REVOKE EXECUTE ON FUNCTION grade_attempt(UUID) FROM anon;

CREATE OR REPLACE FUNCTION grade_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  q RECORD;
  total_earned NUMERIC := 0;
  total_max NUMERIC := 0;
  ans TEXT;
BEGIN
  SELECT a.id, a.user_id, a.exam_id, a.answers, a.status INTO r
  FROM attempts a WHERE a.id = aid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  FOR q IN
    SELECT id, answer_key, points
    FROM questions
    WHERE exam_id = r.exam_id
  LOOP
    total_max := total_max + q.points;
    ans := r.answers->>q.id;
    IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
      total_earned := total_earned + q.points;
    END IF;
  END LOOP;

  UPDATE attempts
  SET
    status = 'completed',
    raw_score = total_earned,
    score = CASE WHEN total_max > 0 THEN total_earned / total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok', true,
    'raw_score', total_earned,
    'total_max', total_max,
    'score', CASE WHEN total_max > 0 THEN total_earned / total_max ELSE 0 END
  );
END;
$$;
