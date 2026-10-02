# Rollback: theory sync log `module_id` as text

Going back to `uuid` would fail on the text module ids written after the change and break the sync again, so there is
no backward migration. If the change itself causes trouble, the forward repair is to keep the column text and fix the
reader. Code revert of the doc commits: `git revert <hash>`.
