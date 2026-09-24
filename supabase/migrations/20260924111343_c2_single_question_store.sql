-- Phase C2 step 1: one question store.
-- Every module with questions gets exactly one active library and every question is linked to it,
-- so the library screens and the legacy screens show the same 1,550 questions.
-- Module QTHH-AT (m07) held four identical copies (one per course) of 150 questions: one copy of
-- each question stays published and the other copies become 'retired'. Nothing is deleted from
-- question_bank; grade_attempt ignores status, so past attempts still grade, and the exam draw
-- only takes published rows.

-- 1. Remove the Phase C click-through test libraries (their taxonomy nodes cascade).
--    They hold no questions and no import jobs; one of them uses module NLĐK-CO and would
--    otherwise block the one-library-per-module index below.
DELETE FROM public.question_libraries l
WHERE l.name LIKE '[TEST] Phase C 2026-09-24%'
  AND NOT EXISTS (SELECT 1 FROM public.question_bank q WHERE q.library_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM public.question_import_jobs j WHERE j.library_id = l.id);

-- 2. A module library can serve several courses (QTHH-AT serves four), so the course is optional.
ALTER TABLE public.question_libraries ALTER COLUMN occupation_id DROP NOT NULL;

-- 3. One active library per module.
CREATE UNIQUE INDEX IF NOT EXISTS question_libraries_one_active_per_module
  ON public.question_libraries (module_id)
  WHERE status = 'active' AND module_id IS NOT NULL;

-- 4. Create the library of every module that has live questions. The course is filled in only
--    when all of the module's questions belong to one course.
INSERT INTO public.question_libraries (occupation_id, module_id, name, description)
SELECT
  CASE WHEN count(DISTINCT q.occupation_id) = 1 THEN min(q.occupation_id) END,
  q.module_id,
  coalesce(nullif(btrim(m.code), '') || ' · ', '') || coalesce(nullif(btrim(m.name), ''), q.module_id),
  CASE WHEN count(DISTINCT q.occupation_id) > 1
    THEN 'Dùng chung cho ' || count(DISTINCT q.occupation_id) || ' nghề.'
    ELSE '' END
FROM public.question_bank q
LEFT JOIN public.modules m ON m.id::text = q.module_id
WHERE NOT coalesce(q.is_deleted, false) AND q.module_id IS NOT NULL AND btrim(q.module_id) <> ''
GROUP BY q.module_id, m.code, m.name
ON CONFLICT (module_id) WHERE status = 'active' AND module_id IS NOT NULL DO NOTHING;

-- 5. Link every question, soft-deleted ones included, to its module's library.
UPDATE public.question_bank q
SET library_id = l.id
FROM public.question_libraries l
WHERE q.library_id IS NULL
  AND l.status = 'active'
  AND l.module_id = q.module_id;

-- 6. Inside a module, keep one published row per question (same stem and options, the key the
--    exam draw uses). Prefer the copy with an image, then the oldest. Only QTHH-AT has such
--    copies on 2026-09-24 (450 rows).
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY module_id,
        lower(regexp_replace(btrim(coalesce(stem, '')), '\s+', ' ', 'g')) || '|' || lower(regexp_replace(coalesce(options::text, ''), '\s+', ' ', 'g'))
      ORDER BY (image_url IS NULL), created_at NULLS LAST, id
    ) AS copy_rank
  FROM public.question_bank
  WHERE NOT coalesce(is_deleted, false) AND status = 'published'
)
UPDATE public.question_bank q
SET status = 'retired', updated_at = now()
FROM ranked r
WHERE q.id = r.id AND r.copy_rank > 1;

-- 7. Questions added later, or moved to another module, join that module's library. The library
--    is created on first use. Runs with the caller's rights, so RLS on question_libraries applies.
CREATE OR REPLACE FUNCTION public.question_bank_assign_library()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_library UUID;
BEGIN
  IF NEW.module_id IS NULL OR btrim(NEW.module_id) = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.library_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.module_id IS NOT DISTINCT FROM OLD.module_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_library FROM question_libraries WHERE module_id = NEW.module_id AND status = 'active';
  IF v_library IS NULL THEN
    INSERT INTO question_libraries (occupation_id, module_id, name)
    SELECT nullif(btrim(NEW.occupation_id), ''), NEW.module_id,
      coalesce(nullif(btrim(m.code), '') || ' · ', '') || coalesce(nullif(btrim(m.name), ''), NEW.module_id)
    FROM (SELECT 1) AS one
    LEFT JOIN modules m ON m.id::text = NEW.module_id
    ON CONFLICT (module_id) WHERE status = 'active' AND module_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_library;
    IF v_library IS NULL THEN
      SELECT id INTO v_library FROM question_libraries WHERE module_id = NEW.module_id AND status = 'active';
    END IF;
  END IF;

  NEW.library_id := v_library;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS question_bank_assign_library ON public.question_bank;
CREATE TRIGGER question_bank_assign_library
  BEFORE INSERT OR UPDATE OF module_id ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.question_bank_assign_library();
