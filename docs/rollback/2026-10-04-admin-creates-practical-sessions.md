# Rollback: the admin creates practical exam sessions

No database change. Revert the App thi commit and the Sổ chuyên cần commit together (`git revert <hash>` in each repo,
push; Sổ chuyên cần also needs `dist/` rebuilt). Reverting only Sổ chuyên cần brings back its own class and template
pickers, which still work with sessions created in App thi.
