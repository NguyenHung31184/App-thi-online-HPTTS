-- App Thi Online — Migration MVP (Phase 0)
-- Chạy trong Supabase SQL Editor (cùng project TTDT hoặc project riêng).
-- Bảng dùng schema public; nếu cần tách thì đổi sang schema exam.

-- Enum cho question_type (MVP dùng single_choice)
DO $$ BEGIN
  CREATE TYPE question_type_enum AS ENUM (
    'single_choice', 'multiple_choice', 'drag_drop', 'video_paragraph', 'main_idea'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Bảng đề thi
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 60,
  pass_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  total_questions INT NOT NULL DEFAULT 0,
  blueprint JSONB DEFAULT '[]',
  questions_snapshot_url TEXT,
  module_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Bảng câu hỏi (MVP: question_type = single_choice)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'single_choice',
  stem TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  answer_key TEXT NOT NULL,
  points INT NOT NULL DEFAULT 1,
  topic TEXT DEFAULT '',
  difficulty TEXT DEFAULT 'medium',
  image_url TEXT,
  media_url TEXT,
  rubric JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);

-- Bảng cửa sổ thi (exam_windows). class_id trỏ tới TTDT classes nếu cùng DB
CREATE TABLE IF NOT EXISTS exam_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id UUID NOT NULL,
  start_at BIGINT NOT NULL,
  end_at BIGINT NOT NULL,
  access_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_windows_exam_id ON exam_windows(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_windows_class_id ON exam_windows(class_id);

-- Bảng bài làm (attempts)
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  window_id UUID NOT NULL REFERENCES exam_windows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  answers JSONB DEFAULT '{}',
  score NUMERIC(5,4),
  raw_score NUMERIC(5,4),
  penalty_applied NUMERIC(5,4),
  disqualified BOOLEAN DEFAULT FALSE,
  started_at BIGINT NOT NULL,
  completed_at BIGINT,
  review_requested BOOLEAN DEFAULT FALSE,
  synced_to_ttdt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam_id ON attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_window_id ON attempts(window_id);

-- Bảng audit log giám sát thi
CREATE TABLE IF NOT EXISTS attempt_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempt_audit_logs_attempt_id ON attempt_audit_logs(attempt_id);

-- Bảng log đồng bộ điểm sang TTDT
CREATE TABLE IF NOT EXISTS exam_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL,
  enrollment_id UUID,
  module_id UUID,
  payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: bật và thêm policy cơ bản (chi tiết theo từng bảng trong Phase 3)
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sync_log ENABLE ROW LEVEL SECURITY;

-- Policy tạm: cho phép service_role / anon đọc ghi (sẽ thu hẹp theo role trong Phase 3)
CREATE POLICY "Allow all for now" ON exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON exam_windows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON attempt_audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON exam_sync_log FOR ALL USING (true) WITH CHECK (true);
