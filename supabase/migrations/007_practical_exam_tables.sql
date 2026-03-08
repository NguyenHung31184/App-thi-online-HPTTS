-- Phase 5: Thi thực hành — mẫu, tiêu chí, kỳ thi, bài làm, ảnh, điểm, sync log
-- Chạy sau 006.

-- Mẫu thi thực hành
CREATE TABLE IF NOT EXISTS practical_exam_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_minutes INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Tiêu chí chấm (thuộc một mẫu)
CREATE TABLE IF NOT EXISTS practical_exam_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES practical_exam_templates(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  max_score NUMERIC NOT NULL DEFAULT 10,
  weight NUMERIC NOT NULL DEFAULT 1,
  score_step NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practical_criteria_template ON practical_exam_criteria(template_id);

-- Kỳ thi thực hành (cửa sổ: lớp, thời gian, mã)
CREATE TABLE IF NOT EXISTS practical_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES practical_exam_templates(id) ON DELETE CASCADE,
  class_id UUID NOT NULL,
  start_at BIGINT NOT NULL,
  end_at BIGINT NOT NULL,
  access_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practical_sessions_template ON practical_exam_sessions(template_id);
CREATE INDEX IF NOT EXISTS idx_practical_sessions_class ON practical_exam_sessions(class_id);

-- Bài làm thực hành của 1 thí sinh
CREATE TABLE IF NOT EXISTS practical_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES practical_exam_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_upload' CHECK (status IN ('pending_upload', 'submitted', 'grading', 'graded')),
  total_score NUMERIC,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  graded_by UUID,
  synced_to_ttdt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practical_attempts_session ON practical_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_practical_attempts_user ON practical_attempts(user_id);

-- Ảnh minh chứng (gắn với attempt, có thể gắn tiêu chí)
CREATE TABLE IF NOT EXISTS practical_attempt_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES practical_attempts(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES practical_exam_criteria(id) ON DELETE SET NULL,
  label TEXT DEFAULT '',
  file_url TEXT NOT NULL,
  order_index INT DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practical_photos_attempt ON practical_attempt_photos(attempt_id);

-- Điểm từng tiêu chí (GV chấm)
CREATE TABLE IF NOT EXISTS practical_attempt_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES practical_attempts(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES practical_exam_criteria(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  comment TEXT,
  graded_by UUID,
  graded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(attempt_id, criteria_id)
);

CREATE INDEX IF NOT EXISTS idx_practical_scores_attempt ON practical_attempt_scores(attempt_id);

-- Log đồng bộ điểm thi thực hành sang TTDT
CREATE TABLE IF NOT EXISTS practical_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practical_attempt_id UUID NOT NULL REFERENCES practical_attempts(id) ON DELETE CASCADE,
  enrollment_id UUID,
  module_id UUID,
  payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practical_sync_attempt ON practical_sync_log(practical_attempt_id);

-- RLS
ALTER TABLE practical_exam_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_exam_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_attempt_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_attempt_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_sync_log ENABLE ROW LEVEL SECURITY;

-- Templates & criteria: admin/teacher full
CREATE POLICY "practical_templates_admin_teacher" ON practical_exam_templates
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));
CREATE POLICY "practical_criteria_admin_teacher" ON practical_exam_criteria
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- Sessions: admin/teacher full; student SELECT theo lớp (giống exam_windows)
CREATE POLICY "practical_sessions_admin_teacher" ON practical_exam_sessions
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));
CREATE POLICY "practical_sessions_student_select" ON practical_exam_sessions
  FOR SELECT USING (
    get_my_role() IN ('admin', 'teacher')
    OR get_my_student_id() IS NULL
    OR (class_id) IN (
      SELECT (e.class_id)::uuid FROM enrollments e WHERE (e.student_id)::uuid = get_my_student_id()
    )
  );

-- Attempts: student own CRUD (create, read, update until submit); admin/teacher all
CREATE POLICY "practical_attempts_student_own" ON practical_attempts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "practical_attempts_admin_teacher" ON practical_attempts
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- Photos: student insert/update for own attempt; admin/teacher read
CREATE POLICY "practical_photos_student_own" ON practical_attempt_photos
  FOR ALL USING (
    attempt_id IN (SELECT id FROM practical_attempts WHERE user_id = auth.uid())
  ) WITH CHECK (
    attempt_id IN (SELECT id FROM practical_attempts WHERE user_id = auth.uid())
  );
CREATE POLICY "practical_photos_admin_teacher" ON practical_attempt_photos
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- Scores: admin/teacher only
CREATE POLICY "practical_scores_admin_teacher" ON practical_attempt_scores
  FOR ALL USING (get_my_role() IN ('admin', 'teacher')) WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- Sync log: admin/teacher read; admin/teacher insert (khi gọi đồng bộ TTDT)
CREATE POLICY "practical_sync_log_admin_teacher" ON practical_sync_log
  FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));
CREATE POLICY "practical_sync_log_insert" ON practical_sync_log
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'teacher'));

COMMENT ON TABLE practical_exam_templates IS 'Phase 5: Mẫu bài thi thực hành.';
COMMENT ON TABLE practical_exam_criteria IS 'Phase 5: Tiêu chí chấm (max_score, weight, score_step).';
COMMENT ON TABLE practical_exam_sessions IS 'Phase 5: Kỳ thi thực hành (lớp, thời gian, mã).';
COMMENT ON TABLE practical_attempts IS 'Phase 5: Bài làm thực hành của thí sinh.';
COMMENT ON TABLE practical_attempt_photos IS 'Phase 5: Ảnh minh chứng.';
COMMENT ON TABLE practical_attempt_scores IS 'Phase 5: Điểm từng tiêu chí do GV chấm.';
