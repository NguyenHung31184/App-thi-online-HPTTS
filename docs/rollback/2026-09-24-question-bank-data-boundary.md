# Rollback — question-bank data boundary

- Scope: question-bank catalog data adapter and boundary enforcement

## Recovery

Use a revert commit for the completed change:

```powershell
git revert <data-boundary-commit-sha>
git push origin main
```

No database or environment rollback is needed. This changes source-code dependency direction only.

## Shared commit with the question-bank data boundary

This change and Phase C (`docs/implementation/2026-09-23-phase-c-question-bank-routes.md`) ship in one commit, because the data-boundary change rewrites the occupation and module hooks that Phase C introduced. Both rollback records point to the same SHA. Reverting that commit removes both changes together; there is no separate revert for either one.
