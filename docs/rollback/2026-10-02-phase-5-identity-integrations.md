# Rollback: `identity-access` and `integrations` (phase 5)

- Code: the commits whose message starts with `refactor(identity-access)` or `refactor(integrations)` made on
  2026-10-02 for phase 5, latest first. Hashes are listed in `docs/MODULAR_MONOLITH_TIEN_DO.md`.
- Database: nothing to roll back.

## Recovery

This phase touches sign-in for every user. If production sign-in or the guards break, first promote the previous Vercel
deployment (before phase 5), then `git revert` the step commits in reverse order and push. Users who were signed in keep
their Supabase session either way; the CCCD student session lives in `sessionStorage` under the same keys before and
after.
