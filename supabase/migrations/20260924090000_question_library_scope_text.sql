-- Question-library scope uses the same stable text identifier as courses and
-- question_bank. Existing production libraries use UUID-compatible values;
-- casting them to text preserves every value.

ALTER TABLE public.question_libraries
  DROP CONSTRAINT IF EXISTS question_libraries_occupation_id_fkey;

ALTER TABLE public.question_libraries
  ALTER COLUMN occupation_id TYPE TEXT USING occupation_id::text;

ALTER TABLE public.question_libraries
  ADD CONSTRAINT question_libraries_occupation_id_not_blank
  CHECK (char_length(btrim(occupation_id)) > 0);
