# Draw excludes duplicate question content

- Status: applied to production 2026-09-24 (migration version `20260924094701`); live draw check pending a locked exam
- Date: 2026-09-24
- Migration: `supabase/migrations/20260924094701_draw_exclude_duplicate_content.sql`
- Rollback: `docs/rollback/2026-09-24-draw-exclude-duplicate-content.md`
- Ledger issue: "Shared module draws the same question more than once"

## Problem

Module `m07` (QTHH-AT) is used by four courses. Each course holds its own copy of the same 150 questions, so `question_bank` has 600 active rows for the module. `start_exam_attempt` drew by `module_id` and excluded repeats by `id` only, so one attempt could receive the same question several times.

Production check on 2026-09-24: all 326 checked attempts on `m07` exams contain a repeated question; the worst has 13 repeats in 50 questions.

## Change

Only the draw loop of `start_exam_attempt` changes:

- Two rows are the same question when stem and options match after lowercasing and collapsing whitespace. The image URL is not part of the key: course copies uploaded the same picture under different URLs.
- Each rule draws from one row per distinct question. When copies differ, the copy with an image is preferred.
- Questions taken by an earlier blueprint rule are excluded from later rules by content as well as by `id`.

Access, window, class, rate-limit, attempt-limit, lock and blueprint checks are copied unchanged from the production definition. `CREATE OR REPLACE` keeps the owner and grants.

## Why this key

Measured on production data on 2026-09-24:

| Module | Rows | Distinct by stem | Distinct by stem + options |
|---|---|---|---|
| HH-GN | 200 | 199 | 200 |
| KT-GN | 150 | 149 | 150 |
| NLĐK-CO | 150 | 146 | 150 |
| NLĐK-FL | 150 | 150 | 150 |
| NLĐK-QC | 150 | 147 | 150 |
| NLĐK-RTG | 150 | 150 | 150 |
| QTHH-AT | 600 | 150 | 150 |

Stem alone would drop questions that share wording but have different options. With stem + options, every row outside QTHH-AT stays distinct, so the draw for those modules is unchanged.

## Verification before applying

- All 7 non-deleted exams: no blueprint rule would fall short of questions under the new rule. The only changed rule is the QTHH-AT exam (`*`/`medium`, 50 questions): pool goes from 600 rows to 150 distinct questions.
- Simulation of 300 draws of that rule, read-only: old rule 300/300 draws with repeats (worst 11); new rule 0/300, every draw 50 questions, never the image-less copy when an image copy exists.
- The function body compiles (checked by creating a copy in `pg_temp`, which disappears with the session).
- The rollback file's SQL equals the production definition after whitespace normalization (length 4065, md5 `17d8ae475dad190e5e305da3588773e0`).

## Not covered

- Past attempts keep their questions and scores. A read-only report on them is a separate task.
- No exam is currently locked (`locked_at` is null for all 7), and `start_exam_attempt` rejects unlocked exams. That is P0 behaviour, unchanged here.
- The four copies of QTHH-AT remain in `question_bank`; merging them belongs to Phase C2.

## After applying

1. `select pg_get_functiondef('public.start_exam_attempt'::regproc)` contains `content_key`.
2. Start one attempt on a locked QTHH-AT exam in a trial window and check that its `question_ids` have 50 distinct stems.

## Application record (2026-09-24)

- Applied with the Supabase migration tool; recorded in `supabase_migrations.schema_migrations` as `20260924094701 draw_exclude_duplicate_content`. The repo file was renamed to the same version so local and remote history match.
- Before: definition md5 `17d8ae475dad190e5e305da3588773e0` (equal to the rollback file). After: md5 `c33f5cef769f3c956501291f004011e2`, length 4761, equal to the migration file after whitespace normalization.
- Unchanged: owner `postgres`, `SECURITY DEFINER`, `EXECUTE` for `postgres`, `authenticated`, `service_role`; one overload; lock, access-code rate limit and attempt-limit checks present.
- Pending: step 2 of "After applying" needs a locked QTHH-AT exam in a trial window. No exam is locked yet.
