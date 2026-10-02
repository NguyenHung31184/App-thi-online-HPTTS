-- Field grading set-up per practical template (authored in the exam app, read by Sổ chuyên cần) and soft delete.
-- templates.config: {"ppe": [...], "disqualify_reasons": [...], "steps": [{"key","name","cycle","photo"}],
--   "time": {"limits": [s1,s2,s3], "points": [p1,p2,p3], "aggregate": "average"|"fastest"|"last"}}
-- criteria.kind 'time' takes its score from the timed cycles; criteria.deductions: [{"label","points"}].
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.practical_exam_templates
  ADD COLUMN config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.practical_exam_criteria
  ADD COLUMN step_key text,
  ADD COLUMN kind text NOT NULL DEFAULT 'score' CHECK (kind IN ('score','time')),
  ADD COLUMN deductions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(deductions) = 'array'),
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.practical_exam_sessions ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.practical_attempts
  ADD COLUMN ppe_check jsonb,
  ADD COLUMN cycle_seconds integer[];
ALTER TABLE public.practical_attempt_scores
  ADD COLUMN deductions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(deductions) = 'array');
ALTER TABLE public.practical_attempt_photos
  ADD COLUMN kind text CHECK (kind IN ('ppe','cycle','deduction','disqualify','step','other')),
  ADD COLUMN step_key text;
COMMIT;
