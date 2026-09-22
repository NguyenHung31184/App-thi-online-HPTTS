# Rollback — Antigravity cost-controlled agent setup

- Baseline commit: `af81af4`
- Scope: workspace-only Antigravity subagent definitions and documentation

## Recovery

Create a revert commit if the workspace configuration should be removed:

```powershell
git revert <antigravity-setup-commit-sha>
git push origin main
```

This setup has no database, deployment, or application-runtime effect. Removing `.agents/agents/` only stops Antigravity from discovering the custom subagents in this repository.
