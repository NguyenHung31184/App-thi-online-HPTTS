-- Field grading in Sổ chuyên cần (SCC): the student has no exam app account, so the attempt carries the TTDT student
-- id itself. The queue uses it; attempts graded by the old SCC screens (user_id = TTDT students.id) still resolve.
-- "not_eligible": the student lacked protective equipment and did not sit the exam; nothing is sent to TTDT.
-- Practical totals are on 100 points; TTDT gets total / 10, passed from the template's pass mark (default 70).
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.practical_attempts ADD COLUMN student_id text, ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.practical_attempts
  ADD CONSTRAINT practical_attempts_owner_check CHECK (user_id IS NOT NULL OR student_id IS NOT NULL);
ALTER TABLE public.practical_attempts DROP CONSTRAINT practical_attempts_status_check,
  ADD CONSTRAINT practical_attempts_status_check
  CHECK (status IN ('pending_upload','submitted','grading','graded','not_eligible'));
ALTER TABLE public.practical_exam_templates
  ADD COLUMN pass_score numeric NOT NULL DEFAULT 70 CHECK (pass_score BETWEEN 0 AND 100);
CREATE INDEX practical_attempts_student_idx ON public.practical_attempts(student_id) WHERE student_id IS NOT NULL;

CREATE OR REPLACE FUNCTION exam_private.enqueue_exam_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE student text; class text; module text; trial boolean; source_name text; completed timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'attempts' THEN
    IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN RETURN NEW; END IF;
    SELECT w.class_id::text,e.module_id::text,coalesce(w.is_trial,false)
      INTO class,module,trial FROM public.exam_windows w JOIN public.exams e ON e.id = NEW.exam_id WHERE w.id = NEW.window_id;
    IF trial THEN RETURN NEW; END IF;
    source_name := 'theory'; completed := to_timestamp(NEW.completed_at / 1000.0);
    SELECT p.student_id::text INTO student FROM public.profiles p WHERE p.id = NEW.user_id;
  ELSE
    IF NEW.status <> 'graded' OR (TG_OP = 'UPDATE' AND OLD.status = 'graded') THEN RETURN NEW; END IF;
    SELECT s.class_id::text,t.module_id::text INTO class,module
      FROM public.practical_exam_sessions s JOIN public.practical_exam_templates t ON t.id = s.template_id WHERE s.id = NEW.session_id;
    source_name := 'practical'; completed := coalesce(NEW.graded_at, now());
    student := NEW.student_id;
    IF student IS NULL THEN SELECT p.student_id::text INTO student FROM public.profiles p WHERE p.id = NEW.user_id; END IF;
  END IF;
  INSERT INTO public.exam_sync_jobs(source,attempt_id,target_key,completed_at)
    VALUES(source_name,NEW.id,concat_ws(':',source_name,coalesce(student,NEW.user_id::text),class,module),coalesce(completed,now()))
    ON CONFLICT(source,attempt_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.enqueue_exam_sync() FROM PUBLIC,anon,authenticated;
COMMIT;
