# HPTTS implementation ledger

This ledger is the entry point for people and coding agents continuing the project.

## Operating rules

1. Every structural, UI, logic, database, or API change gets one entry in `docs/implementation/` before code is changed.
2. Every entry names the affected modules, database objects, validation, deployment condition, and rollback procedure.
3. Each implementation is committed independently. The commit SHA is the primary recovery point.
4. Database recovery uses an explicit forward repair migration. Never run a destructive rollback against production data unless the entry says it is safe.
5. Secrets, `.env` files, personal data, and production API responses are never committed to these documents.

## Baseline

- Date: 2026-09-22
- Stable P0 commit: `428b6c0`
- Current P1 foundation commit: `68c008d`
- Local environment source: `.env` is intentionally ignored by Git.
- P1 database reconciliation: completed and verified in Supabase production on 2026-09-22 by `20260922110000_reconcile_p1_question_bank.sql`. The five P1 tables have RLS, the document-import bucket is private, and the exam draw excludes non-published questions.

## Active sequence

1. Restructure the admin menu and route labels: complete. See `docs/implementation/2026-09-22-phase-b-admin-navigation.md`.
2. Split question-bank UI into task-focused pages.
3. Add live examination monitoring.
4. Add practical examination reporting.

## Workspace agent setup

- Antigravity cost-controlled subagents: active. See `docs/implementation/2026-09-22-antigravity-cost-controlled-agents.md`.

See `docs/implementation/2026-09-22-admin-navigation-and-live-monitoring.md`.
