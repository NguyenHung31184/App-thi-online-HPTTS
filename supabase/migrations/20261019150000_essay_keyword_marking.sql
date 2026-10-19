-- Essay keyword marking (19/10/2026).
-- A marking point in an essay answer_key may now carry "keywords" (groups, alternatives split by "/")
-- and "approved". The point is earned when the first 200 characters of the answer hit at least two
-- groups (one when the point has a single group). Matching ignores case and accents; a multi-word
-- alternative also counts when all its words appear in another order. Points without keywords keep
-- the old rule (the whole point text inside the answer). The client mirror is
-- src/modules/question-bank/domain/essay-keywords.ts; keep the two in step.
-- Publishing an essay (insert, key change, or status change to published) now needs approved keywords;
-- rows already published are not touched, so exams in progress keep drawing them.

CREATE OR REPLACE FUNCTION exam_private.essay_norm(t text)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT ' ' || btrim(regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '[^a-z0-9]+', ' ', 'g')) || ' ';
$$;

CREATE OR REPLACE FUNCTION exam_private.essay_words(t text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(array_remove(regexp_split_to_array(lower(coalesce(t, '')), '[\s,.;:!?()"''/\-]+'), ''), '{}');
$$;

CREATE OR REPLACE FUNCTION exam_private.essay_point_score(item jsonb, ans text)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  pts numeric := 0;
  groups text[];
  grp text;
  alt text;
  answer text;
  answer_norm text;
  answer_words text[];
  alt_norm text;
  alt_words text[];
  hits int := 0;
  hit boolean;
BEGIN
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR ans IS NULL OR btrim(ans) = '' THEN RETURN 0; END IF;
  IF jsonb_typeof(item->'points') = 'number' THEN pts := (item->>'points')::numeric; END IF;
  IF pts <= 0 THEN RETURN 0; END IF;

  IF jsonb_typeof(item->'keywords') = 'array' THEN
    SELECT array_agg(v) INTO groups FROM jsonb_array_elements_text(item->'keywords') v WHERE btrim(v) <> '';
  END IF;
  IF groups IS NULL OR cardinality(groups) = 0 THEN
    IF coalesce(btrim(item->>'text'), '') <> '' AND position(lower(btrim(item->>'text')) IN lower(ans)) > 0 THEN RETURN pts; END IF;
    RETURN 0;
  END IF;

  answer := left(ans, 200);
  answer_norm := exam_private.essay_norm(answer);
  answer_words := exam_private.essay_words(answer);
  FOREACH grp IN ARRAY groups LOOP
    hit := false;
    FOREACH alt IN ARRAY string_to_array(grp, '/') LOOP
      alt_norm := exam_private.essay_norm(alt);
      alt_words := exam_private.essay_words(alt);
      IF btrim(alt_norm) <> '' AND (position(alt_norm IN answer_norm) > 0
         OR (cardinality(alt_words) > 1 AND alt_words <@ answer_words)) THEN
        hit := true;
        EXIT;
      END IF;
    END LOOP;
    IF hit THEN hits := hits + 1; END IF;
  END LOOP;
  RETURN CASE WHEN hits >= least(2, cardinality(groups)) THEN pts ELSE 0 END;
END;
$$;

CREATE OR REPLACE FUNCTION exam_private.essay_keywords_pending(key text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM jsonb_array_elements(key::jsonb) item
    WHERE jsonb_typeof(item->'keywords') IS DISTINCT FROM 'array'
       OR jsonb_array_length(item->'keywords') = 0
       OR coalesce(item->'approved', 'false'::jsonb) IS DISTINCT FROM 'true'::jsonb);
EXCEPTION WHEN OTHERS THEN RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION exam_private.essay_norm(text), exam_private.essay_words(text),
  exam_private.essay_point_score(jsonb, text), exam_private.essay_keywords_pending(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION exam_private.guard_published_essay()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.question_type IN ('main_idea','video_paragraph') AND NOT coalesce(NEW.is_deleted,false)
    AND coalesce(NEW.status,'published')='published' AND NOT exam_private.valid_essay_key(NEW.answer_key) THEN
    RAISE EXCEPTION 'essay_requires_marking_key: lưu nháp hoặc bổ sung khóa chấm trước khi xuất bản' USING ERRCODE='23514';
  END IF;
  IF NEW.question_type IN ('main_idea','video_paragraph') AND NOT coalesce(NEW.is_deleted,false)
    AND coalesce(NEW.status,'published')='published'
    AND (TG_OP = 'INSERT' OR NEW.answer_key IS DISTINCT FROM OLD.answer_key OR OLD.status IS DISTINCT FROM 'published')
    AND exam_private.essay_keywords_pending(NEW.answer_key) THEN
    RAISE EXCEPTION 'essay_keywords_unapproved: duyệt từ khóa chấm trước khi phát hành câu tự luận' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grade_attempt(aid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r            RECORD;
  q            RECORD;
  total_earned NUMERIC := 0;
  v_total_max  NUMERIC := 0;
  ans          TEXT;
  ans_json     JSONB;
  key_json     JSONB;
  ans_arr      TEXT[];
  key_arr      TEXT[];
  i            INT;
  match_flag   BOOLEAN;
  essay_sum    NUMERIC;
  essay_earned NUMERIC;
  n_items      INT;
  n_correct    INT;
  key_map      JSONB;
  kv_key       TEXT;
BEGIN
  SELECT a.id, a.user_id, a.exam_id, a.answers, a.status, a.question_ids
  INTO   r
  FROM   attempts a WHERE a.id = aid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  FOR q IN
    SELECT qb.id, qb.question_type, qb.answer_key, qb.points
    FROM   exam_private.bank_questions(aid) qb
    WHERE  r.question_ids IS NOT NULL
      AND  array_length(r.question_ids, 1) IS NOT NULL
      AND  qb.id = ANY(r.question_ids)
      AND  qb.is_deleted = false
    UNION ALL
    SELECT qt.id, qt.question_type, qt.answer_key, qt.points
    FROM   questions qt
    WHERE  (r.question_ids IS NULL OR array_length(r.question_ids, 1) IS NULL)
      AND  qt.exam_id = r.exam_id
  LOOP
    v_total_max := v_total_max + q.points;
    ans := r.answers->>(q.id::TEXT);

    IF q.question_type = 'multiple_choice' THEN
      BEGIN
        ans_json := ans::JSONB;
        key_json := q.answer_key::JSONB;
        IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(key_json) ORDER BY 1) INTO key_arr;
          SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json) ORDER BY 1) INTO ans_arr;
          IF ans_arr = key_arr THEN
            total_earned := total_earned + q.points;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type = 'drag_drop' THEN
      BEGIN
        ans_json := ans::JSONB;
        key_json := q.answer_key::JSONB;
        IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(key_json)) INTO key_arr;
          SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json)) INTO ans_arr;
          IF array_length(key_arr, 1) = array_length(ans_arr, 1) THEN
            match_flag := true;
            FOR i IN 1..array_length(key_arr, 1) LOOP
              IF key_arr[i] IS DISTINCT FROM ans_arr[i] THEN
                match_flag := false; EXIT;
              END IF;
            END LOOP;
            IF match_flag THEN total_earned := total_earned + q.points; END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type = 'true_false_multi' THEN
      BEGIN
        ans_json := ans::JSONB;
        key_json := q.answer_key::JSONB;
        IF jsonb_typeof(ans_json) = 'array' AND jsonb_typeof(key_json) = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(key_json)) INTO key_arr;
          SELECT ARRAY(SELECT jsonb_array_elements_text(ans_json)) INTO ans_arr;
          n_items := array_length(key_arr, 1);
          IF n_items > 0 AND array_length(ans_arr, 1) = n_items THEN
            n_correct := 0;
            FOR i IN 1..n_items LOOP
              IF UPPER(TRIM(key_arr[i])) = UPPER(TRIM(ans_arr[i])) THEN
                n_correct := n_correct + 1;
              END IF;
            END LOOP;
            total_earned := total_earned + ROUND((q.points::NUMERIC * n_correct / n_items)::NUMERIC, 2);
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type = 'matching' THEN
      BEGIN
        key_json := q.answer_key::JSONB;
        ans_json := ans::JSONB;
        IF jsonb_typeof(key_json) = 'object' AND jsonb_typeof(ans_json) = 'object' THEN
          key_map := key_json -> 'map';
          IF jsonb_typeof(key_map) = 'object' THEN
            n_items := (SELECT COUNT(*) FROM jsonb_object_keys(key_map));
            IF n_items > 0 THEN
              n_correct := 0;
              FOR kv_key IN SELECT key FROM jsonb_each_text(key_map) LOOP
                IF (ans_json ->> kv_key) IS NOT DISTINCT FROM (key_map ->> kv_key) THEN
                  n_correct := n_correct + 1;
                END IF;
              END LOOP;
              total_earned := total_earned + ROUND((q.points::NUMERIC * n_correct / n_items)::NUMERIC, 2);
            END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    ELSIF q.question_type IN ('video_paragraph', 'main_idea') THEN
      key_json := NULL;
      BEGIN
        IF q.answer_key IS NOT NULL AND LENGTH(TRIM(q.answer_key)) > 0 THEN
          key_json := q.answer_key::JSONB;
          IF jsonb_typeof(key_json) != 'array' THEN key_json := NULL; END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN key_json := NULL;
      END;

      IF key_json IS NOT NULL
         AND jsonb_array_length(key_json) > 0
         AND ans IS NOT NULL AND LENGTH(TRIM(ans)) > 0
      THEN
        SELECT COALESCE(SUM(exam_private.essay_point_score(kv, ans)), 0)
        INTO essay_earned
        FROM jsonb_array_elements(key_json) AS kv;

        essay_earned := LEAST(essay_earned, q.points);

        INSERT INTO attempt_question_scores (attempt_id, question_id, score, max_points)
        VALUES (aid, q.id, essay_earned, q.points)
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET score = EXCLUDED.score, max_points = EXCLUDED.max_points;
      END IF;

    ELSE
      IF ans IS NOT NULL AND TRIM(ans) = TRIM(q.answer_key) THEN
        total_earned := total_earned + q.points;
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(score), 0) INTO essay_sum
  FROM attempt_question_scores WHERE attempt_id = aid;

  UPDATE attempts
  SET
    status       = 'completed',
    raw_score    = total_earned + essay_sum,
    total_max    = v_total_max,
    score        = CASE WHEN v_total_max > 0 THEN (total_earned + essay_sum) / v_total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok',        true,
    'raw_score', total_earned + essay_sum,
    'total_max', v_total_max,
    'score',     CASE WHEN v_total_max > 0 THEN (total_earned + essay_sum) / v_total_max ELSE 0 END
  );
END;
$function$
;
