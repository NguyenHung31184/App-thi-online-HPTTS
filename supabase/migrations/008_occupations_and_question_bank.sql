-- Nghề đào tạo (theo nghề, không theo khóa học) + Ngân hàng câu hỏi theo nghề
-- Soạn câu hỏi tách riêng khỏi đề thi; câu hỏi thuộc nghề, khi tạo đề sẽ lấy từ ngân hàng.

CREATE TABLE IF NOT EXISTS occupations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_occupations_name ON occupations(name);

-- Ngân hàng câu hỏi theo nghề (cấu trúc giống questions, không có exam_id)
CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_question_bank_occupation_id ON question_bank(occupation_id);

ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON question_bank FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE occupations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON occupations FOR ALL USING (true) WITH CHECK (true);

-- Seed nghề đào tạo mặc định (chỉ khi bảng trống)
INSERT INTO occupations (name, code)
SELECT 'Vận hành xe nâng hàng container', 'VH_XN_CONTAINER'
WHERE NOT EXISTS (SELECT 1 FROM occupations LIMIT 1)
UNION ALL
SELECT 'Vận hành xe nâng hàng Forklift', 'VH_XN_FORKLIFT'
WHERE NOT EXISTS (SELECT 1 FROM occupations LIMIT 1);
