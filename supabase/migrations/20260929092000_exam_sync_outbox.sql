BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.exam_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('theory','practical')),
  attempt_id uuid NOT NULL,
  target_key text NOT NULL,
  completed_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','success','superseded')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source,attempt_id)
);
CREATE INDEX exam_sync_jobs_due_idx ON public.exam_sync_jobs(next_attempt_at) WHERE status IN ('pending','processing');
CREATE INDEX exam_sync_jobs_target_idx ON public.exam_sync_jobs(target_key,completed_at);
ALTER TABLE public.exam_sync_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_sync_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.exam_sync_jobs TO authenticated;
GRANT ALL ON public.exam_sync_jobs TO service_role;
CREATE POLICY exam_sync_jobs_staff_read ON public.exam_sync_jobs FOR SELECT TO authenticated
USING ((SELECT public.get_my_exam_role()) IN ('admin','teacher'));

CREATE FUNCTION exam_private.enqueue_exam_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE student text; class text; module text; trial boolean; source_name text; completed timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'attempts' THEN
    IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN RETURN NEW; END IF;
    SELECT w.class_id::text,e.module_id::text,coalesce(w.is_trial,false)
      INTO class,module,trial FROM public.exam_windows w JOIN public.exams e ON e.id = NEW.exam_id WHERE w.id = NEW.window_id;
    IF trial THEN RETURN NEW; END IF;
    source_name := 'theory'; completed := to_timestamp(NEW.completed_at / 1000.0);
  ELSE
    IF NEW.status <> 'graded' OR (TG_OP = 'UPDATE' AND OLD.status = 'graded') THEN RETURN NEW; END IF;
    SELECT s.class_id::text,t.module_id::text INTO class,module
      FROM public.practical_exam_sessions s JOIN public.practical_exam_templates t ON t.id = s.template_id WHERE s.id = NEW.session_id;
    source_name := 'practical'; completed := coalesce(NEW.graded_at, now());
  END IF;
  SELECT student_id::text INTO student FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.exam_sync_jobs(source,attempt_id,target_key,completed_at)
    VALUES(source_name,NEW.id,concat_ws(':',source_name,coalesce(student,NEW.user_id::text),class,module),coalesce(completed,now()))
    ON CONFLICT(source,attempt_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.enqueue_exam_sync() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enqueue_theory_sync AFTER INSERT OR UPDATE OF status ON public.attempts
FOR EACH ROW EXECUTE FUNCTION exam_private.enqueue_exam_sync();
CREATE TRIGGER enqueue_practical_sync AFTER INSERT OR UPDATE OF status ON public.practical_attempts
FOR EACH ROW EXECUTE FUNCTION exam_private.enqueue_exam_sync();

-- A worker holds a lease across the HTTP call. All claims serialize briefly to exclude same-target races.
CREATE FUNCTION public.claim_exam_sync_job(p_source text DEFAULT NULL,p_attempt_id uuid DEFAULT NULL)
RETURNS SETOF public.exam_sync_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE job public.exam_sync_jobs;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('exam_sync_jobs_claim'));
  UPDATE public.exam_sync_jobs j SET status = 'superseded',updated_at = now()
  WHERE j.status IN ('pending','processing') AND (j.lease_until IS NULL OR j.lease_until < now())
    AND EXISTS (SELECT 1 FROM public.exam_sync_jobs newer WHERE newer.target_key = j.target_key
      AND newer.status = 'success' AND newer.completed_at > j.completed_at);
  SELECT * INTO job FROM public.exam_sync_jobs j
  WHERE j.status IN ('pending','processing') AND j.next_attempt_at <= now()
    AND (j.lease_until IS NULL OR j.lease_until < now())
    AND (p_source IS NULL OR j.source = p_source) AND (p_attempt_id IS NULL OR j.attempt_id = p_attempt_id)
    AND NOT EXISTS (SELECT 1 FROM public.exam_sync_jobs busy WHERE busy.target_key = j.target_key
      AND busy.status = 'processing' AND busy.lease_until >= now())
  ORDER BY j.completed_at,j.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY UPDATE public.exam_sync_jobs SET status = 'processing',lease_token = gen_random_uuid(),
    lease_until = now() + interval '2 minutes', attempts = attempts + 1,updated_at = now()
    WHERE id = job.id RETURNING *;
END;
$$;

CREATE FUNCTION public.finish_exam_sync_job(p_id uuid,p_lease_token uuid,p_success boolean,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.exam_sync_jobs SET status = CASE WHEN p_success THEN 'success' ELSE 'pending' END,
    next_attempt_at = now() + LEAST(3600, 30 * power(2, LEAST(attempts,7))) * interval '1 second',
    lease_until = NULL,lease_token = NULL,last_error = CASE WHEN p_success THEN NULL ELSE left(p_error,2000) END,updated_at = now()
    WHERE id = p_id AND lease_token = p_lease_token AND status = 'processing';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_exam_sync_job(text,uuid),public.finish_exam_sync_job(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_exam_sync_job(text,uuid),public.finish_exam_sync_job(uuid,uuid,boolean,text) TO service_role;
COMMIT;
