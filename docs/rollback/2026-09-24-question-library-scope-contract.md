# Rollback — question-library scope contract repair

## Recovery rule

Do not cast `occupation_id` back to UUID after any text course identifier has been used. That conversion would fail or require deleting valid libraries.

If the migration has been applied but no non-UUID value was inserted, a forward repair may restore the old type:

```sql
ALTER TABLE public.question_libraries
  DROP CONSTRAINT IF EXISTS question_libraries_occupation_id_not_blank;
ALTER TABLE public.question_libraries
  ALTER COLUMN occupation_id TYPE UUID USING occupation_id::uuid;
ALTER TABLE public.question_libraries
  ADD CONSTRAINT question_libraries_occupation_id_fkey
  FOREIGN KEY (occupation_id) REFERENCES public.occupations(id) ON DELETE CASCADE;
```

If any text identifier exists, keep the text contract and revert only application code with a normal Git revert. A destructive schema rollback is not valid recovery.

## Checks

1. Confirm `question_libraries.occupation_id` contains only values accepted by the target contract before changing type.
2. Retest Admin and Teacher inserts under existing RLS policies.
3. Confirm the legacy question-bank routes still load.
