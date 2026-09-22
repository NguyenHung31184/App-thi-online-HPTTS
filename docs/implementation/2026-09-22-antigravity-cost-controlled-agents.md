# Antigravity cost-controlled agent setup

- Status: active
- Baseline commit: `af81af4`
- Configuration: `.agents/agents/`
- Rollback: `docs/rollback/2026-09-22-antigravity-cost-controlled-agents.md`

## Goal

Use Antigravity subagents without multiplying token use or allowing concurrent agents to overwrite one another.

## Model policy

- Select the primary reasoning model manually in Antigravity's model selector. `GPT-OSS-120B` is available there, but it is not OpenAI Codex or a ChatGPT subscription model.
- Use `hptts-research` and `hptts-verifier` at the Flash tier for read-only discovery and verification.
- Use `hptts-implementer` at the Pro tier only for a bounded, approved change in an isolated worktree.
- Use one writing agent per file set. Do not use a parallel writer for routine changes.

## Workflow

1. Ask the primary agent to invoke `hptts-research` for a bounded impact report.
2. Review the plan and create an implementation and rollback record before code changes.
3. Let the primary agent implement small changes. Use `hptts-implementer` only for a separable task and select the `branch` workspace mode.
4. Invoke `hptts-verifier` after the diff is ready.
5. The primary agent reviews the diff, commits, and deploys only after required checks pass.

## Cost controls

- Do not delegate one-file edits, label changes, or straightforward bug fixes.
- Use Flash for searches, reports, test runs, and code review.
- Cancel an idle or irrelevant subagent from `/agents`.
- Check consumption with `/usage` before using Pro, `/boost`, or `/teamwork-preview`.
- Do not use `/boost` or `/teamwork-preview` for the current 10-day delivery unless a task cannot be decomposed safely; both create additional agent activity.

## Limitation

Antigravity native subagents cannot be configured as “OpenAI GPT/Codex parent calls Gemini child.” Native custom agents select `inherit`, `flash`, or `pro` tiers. If ChatGPT Codex is used separately, exchange work through committed changes and the implementation records rather than trying to nest it inside Antigravity.
