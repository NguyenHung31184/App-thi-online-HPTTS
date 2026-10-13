-- The signed-in exam account's own student record: name, date of birth, ID card number.
--
-- An exam account's profile carries the account name ("hv100238@hptts.vn") as its name; the person's name is in
-- public.students, which only staff may read. The result sheet therefore printed the account name whenever the
-- CCCD check of this browser tab was gone (new tab, reopened browser). This function returns the one student row
-- linked to the caller's own profile and nothing else. profiles.student_id cannot be pointed at another student:
-- guard_profile_privileged_columns checks it with profile_student_id_allowed.
--
-- Rollback: DROP FUNCTION public.get_my_exam_student();

CREATE OR REPLACE FUNCTION public.get_my_exam_student()
RETURNS TABLE (student_id text, student_code text, name text, dob date, id_card_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT s.id::text,
         s.student_code::text,
         s.name::text,
         s.dob,
         coalesce(nullif(btrim(s.id_card_number), ''), nullif(btrim(s.cccd), ''))
  FROM public.profiles p
  JOIN public.students s ON s.id::text = p.student_id::text
  WHERE p.id = auth.uid()
    AND coalesce(s.is_deleted, false) = false
$$;

REVOKE ALL ON FUNCTION public.get_my_exam_student() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_exam_student() TO authenticated;
