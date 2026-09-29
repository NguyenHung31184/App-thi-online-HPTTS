BEGIN;
SET LOCAL lock_timeout = '5s';

-- Keep the SCC teacher policy: practical grading is shared with that application.
DROP POLICY IF EXISTS practical_attempts_student_own ON public.practical_attempts;
CREATE POLICY practical_attempts_student_read ON public.practical_attempts
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS practical_photos_student_own ON public.practical_attempt_photos;
CREATE POLICY practical_photos_student_read ON public.practical_attempt_photos
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.practical_attempts a WHERE a.id = attempt_id AND a.user_id = (SELECT auth.uid())
));
CREATE POLICY practical_photos_student_edit ON public.practical_attempt_photos
FOR ALL TO authenticated USING (EXISTS (
  SELECT 1 FROM public.practical_attempts a WHERE a.id = attempt_id
  AND a.user_id = (SELECT auth.uid()) AND a.status = 'pending_upload'
)) WITH CHECK (EXISTS (
  SELECT 1 FROM public.practical_attempts a WHERE a.id = attempt_id
  AND a.user_id = (SELECT auth.uid()) AND a.status = 'pending_upload'
));

-- Serialize evidence edits with submission; a policy alone can see a pre-submit row snapshot.
CREATE FUNCTION exam_private.guard_practical_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.practical_attempts; old_id uuid; new_id uuid;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' OR coalesce(public.get_my_role(),'') IN ('admin','teacher') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN old_id := OLD.attempt_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW.attempt_id; END IF;
  FOR a IN SELECT * FROM public.practical_attempts WHERE id IN (old_id,new_id) ORDER BY id FOR UPDATE LOOP
    IF a.user_id IS DISTINCT FROM auth.uid() OR a.status <> 'pending_upload' THEN
      RAISE EXCEPTION 'evidence_locked';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION exam_private.guard_practical_evidence() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_practical_evidence BEFORE INSERT OR UPDATE OR DELETE ON public.practical_attempt_photos
FOR EACH ROW EXECUTE FUNCTION exam_private.guard_practical_evidence();

CREATE FUNCTION public.start_practical_attempt(p_session_id uuid, p_access_code text)
RETURNS public.practical_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s public.practical_exam_sessions; a public.practical_attempts; now_ms bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text), hashtext(p_session_id::text));
  SELECT * INTO s FROM public.practical_exam_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  IF now_ms < s.start_at OR now_ms > s.end_at THEN RAISE EXCEPTION 'session_closed'; END IF;
  IF p_access_code IS DISTINCT FROM s.access_code THEN RAISE EXCEPTION 'invalid_access_code'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.enrollments e ON e.student_id::text = p.student_id::text
    WHERE p.id = auth.uid() AND e.class_id::text = s.class_id::text AND NOT coalesce(e.is_deleted, false)
  ) THEN RAISE EXCEPTION 'session_not_allowed'; END IF;
  SELECT * INTO a FROM public.practical_attempts WHERE session_id = s.id AND user_id = auth.uid()
    AND status = 'pending_upload' ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN a; END IF;
  INSERT INTO public.practical_attempts(session_id,user_id,status) VALUES(s.id,auth.uid(),'pending_upload')
    RETURNING * INTO a;
  RETURN a;
END;
$$;

CREATE FUNCTION public.submit_practical_attempt(p_attempt_id uuid)
RETURNS public.practical_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.practical_attempts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  SELECT * INTO a FROM public.practical_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF a.status <> 'pending_upload' THEN RETURN a; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.practical_attempt_photos WHERE attempt_id = a.id) THEN
    RAISE EXCEPTION 'evidence_required';
  END IF;
  UPDATE public.practical_attempts SET status = 'submitted',submitted_at = now(),updated_at = now()
    WHERE id = a.id RETURNING * INTO a;
  RETURN a;
END;
$$;
REVOKE ALL ON FUNCTION public.start_practical_attempt(uuid,text),public.submit_practical_attempt(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_practical_attempt(uuid,text),public.submit_practical_attempt(uuid) TO authenticated;
COMMIT;
