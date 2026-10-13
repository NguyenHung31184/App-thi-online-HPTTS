-- The exam clock starts when the student finishes the preparation steps (workspace photo, face photo),
-- not when the attempt is created. Preparation is capped: after the allowance the clock runs anyway.
--
-- Before: deadline = LEAST(window end, started_at + duration), fixed when the attempt is created.
-- After:  the paper is created with the latest possible deadline,
--           LEAST(window end, started_at + allowance + duration),
--         and begin_exam_clock() moves it earlier, to LEAST(window end, clock start + duration), where
--         clock start = LEAST(now, started_at + allowance). The deadline can only move earlier, and only once.
-- A client that never calls begin_exam_clock() keeps the latest deadline, so the worst case is the allowance.

ALTER TABLE exam_private.attempt_papers ADD COLUMN clock_started_at bigint;
COMMENT ON COLUMN exam_private.attempt_papers.clock_started_at IS
  'Epoch ms when the working time began. NULL while the student is still preparing.';

-- Papers written before this change already carry their final deadline.
UPDATE exam_private.attempt_papers p SET clock_started_at = a.started_at
FROM public.attempts a WHERE a.id = p.attempt_id;

CREATE FUNCTION exam_private.preparation_allowance_ms() RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'pg_temp'
AS $$ SELECT 300000::bigint $$;
REVOKE ALL ON FUNCTION exam_private.preparation_allowance_ms() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION exam_private.capture_attempt_paper()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE paper jsonb; deadline_ms bigint;
BEGIN
  IF coalesce(cardinality(NEW.question_ids), 0) = 0 THEN RETURN NEW; END IF;
  SELECT jsonb_agg(to_jsonb(q) ORDER BY array_position(NEW.question_ids, q.id)) INTO paper
  FROM (SELECT * FROM public.question_bank WHERE id = ANY(NEW.question_ids) FOR SHARE) q;
  IF coalesce(jsonb_array_length(paper), 0) <> cardinality(NEW.question_ids) THEN
    RAISE EXCEPTION 'incomplete_attempt_paper';
  END IF;
  SELECT LEAST(w.end_at, NEW.started_at + exam_private.preparation_allowance_ms() + e.duration_minutes::bigint * 60000)
  INTO deadline_ms FROM public.exams e JOIN public.exam_windows w ON w.id = NEW.window_id
  WHERE e.id = NEW.exam_id;
  INSERT INTO exam_private.attempt_papers(attempt_id, questions, deadline)
  VALUES (NEW.id, paper, deadline_ms);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION exam_private.capture_attempt_paper() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.begin_exam_clock(p_attempt_id uuid) RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  a public.attempts;
  v_now bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_clock bigint;
  v_deadline bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;
  IF a.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT p.clock_started_at INTO v_clock FROM exam_private.attempt_papers p WHERE p.attempt_id = a.id FOR UPDATE;
  -- No paper (attempt from before papers existed), clock already running, or attempt closed: nothing to change.
  IF NOT FOUND OR v_clock IS NOT NULL OR a.status <> 'in_progress' THEN
    RETURN exam_private.attempt_deadline(a.id);
  END IF;

  v_clock := LEAST(v_now, a.started_at + exam_private.preparation_allowance_ms());
  SELECT LEAST(w.end_at, v_clock + e.duration_minutes::bigint * 60000) INTO v_deadline
  FROM public.exams e JOIN public.exam_windows w ON w.id = a.window_id WHERE e.id = a.exam_id;

  UPDATE exam_private.attempt_papers SET clock_started_at = v_clock, deadline = v_deadline WHERE attempt_id = a.id;
  INSERT INTO public.attempt_audit_logs (attempt_id, event, metadata)
  VALUES (a.id, 'exam_clock_started', jsonb_build_object('preparation_ms', v_clock - a.started_at, 'deadline', v_deadline));
  RETURN v_deadline;
END;
$function$;
REVOKE ALL ON FUNCTION public.begin_exam_clock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_exam_clock(uuid) TO authenticated;
