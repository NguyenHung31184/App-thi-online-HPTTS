BEGIN;
SET LOCAL lock_timeout = '5s';

-- Explicit definition for upgrades; bootstrap compatibility is fixed in the older patch migration.
CREATE OR REPLACE FUNCTION public.get_available_exam_windows()
RETURNS TABLE(id uuid,exam_id uuid,exam_ids uuid[],class_id text,start_at bigint,end_at bigint,
  is_trial boolean,max_attempts integer,exam_title text,class_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ew.id,ew.exam_id,ew.exam_ids,ew.class_id,ew.start_at,ew.end_at,
    coalesce(ew.is_trial,false),coalesce(ew.max_attempts,2),e.title,c.name
  FROM public.exam_windows ew
  JOIN public.exams e ON e.id=ew.exam_id AND NOT coalesce(e.is_deleted,false)
  LEFT JOIN public.classes c ON c.id::text=ew.class_id
  WHERE auth.uid() IS NOT NULL AND NOT ew.is_deleted
    AND ew.start_at <= (extract(epoch FROM clock_timestamp())*1000)::bigint
    AND ew.end_at >= (extract(epoch FROM clock_timestamp())*1000)::bigint
    AND (ew.class_id IS NULL OR EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.enrollments en ON en.student_id::text=p.student_id::text
      WHERE p.id=auth.uid() AND en.class_id::text=ew.class_id AND NOT coalesce(en.is_deleted,false)
    )) ORDER BY ew.start_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_available_exam_windows() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_available_exam_windows() TO authenticated;

