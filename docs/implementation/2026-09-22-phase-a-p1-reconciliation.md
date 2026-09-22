# Phase A — P1 database reconciliation

- Status: ready for database application
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

## Validation after application

1. Confirm the five P1 tables exist.
2. Confirm existing question-bank rows remain present and receive a library where possible.
3. Confirm authenticated admin/teacher can list question libraries; anon cannot.
4. Confirm a locked exam with a draft question reports insufficient published questions instead of drawing that draft.
5. Confirm the `question-imports` bucket is private.
