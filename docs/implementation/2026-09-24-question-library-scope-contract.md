# Question-library scope contract repair

- Status: applied in production and verified 2026-09-24; ships in the Phase C commit
- Date: 2026-09-24
- Scope: `question_libraries.occupation_id`, question-bank data adapter error normalization
- Migration: `supabase/migrations/20260924090000_question_library_scope_text.sql`
- Rollback: `docs/rollback/2026-09-24-question-library-scope-contract.md`

## Finding

The Phase C create form reads its occupation catalog from `courses`. Its identifiers are text values such as `kh01`. `question_libraries.occupation_id` was created as `UUID`, which caused the authenticated Admin browser test to fail with `invalid input syntax for type uuid: "kh01"`.

The table must use the same scope-key contract as `courses` and the existing `question_bank.occupation_id` field: a non-empty text identifier. It must not use a foreign key to `occupations`, because the active authoring UI does not read that catalog.

## Change

1. Drop only the incompatible foreign key from `question_libraries.occupation_id`.
2. Cast existing UUID-compatible values to text without changing the value.
3. Add a non-blank check.
4. Preserve RLS, current staff policies, indexes, import tables, and storage policies unchanged.
5. Wrap the PostgREST create error in `Error` so the user sees the actionable database message rather than a generic failure toast.

## Production validation

Run the migration in the Supabase SQL Editor, then as an Admin create `[TEST] Phase C 2026-09-24` with course `kh01`. Expected result: the library opens at `/admin/question-libraries/<id>` and the stored scope key is `kh01`.

```sql
select occupation_id, name
from public.question_libraries
where name = '[TEST] Phase C 2026-09-24';
```

Then complete the Phase C Admin and Teacher click-through checklist. No existing row, RLS policy, bucket, import file, question, or exam attempt is modified by this migration.

## Verification record (2026-09-24)

- Production schema, read with `information_schema` and `pg_constraint`: `question_libraries.occupation_id` is `text`, `question_libraries_occupation_id_fkey` is gone, `question_libraries_occupation_id_not_blank` exists. `module_id`, `modules.id` and `courses.id` are also `text`, so the module scope needs no repair.
- The migration was run in the SQL Editor, so it is not listed in `supabase_migrations`; the file in `supabase/migrations/` is the record.
- Admin UI create with course `kh01` and module `NLĐK-CO` stored `kh01` / `mod1765903232227`.
