# Rollback: Phase C2 step 1, single question store

- Migration: `supabase/migrations/20260924111343_c2_single_question_store.sql` (applied 2026-09-24 11:13:43 UTC)
- Scope: `question_libraries`, `question_bank.library_id`, `question_bank.status`, one index, one trigger

## Facts this rollback relies on

Checked on production on 2026-09-24 before applying:

- No `question_bank` row had `status = 'retired'`, and every live row was `published`. After the migration every `retired` row is one of the 450 QTHH-AT copies retired by step 6.
- No `question_bank` row had a `library_id`. The only libraries were the two `[TEST] Phase C 2026-09-24…` libraries, which step 1 deletes.

## Recovery

Run in the Supabase SQL Editor, in one transaction. The migration ran at `2026-09-24 11:13:43.97607+00`; every library and retired row it wrote carries that timestamp.

```sql
BEGIN;

-- Undo step 7: stop assigning libraries.
DROP TRIGGER IF EXISTS question_bank_assign_library ON public.question_bank;
DROP FUNCTION IF EXISTS public.question_bank_assign_library();

-- Undo step 6: publish the retired copies again.
UPDATE public.question_bank SET status = 'published', updated_at = now()
WHERE status = 'retired' AND updated_at >= '2026-09-24 11:13:43+00';

-- Undo steps 4 and 5: unlink questions and remove the module libraries created by the migration.
UPDATE public.question_bank SET library_id = NULL
WHERE library_id IN (SELECT id FROM public.question_libraries WHERE created_at >= '2026-09-24 11:13:43+00');
DELETE FROM public.question_libraries WHERE created_at >= '2026-09-24 11:13:43+00';

-- Undo step 3.
DROP INDEX IF EXISTS public.question_libraries_one_active_per_module;

-- Undo step 2 only if no library is left without a course.
ALTER TABLE public.question_libraries ALTER COLUMN occupation_id SET NOT NULL;

COMMIT;
```

Step 1 (the two test libraries) is not restored; they were click-through test data.

## Cautions

- `created_at >= '2026-09-24 11:13:43+00'` also matches libraries created after the migration, including ones the trigger created for new modules. Check `SELECT id, name, created_at FROM question_libraries ORDER BY created_at` first and narrow the filter if needed.
- Questions or taxonomy nodes added to these libraries after the migration lose their library link; the questions themselves stay.
- The exam draw does not read `library_id`; after the rollback it draws from 600 QTHH-AT rows again, still without repeats thanks to `20260924094701`.

## Recovery checks

1. `select status, count(*) from question_bank where not is_deleted group by status` returns 1,550 `published`.
2. `select count(*) from question_bank where library_id is not null` returns 0.
3. `select count(*) from question_libraries` returns 0.
