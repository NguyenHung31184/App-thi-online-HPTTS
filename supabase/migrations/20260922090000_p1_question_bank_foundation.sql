CREATE TABLE IF NOT EXISTS public.question_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id UUID NOT NULL REFERENCES public.occupations(id) ON DELETE CASCADE,
  module_id TEXT,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 160),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS question_libraries_unique_scope_name
  ON public.question_libraries (occupation_id, COALESCE(module_id, ''), lower(name));
CREATE INDEX IF NOT EXISTS question_libraries_occupation_module_idx
  ON public.question_libraries (occupation_id, module_id);

CREATE TABLE IF NOT EXISTS public.question_taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.question_libraries(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.question_taxonomy_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 180),
  node_type TEXT NOT NULL CHECK (node_type IN ('topic', 'outcome')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_taxonomy_nodes_library_parent_idx
  ON public.question_taxonomy_nodes (library_id, parent_id, sort_order);

ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS library_id UUID REFERENCES public.question_libraries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS taxonomy_node_id UUID REFERENCES public.question_taxonomy_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cognitive_level TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.question_bank
  DROP CONSTRAINT IF EXISTS question_bank_status_check;
ALTER TABLE public.question_bank
  ADD CONSTRAINT question_bank_status_check CHECK (status IN ('draft', 'review', 'published', 'retired'));
ALTER TABLE public.question_bank
  DROP CONSTRAINT IF EXISTS question_bank_cognitive_level_check;
ALTER TABLE public.question_bank
  ADD CONSTRAINT question_bank_cognitive_level_check CHECK (
    cognitive_level IS NULL OR cognitive_level IN ('recognition', 'comprehension', 'application')
  );

INSERT INTO public.question_libraries (occupation_id, module_id, name, description, created_by)
SELECT
  q.occupation_id,
  q.module_id,
  COALESCE(o.name, 'Ngân hàng câu hỏi') || CASE WHEN q.module_id IS NULL THEN ' — Chưa gắn mô-đun' ELSE ' — Mô-đun ' || q.module_id END,
  'Ngân hàng được tạo tự động từ dữ liệu câu hỏi hiện có.',
  NULL
FROM public.question_bank q
LEFT JOIN public.occupations o ON o.id = q.occupation_id
WHERE q.library_id IS NULL
GROUP BY q.occupation_id, q.module_id, o.name
ON CONFLICT DO NOTHING;

UPDATE public.question_bank q
SET library_id = l.id
FROM public.question_libraries l
WHERE q.library_id IS NULL
  AND l.occupation_id = q.occupation_id
  AND l.module_id IS NOT DISTINCT FROM q.module_id;

CREATE INDEX IF NOT EXISTS question_bank_library_status_idx
  ON public.question_bank (library_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS question_bank_taxonomy_idx
  ON public.question_bank (taxonomy_node_id, cognitive_level, difficulty);

CREATE TABLE IF NOT EXISTS public.question_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.question_libraries(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_file_name TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('xlsx', 'csv', 'zip', 'docx', 'pdf', 'image')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'review_required', 'failed', 'completed')),
  total_drafts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS question_import_jobs_library_created_idx
  ON public.question_import_jobs (library_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.question_import_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.question_import_jobs(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  source_page INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4,3),
  validation_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'imported')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS public.question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_versions_question_created_idx
  ON public.question_versions (question_id, created_at DESC);

ALTER TABLE public.question_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_import_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_libraries_staff_all ON public.question_libraries;
CREATE POLICY question_libraries_staff_all ON public.question_libraries
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (public.get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS question_taxonomy_nodes_staff_all ON public.question_taxonomy_nodes;
CREATE POLICY question_taxonomy_nodes_staff_all ON public.question_taxonomy_nodes
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (public.get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS question_import_jobs_owner_or_staff ON public.question_import_jobs;
CREATE POLICY question_import_jobs_owner_or_staff ON public.question_import_jobs
  FOR ALL TO authenticated
  USING (requested_by = (select auth.uid()) OR public.get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (requested_by = (select auth.uid()) OR public.get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS question_import_drafts_staff_all ON public.question_import_drafts;
CREATE POLICY question_import_drafts_staff_all ON public.question_import_drafts
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (public.get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS question_versions_staff_select ON public.question_versions;
CREATE POLICY question_versions_staff_select ON public.question_versions
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('question-imports', 'question-imports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS question_imports_staff_select ON storage.objects;
CREATE POLICY question_imports_staff_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'question-imports' AND public.get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS question_imports_staff_insert ON storage.objects;
CREATE POLICY question_imports_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-imports' AND public.get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS question_imports_staff_update ON storage.objects;
CREATE POLICY question_imports_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'question-imports' AND public.get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (bucket_id = 'question-imports' AND public.get_my_role() IN ('admin', 'teacher'));

-- Draft and review questions must never be drawn into a locked exam.
CREATE OR REPLACE FUNCTION public.start_exam_attempt(
  p_window_id UUID,
  p_access_code TEXT
)
RETURNS public.attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window public.exam_windows%ROWTYPE;
  v_exam public.exams%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_exam_id UUID;
  v_rule JSONB;
  v_drawn UUID[];
  v_question_ids UUID[] := '{}'::UUID[];
  v_requested_count INTEGER;
  v_attempt public.attempts%ROWTYPE;
  v_failure_count INTEGER := 0;
  v_last_failure TIMESTAMPTZ;
  v_now BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_window_id::text));
  SELECT * INTO v_window FROM exam_windows WHERE id = p_window_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exam_window_not_found'; END IF;

  IF v_now < v_window.start_at OR v_now > v_window.end_at THEN
    RAISE EXCEPTION 'exam_window_closed';
  END IF;

  IF v_window.class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN enrollments en ON en.student_id::text = p.student_id::text
    WHERE p.id = v_user_id AND en.class_id::text = v_window.class_id
  ) THEN
    RAISE EXCEPTION 'exam_window_not_allowed';
  END IF;

  SELECT failure_count, last_failed_at INTO v_failure_count, v_last_failure
  FROM exam_access_failures
  WHERE user_id = v_user_id AND window_id = p_window_id;
  IF v_last_failure IS NULL OR v_last_failure < clock_timestamp() - INTERVAL '10 minutes' THEN
    v_failure_count := 0;
  END IF;
  IF v_failure_count >= 5 THEN
    RAISE EXCEPTION 'access_code_rate_limited';
  END IF;
  IF COALESCE(p_access_code, '') <> v_window.access_code THEN
    INSERT INTO exam_access_failures (user_id, window_id, failure_count, last_failed_at)
    VALUES (v_user_id, p_window_id, 1, clock_timestamp())
    ON CONFLICT (user_id, window_id) DO UPDATE SET
      failure_count = CASE
        WHEN exam_access_failures.last_failed_at < clock_timestamp() - INTERVAL '10 minutes' THEN 1
        ELSE exam_access_failures.failure_count + 1
      END,
      last_failed_at = clock_timestamp();
    RETURN NULL;
  END IF;

  IF NOT COALESCE(v_window.is_trial, false) AND COALESCE(v_window.max_attempts, 2) > 0
     AND (SELECT COUNT(*) FROM attempts WHERE user_id = v_user_id AND window_id = p_window_id)
       >= v_window.max_attempts THEN
    RAISE EXCEPTION 'attempt_limit_reached';
  END IF;

  SELECT unnest(COALESCE(NULLIF(v_window.exam_ids, '{}'::UUID[]), ARRAY[v_window.exam_id]))
  ORDER BY random() LIMIT 1 INTO v_exam_id;
  SELECT * INTO v_exam FROM exams
  WHERE id = v_exam_id AND COALESCE(is_deleted, false) = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'exam_not_available'; END IF;
  IF v_exam.locked_at IS NULL THEN RAISE EXCEPTION 'exam_not_locked'; END IF;
  IF v_exam.module_id IS NULL OR btrim(v_exam.module_id::text) = '' THEN
    RAISE EXCEPTION 'exam_no_module';
  END IF;
  IF v_exam.blueprint IS NULL OR jsonb_typeof(v_exam.blueprint) <> 'array'
     OR jsonb_array_length(v_exam.blueprint) = 0 THEN
    RAISE EXCEPTION 'exam_no_blueprint';
  END IF;

  FOR v_rule IN SELECT value FROM jsonb_array_elements(v_exam.blueprint) LOOP
    IF COALESCE(v_rule->>'count', '') !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'invalid_exam_blueprint';
    END IF;
    v_requested_count := (v_rule->>'count')::INTEGER;
    SELECT array_agg(id) INTO v_drawn FROM (
      SELECT id FROM question_bank
      WHERE module_id::text = v_exam.module_id::text
        AND (v_rule->>'topic' = '*' OR topic = v_rule->>'topic')
        AND (v_rule->>'difficulty' = '*' OR difficulty = v_rule->>'difficulty')
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(status, 'published') = 'published'
        AND id <> ALL(v_question_ids)
      ORDER BY random() LIMIT v_requested_count
    ) selected_questions;
    IF COALESCE(array_length(v_drawn, 1), 0) <> v_requested_count THEN
      RAISE EXCEPTION 'insufficient_questions_for_blueprint';
    END IF;
    v_question_ids := v_question_ids || v_drawn;
  END LOOP;

  INSERT INTO attempts (user_id, window_id, exam_id, status, answers, started_at, question_ids)
  VALUES (v_user_id, p_window_id, v_exam_id, 'in_progress', '{}'::JSONB, v_now, v_question_ids)
  RETURNING * INTO v_attempt;
  RETURN v_attempt;
END;
$$;
