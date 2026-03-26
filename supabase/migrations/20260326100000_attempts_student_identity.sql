-- Allow creating attempts without Supabase auth user (minimal student mode)
ALTER TABLE attempts
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS student_name TEXT,
  ADD COLUMN IF NOT EXISTS student_dob TEXT;

-- Optional indexes for quick lookup in minimal mode
CREATE INDEX IF NOT EXISTS attempts_student_identity_idx
  ON attempts (student_name, student_dob);

