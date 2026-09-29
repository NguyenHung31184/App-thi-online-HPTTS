CREATE OR REPLACE FUNCTION public.get_attempt_window_context(p_attempt_id uuid)
 RETURNS TABLE(end_at bigint, is_trial boolean, class_id text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
    RETURN QUERY
      SELECT ew.end_at, COALESCE(ew.is_trial, false), ew.class_id
        FROM attempts a JOIN exam_windows ew ON ew.id = a.window_id
          WHERE a.id = p_attempt_id
              AND (a.user_id = auth.uid()
                    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','teacher')));
                    END;
                    $function$
;
