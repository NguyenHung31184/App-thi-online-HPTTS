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
- Current P1 database state: the minimal question-library tables and RLS policies were created manually in Supabase. The repository migration must be reconciled before further P1 database work.

## Active sequence

1. Reconcile and verify P1 database migration.
2. Restructure the admin menu and route labels.
3. Split question-bank UI into task-focused pages.
4. Add live examination monitoring.
5. Add practical examination reporting.

See `docs/implementation/2026-09-22-admin-navigation-and-live-monitoring.md`.
