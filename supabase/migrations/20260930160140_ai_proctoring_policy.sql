BEGIN;

ALTER TABLE public.exam_windows
  ADD COLUMN IF NOT EXISTS proctoring_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS ai_risk_threshold integer NOT NULL DEFAULT 6;

ALTER TABLE public.exam_windows
  DROP CONSTRAINT IF EXISTS exam_windows_proctoring_mode_check,
  DROP CONSTRAINT IF EXISTS exam_windows_ai_risk_threshold_check;

ALTER TABLE public.exam_windows
  ADD CONSTRAINT exam_windows_proctoring_mode_check
    CHECK (proctoring_mode IN ('standard', 'strict', 'supervised')),
  ADD CONSTRAINT exam_windows_ai_risk_threshold_check
    CHECK (ai_risk_threshold BETWEEN 4 AND 12);

COMMENT ON COLUMN public.exam_windows.proctoring_mode IS
  'standard: AI chỉ lưu bằng chứng; strict: AI có thể tự nộp theo điểm; supervised: giám thị xác nhận.';
COMMENT ON COLUMN public.exam_windows.ai_risk_threshold IS
  'Ngưỡng điểm AI để tự nộp trong strict mode; luôn cần ít nhất 2 sự kiện độc lập.';

CREATE OR REPLACE FUNCTION public.get_ai_proctoring_state(p_attempt_id uuid)
RETURNS TABLE (
  mode text,
  risk_threshold integer,
  risk_score integer,
  incident_count integer,
  should_auto_submit boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_threshold integer;
  v_score integer;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT w.proctoring_mode, w.ai_risk_threshold
  INTO v_mode, v_threshold
  FROM public.attempts a
  JOIN public.exam_windows w ON w.id = a.window_id
  WHERE a.id = p_attempt_id
    AND (
      a.user_id = auth.uid()
      OR coalesce(public.get_my_exam_role(), '') IN ('admin', 'teacher', 'proctor')
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'attempt_not_found_or_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT
    coalesce(sum(
      CASE
        WHEN coalesce(l.metadata->>'review_status', '') = 'rejected' THEN 0
        WHEN coalesce(l.metadata->>'machine_confirmed', '') = 'true' THEN
          CASE l.event
            WHEN 'ai_no_face' THEN 1
            WHEN 'ai_multiple_face' THEN 2
            WHEN 'ai_cell_phone' THEN 3
            WHEN 'ai_prohibited_object' THEN 2
            ELSE 0
          END
        ELSE 0
      END
    ), 0)::integer,
    count(*) FILTER (
      WHERE coalesce(l.metadata->>'machine_confirmed', '') = 'true'
        AND coalesce(l.metadata->>'review_status', '') <> 'rejected'
    )::integer
  INTO v_score, v_count
  FROM public.attempt_audit_logs l
  WHERE l.attempt_id = p_attempt_id
    AND l.event IN ('ai_no_face', 'ai_multiple_face', 'ai_cell_phone', 'ai_prohibited_object');

  RETURN QUERY SELECT
    v_mode,
    v_threshold,
    v_score,
    v_count,
    v_mode = 'strict' AND v_score >= v_threshold AND v_count >= 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ai_proctoring_incident(
  p_attempt_id uuid,
  p_event text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  accepted boolean,
  mode text,
  risk_threshold integer,
  risk_score integer,
  incident_count integer,
  should_auto_submit boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_threshold integer;
  v_weight integer;
  v_state record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_event NOT IN ('ai_no_face', 'ai_multiple_face', 'ai_cell_phone', 'ai_prohibited_object') THEN
    RAISE EXCEPTION 'invalid_ai_event' USING ERRCODE = '22023';
  END IF;

  SELECT w.proctoring_mode, w.ai_risk_threshold
  INTO v_mode, v_threshold
  FROM public.attempts a
  JOIN public.exam_windows w ON w.id = a.window_id
  WHERE a.id = p_attempt_id
    AND a.user_id = auth.uid()
    AND a.status = 'in_progress'
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'attempt_not_in_progress_or_forbidden' USING ERRCODE = '42501';
  END IF;

  v_weight := CASE p_event
    WHEN 'ai_no_face' THEN 1
    WHEN 'ai_multiple_face' THEN 2
    WHEN 'ai_cell_phone' THEN 3
    WHEN 'ai_prohibited_object' THEN 2
  END;

  IF EXISTS (
    SELECT 1 FROM public.attempt_audit_logs l
    WHERE l.attempt_id = p_attempt_id
      AND l.event = p_event
      AND coalesce(l.metadata->>'machine_confirmed', '') = 'true'
      AND l.created_at > clock_timestamp() - interval '5 seconds'
  ) THEN
    SELECT * INTO v_state FROM public.get_ai_proctoring_state(p_attempt_id);
    RETURN QUERY SELECT false, v_state.mode, v_state.risk_threshold,
      v_state.risk_score, v_state.incident_count, v_state.should_auto_submit;
    RETURN;
  END IF;

  INSERT INTO public.attempt_audit_logs (attempt_id, event, metadata)
  VALUES (
    p_attempt_id,
    p_event,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'machine_confirmed', true,
      'risk_points', v_weight,
      'proctoring_mode', v_mode,
      'risk_threshold', v_threshold,
      'review_status', CASE WHEN v_mode = 'supervised' THEN 'pending' ELSE 'unreviewed' END
    )
  );

  SELECT * INTO v_state FROM public.get_ai_proctoring_state(p_attempt_id);
  RETURN QUERY SELECT true, v_state.mode, v_state.risk_threshold,
    v_state.risk_score, v_state.incident_count, v_state.should_auto_submit;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_ai_proctoring_incident(
  p_log_id uuid,
  p_decision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(public.get_my_exam_role(), '') NOT IN ('admin', 'teacher', 'proctor') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'invalid_review_decision' USING ERRCODE = '22023';
  END IF;

  UPDATE public.attempt_audit_logs
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'review_status', p_decision,
    'machine_confirmed', p_decision = 'confirmed' OR coalesce(metadata->>'machine_confirmed', '') = 'true',
    'reviewed_by', auth.uid(),
    'reviewed_at', clock_timestamp()
  )
  WHERE id = p_log_id
    AND event IN ('ai_no_face', 'ai_multiple_face', 'ai_cell_phone', 'ai_prohibited_object');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_incident_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_proctoring_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ai_proctoring_incident(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_ai_proctoring_incident(uuid, text) FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.attempt_audit_logs FROM anon;

DROP POLICY IF EXISTS "attempt_audit_logs_student_insert" ON public.attempt_audit_logs;
CREATE POLICY "attempt_audit_logs_student_insert" ON public.attempt_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    attempt_id IN (SELECT id FROM public.attempts WHERE user_id = auth.uid())
    AND event NOT IN ('ai_no_face', 'ai_multiple_face', 'ai_cell_phone', 'ai_prohibited_object')
  );

DROP POLICY IF EXISTS "attempt_audit_logs_admin_teacher_select" ON public.attempt_audit_logs;
DROP POLICY IF EXISTS "attempt_audit_logs_exam_staff_select" ON public.attempt_audit_logs;
CREATE POLICY "attempt_audit_logs_exam_staff_select" ON public.attempt_audit_logs
  FOR SELECT TO authenticated
  USING (coalesce(public.get_my_exam_role(), '') IN ('admin', 'teacher', 'proctor'));

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "evidence-images select admin-teacher" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "evidence-images select exam-staff" ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY "evidence-images select exam-staff" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'exam-uploads'
          AND (name LIKE 'proctoring/%' OR name LIKE 'cccd/%')
          AND coalesce(public.get_my_exam_role(), '') IN ('admin', 'teacher', 'proctor')
        )
    $policy$;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_proctoring_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_proctoring_incident(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_ai_proctoring_incident(uuid, text) TO authenticated;

COMMIT;
