-- ===================================================================
-- Fix 1: get_questions_for_attempt — thêm matching_right
--   Trả cột phải cho câu nối đôi (chỉ text[], không có map đáp án)
--   để thí sinh biết cần chọn gì, mà không lộ mapping đúng/sai.
--
-- Fix 2: grade_attempt — sửa 3 lỗi:
--   a) r.answers->>q.id: q.id là UUID → phải cast TEXT → jsonb ->> uuid lỗi
--   b) Chỉ query bảng questions cũ, bỏ sót question_bank (attempt mới)
--   c) Bỏ sót loại true_false_multi và matching khi chấm attempt mới
--
-- Fix 3: attempt_question_scores.question_id FK → bỏ ràng buộc FK tới questions
--   để essay từ question_bank cũng lưu được điểm auto.
-- ===================================================================

-- ───────────────────────────────────────────────────────────────────
-- 0. Bỏ FK constraint question_id → questions(id) trong attempt_question_scores
--    để cho phép lưu điểm essay từ question_bank (UUID không có trong questions)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE attempt_question_scores
  DROP CONSTRAINT IF EXISTS attempt_question_scores_question_id_fkey;

-- ───────────────────────────────────────────────────────────────────
-- 1. get_questions_for_attempt: thêm cột matching_right
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_questions_for_attempt(aid UUID)
RETURNS TABLE (
  id             UUID,
  exam_id        UUID,
  question_type  TEXT,
  stem           TEXT,
  options        JSONB,
  points         INT,
  topic          TEXT,
  difficulty     TEXT,
  image_url      TEXT,
  media_url      TEXT,
  matching_right TEXT,   -- JSON array text: ["cột phải 1","cột phải 2",...] hoặc NULL
  created_at     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id      UUID;
  v_exam_id      UUID;
  v_question_ids UUID[];
  v_row          RECORD;
BEGIN
  SELECT a.user_id, a.exam_id, a.question_ids
  INTO   v_user_id, v_exam_id, v_question_ids
  FROM   attempts a
  WHERE  a.id = aid;

  IF NOT FOUND THEN RETURN; END IF;

  -- Thí sinh chỉ được đọc câu hỏi của bài làm của chính mình
  IF get_my_role() NOT IN ('admin', 'teacher') THEN
    IF v_user_id IS DISTINCT FROM auth.uid() THEN
      RETURN;
    END IF;
  END IF;

  IF v_question_ids IS NULL OR array_length(v_question_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR v_row IN
    SELECT
      qb.id,
      qb.question_type,
      qb.stem,
      qb.options::JSONB  AS options,
      qb.points,
      qb.topic,
      qb.difficulty,
      qb.image_url,
      qb.media_url,
      qb.answer_key,
      qb.created_at,
      qb.updated_at
    FROM question_bank qb
    WHERE qb.id = ANY(v_question_ids)
      AND qb.is_deleted = false
    ORDER BY array_position(v_question_ids, qb.id)
  LOOP
    id            := v_row.id;
    exam_id       := v_exam_id;
    question_type := v_row.question_type;
    stem          := v_row.stem;
    options       := v_row.options;
    points        := v_row.points;
    topic         := v_row.topic;
    difficulty    := v_row.difficulty;
    image_url     := v_row.image_url;
    media_url     := v_row.media_url;
    created_at    := v_row.created_at;
    updated_at    := v_row.updated_at;

    -- matching_right: chỉ trả mảng cột phải, KHÔNG trả map đáp án
    matching_right := NULL;
    IF v_row.question_type = 'matching'
       AND v_row.answer_key IS NOT NULL
       AND v_row.answer_key != ''
    THEN
      BEGIN
        matching_right := (v_row.answer_key::JSONB -> 'right')::TEXT;
      EXCEPTION WHEN OTHERS THEN
        matching_right := NULL;
      END;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION get_questions_for_attempt(UUID) IS
  'Trả câu hỏi (không có answer_key) cho một bài làm. '
  'matching_right: chỉ chứa cột phải cho câu nối đôi — không lộ mapping đáp án.';

-- ───────────────────────────────────────────────────────────────────
-- 2. grade_attempt: fix UUID cast + dual-path + tất cả loại câu
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION grade_attempt(aid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r            RECORD;
  q            RECORD;
  total_earned NUMERIC := 0;
  total_max    NUMERIC := 0;
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
  FROM   attempts a WHERE a.id = aid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'attempt_not_found');
  END IF;
  IF r.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed');
  END IF;

  -- Dùng UNION ALL để chấm từ đúng nguồn câu hỏi:
  --   Attempt mới (question_ids NOT NULL) → question_bank
  --   Attempt cũ (question_ids IS NULL)   → questions table
  FOR q IN
    SELECT qb.id, qb.question_type, qb.answer_key, qb.points
    FROM   question_bank qb
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
    total_max := total_max + q.points;
    -- Fix lỗi "operator does not exist: jsonb ->> uuid": cast UUID → TEXT
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
      -- Partial credit: mỗi phát biểu đúng đóng góp (points / n)
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
      -- Partial credit: mỗi cặp đúng đóng góp (points / n_pairs)
      -- answer_key = {"right":[...],"map":{"A":"1","B":"2",...}}
      -- student ans = {"A":"1","B":"2",...}
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
      -- Key matching tự động; nếu answer_key rỗng → GV chấm thủ công
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
        SELECT COALESCE(SUM(
          CASE
            WHEN kv->>'text' IS NOT NULL
              AND LENGTH(TRIM(kv->>'text')) > 0
              AND (kv->>'points')::NUMERIC > 0
              AND POSITION(LOWER(TRIM(kv->>'text')) IN LOWER(ans)) > 0
            THEN (kv->>'points')::NUMERIC
            ELSE 0
          END
        ), 0)
        INTO essay_earned
        FROM jsonb_array_elements(key_json) AS kv;

        essay_earned := LEAST(essay_earned, q.points);

        INSERT INTO attempt_question_scores (attempt_id, question_id, score, max_points)
        VALUES (aid, q.id, essay_earned, q.points)
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET score = EXCLUDED.score, max_points = EXCLUDED.max_points;
      END IF;

    ELSE
      -- single_choice (default)
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
    auto_earned  = total_earned,
    raw_score    = total_earned + essay_sum,
    score        = CASE WHEN total_max > 0 THEN (total_earned + essay_sum) / total_max ELSE 0 END,
    completed_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at   = now()
  WHERE id = aid;

  RETURN jsonb_build_object(
    'ok',        true,
    'raw_score', total_earned + essay_sum,
    'total_max', total_max,
    'score',     CASE WHEN total_max > 0 THEN (total_earned + essay_sum) / total_max ELSE 0 END
  );
END;
$$;

COMMENT ON FUNCTION grade_attempt(UUID) IS
  'Chấm bài: question_bank (mới, question_ids != NULL) và questions table (cũ). '
  'single_choice/multiple_choice/drag_drop: all-or-nothing. '
  'true_false_multi/matching: partial credit theo số đúng/tổng. '
  'video_paragraph/main_idea: key matching hoặc GV chấm thủ công.';