CREATE OR REPLACE FUNCTION exam_private.review_questions(p_attempt_id uuid)
RETURNS TABLE(id uuid,stem text,options jsonb,answer_key text,points integer,topic text,image_url text,question_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.attempts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.attempts WHERE attempts.id=p_attempt_id;
  IF NOT FOUND OR coalesce(public.get_my_exam_role(),'') NOT IN ('admin','teacher','proctor') THEN
    RAISE EXCEPTION 'review_forbidden' USING ERRCODE='42501';
  END IF;
  IF a.status <> 'completed' THEN RAISE EXCEPTION 'attempt_not_completed' USING ERRCODE='42501'; END IF;
  IF coalesce(cardinality(a.question_ids),0)>0 THEN
    RETURN QUERY SELECT q.id,q.stem,q.options::jsonb,q.answer_key,q.points,q.topic,q.image_url,q.question_type
      FROM exam_private.bank_questions(a.id) q ORDER BY array_position(a.question_ids,q.id);
  ELSE
    RETURN QUERY SELECT q.id,q.stem,q.options::jsonb,q.answer_key,q.points,q.topic,q.image_url,q.question_type
      FROM public.questions q WHERE q.exam_id=a.exam_id ORDER BY q.created_at,q.id;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_attempt_review_questions(p_attempt_id uuid)
RETURNS TABLE(id uuid,stem text,options jsonb,answer_key text,points integer,topic text,image_url text,question_type text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM exam_private.review_questions(p_attempt_id);
$$;
GRANT USAGE ON SCHEMA exam_private TO authenticated;
REVOKE ALL ON FUNCTION exam_private.review_questions(uuid), public.get_attempt_review_questions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION exam_private.review_questions(uuid), public.get_attempt_review_questions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION exam_private.valid_essay_key(key text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE items jsonb;
BEGIN
  items := key::jsonb;
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(items)=0 THEN RETURN false; END IF;
  RETURN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(items) item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string'
      OR coalesce(btrim(item->>'text'),'')=''
      OR jsonb_typeof(item->'points') IS DISTINCT FROM 'number'
      OR coalesce((item->>'points')::numeric,0)<=0);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.valid_essay_key(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION exam_private.guard_published_essay()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.question_type IN ('main_idea','video_paragraph') AND NOT coalesce(NEW.is_deleted,false)
    AND coalesce(NEW.status,'published')='published' AND NOT exam_private.valid_essay_key(NEW.answer_key) THEN
    RAISE EXCEPTION 'essay_requires_marking_key: lưu nháp hoặc bổ sung khóa chấm trước khi xuất bản' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.guard_published_essay() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_published_essay BEFORE INSERT OR UPDATE ON public.question_bank
FOR EACH ROW EXECUTE FUNCTION exam_private.guard_published_essay();

-- Validate the issued paper as well: invalid older bank rows cannot enter a newly drawn attempt.
CREATE OR REPLACE FUNCTION exam_private.guard_attempt_essay_keys()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.questions) q
    WHERE q->>'question_type' IN ('main_idea','video_paragraph')
      AND NOT exam_private.valid_essay_key(q->>'answer_key')) THEN
    RAISE EXCEPTION 'essay_requires_marking_key: đề thi chứa câu tự luận chưa có khóa chấm' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.guard_attempt_essay_keys() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_attempt_essay_keys BEFORE INSERT ON exam_private.attempt_papers
FOR EACH ROW EXECUTE FUNCTION exam_private.guard_attempt_essay_keys();

CREATE TABLE exam_private.browser_proctoring (
  attempt_id uuid PRIMARY KEY REFERENCES public.attempts(id) ON DELETE CASCADE,
  violation_count integer NOT NULL DEFAULT 0 CHECK (violation_count>=0),
  last_violation_at timestamptz
);
ALTER TABLE exam_private.browser_proctoring ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exam_private.browser_proctoring FROM PUBLIC,anon,authenticated;
-- Existing browser logs already bundled on the client; consolidate duplicate cross-tab signals.
INSERT INTO exam_private.browser_proctoring(attempt_id,violation_count,last_violation_at)
SELECT attempt_id,count(*) FILTER (WHERE previous_at IS NULL OR created_at-previous_at>=interval '3 seconds'),max(created_at)
FROM (SELECT attempt_id,created_at,lag(created_at) OVER (PARTITION BY attempt_id ORDER BY created_at,id) previous_at
  FROM public.attempt_audit_logs WHERE event IN ('focus_lost','visibility_hidden','fullscreen_exited')) logs
GROUP BY attempt_id;

CREATE OR REPLACE FUNCTION exam_private.browser_state(p_attempt_id uuid)
RETURNS TABLE(violation_count integer,violation_limit integer,should_auto_submit boolean,attempt_completed boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.attempts; n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.attempts WHERE id=p_attempt_id;
  IF NOT FOUND OR (a.user_id IS DISTINCT FROM auth.uid() AND coalesce(public.get_my_exam_role(),'') NOT IN ('admin','teacher','proctor')) THEN
    RAISE EXCEPTION 'attempt_not_found_or_forbidden' USING ERRCODE='42501';
  END IF;
  SELECT b.violation_count INTO n FROM exam_private.browser_proctoring b WHERE b.attempt_id=a.id;
  RETURN QUERY SELECT coalesce(n,0),5,coalesce(n,0)>=5,a.status='completed';
END;
$$;
CREATE OR REPLACE FUNCTION public.get_browser_proctoring_state(p_attempt_id uuid)
RETURNS TABLE(violation_count integer,violation_limit integer,should_auto_submit boolean,attempt_completed boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT * FROM exam_private.browser_state(p_attempt_id); $$;

CREATE OR REPLACE FUNCTION exam_private.record_browser_violation(p_attempt_id uuid,p_event text)
RETURNS TABLE(audit_id uuid,accepted boolean,violation_count integer,violation_limit integer,should_auto_submit boolean,attempt_completed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.attempts; b exam_private.browser_proctoring; log_id uuid; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  IF p_event IS NULL OR p_event NOT IN ('focus_lost','visibility_hidden','fullscreen_exited') THEN
    RAISE EXCEPTION 'invalid_browser_event' USING ERRCODE='22023';
  END IF;
  SELECT * INTO a FROM public.attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  INSERT INTO exam_private.browser_proctoring(attempt_id) VALUES(a.id) ON CONFLICT DO NOTHING;
  SELECT * INTO b FROM exam_private.browser_proctoring WHERE attempt_id=a.id;
  IF a.status <> 'in_progress' OR b.last_violation_at>clock_timestamp()-interval '3 seconds' THEN
    RETURN QUERY SELECT NULL::uuid,false,b.violation_count,5,b.violation_count>=5,a.status='completed'; RETURN;
  END IF;
  UPDATE exam_private.browser_proctoring SET violation_count=b.violation_count+1,last_violation_at=clock_timestamp() WHERE attempt_id=a.id RETURNING * INTO b;
  INSERT INTO public.attempt_audit_logs(attempt_id,event,metadata)
    VALUES(a.id,p_event,jsonb_build_object('browser_confirmed',true,'violation_count',b.violation_count)) RETURNING id INTO log_id;
  IF b.violation_count>=5 THEN
    result := public.disqualify_attempt(a.id);
    IF NOT coalesce((result->>'ok')::boolean,false) THEN RAISE EXCEPTION 'browser_auto_submit_failed'; END IF;
  END IF;
  RETURN QUERY SELECT log_id,true,b.violation_count,5,b.violation_count>=5,b.violation_count>=5;
END;
$$;
CREATE OR REPLACE FUNCTION public.record_browser_violation(p_attempt_id uuid,p_event text)
RETURNS TABLE(audit_id uuid,accepted boolean,violation_count integer,violation_limit integer,should_auto_submit boolean,attempt_completed boolean)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT * FROM exam_private.record_browser_violation(p_attempt_id,p_event); $$;

CREATE OR REPLACE FUNCTION exam_private.attach_browser_evidence(p_audit_id uuid,p_metadata jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_metadata'; END IF;
  UPDATE public.attempt_audit_logs l SET metadata=coalesce(l.metadata,'{}'::jsonb)||
    jsonb_strip_nulls(jsonb_build_object('evidence_url',p_metadata->'evidence_url','evidence_path',p_metadata->'evidence_path','evidence_error',p_metadata->'evidence_error'))
  WHERE l.id=p_audit_id AND l.event IN ('focus_lost','visibility_hidden','fullscreen_exited')
    AND EXISTS (SELECT 1 FROM public.attempts a WHERE a.id=l.attempt_id AND a.user_id=auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.attach_browser_violation_evidence(p_audit_id uuid,p_metadata jsonb)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT exam_private.attach_browser_evidence(p_audit_id,p_metadata); $$;

REVOKE ALL ON FUNCTION exam_private.browser_state(uuid),exam_private.record_browser_violation(uuid,text),exam_private.attach_browser_evidence(uuid,jsonb),
  public.get_browser_proctoring_state(uuid),public.record_browser_violation(uuid,text),public.attach_browser_violation_evidence(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION exam_private.browser_state(uuid),exam_private.record_browser_violation(uuid,text),exam_private.attach_browser_evidence(uuid,jsonb),
  public.get_browser_proctoring_state(uuid),public.record_browser_violation(uuid,text),public.attach_browser_violation_evidence(uuid,jsonb) TO authenticated;

DROP POLICY IF EXISTS "attempt_audit_logs_student_insert" ON public.attempt_audit_logs;
CREATE POLICY "attempt_audit_logs_student_insert" ON public.attempt_audit_logs FOR INSERT TO authenticated WITH CHECK (
  attempt_id IN (SELECT id FROM public.attempts WHERE user_id=auth.uid())
  AND event NOT IN ('focus_lost','visibility_hidden','fullscreen_exited','ai_no_face','ai_multiple_face','ai_cell_phone','ai_prohibited_object')
);
COMMIT;
