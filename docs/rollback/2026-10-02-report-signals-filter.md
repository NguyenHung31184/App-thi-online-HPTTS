# Rollback: report signals filter

- Code: the commit whose message starts with `fix(exam-reporting)` and mentions the signals filter.
- Database: nothing to roll back.

## Recovery

`git revert` that commit and push. The tab goes back to showing the latest 1,000 signals of all exams.
