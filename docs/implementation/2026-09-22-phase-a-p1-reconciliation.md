# Phase A — P1 database reconciliation

- Status: complete and verified in Supabase production
- Baseline commit: `2b1e542`
- Migration: `supabase/migrations/20260922110000_reconcile_p1_question_bank.sql`
- Rollback: `docs/rollback/2026-09-22-phase-a-p1-reconciliation.md`

## Why this phase exists

The initial P1 migration was applied partially through the Supabase SQL Editor. The database therefore contains the minimum UI tables but lacks some columns, indexes, history support, storage configuration, and the protected exam-draw predicate. Legacy `question_bank.occupation_id` is text while `occupations.id` is UUID, so backfill must validate and cast the legacy value.

## Changes

- Adds missing non-destructive P1 columns and `question_versions`.
- Backfills `question_libraries` only for rows whose legacy occupation identifier is a UUID.
- Restores all staff RLS policies and the private `question-imports` bucket.
- Redefines `start_exam_attempt` so only published questions can be drawn.

## Application record

- Applied through the Supabase SQL Editor on 2026-09-22.
- The migration completed with `Success. No rows returned`.
- No question-bank rows, attempts, users, or storage objects were deleted.

## Verification

The following production checks returned `true` on 2026-09-22:

1. All five P1 tables exist: libraries, taxonomy nodes, import jobs, import drafts, and versions.
2. RLS is enabled on each of those tables.
3. The `question-imports` bucket exists and is private.
4. `start_exam_attempt` contains the published-question predicate, so draft, review, and retired questions cannot be drawn into an attempt.

The admin UI still requires an authenticated admin or teacher browser session for its manual click-through check. Document import remains disabled until the separate Docling worker is deployed and its environment variables are configured.
