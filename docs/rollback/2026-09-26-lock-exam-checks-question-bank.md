# Rollback: "Khóa đề thi" checks the question bank the draw uses

- Code: the commit that adds `docs/implementation/2026-09-26-lock-exam-checks-question-bank.md`.
- Database: nothing to roll back.

## When to roll back

Only if "Khóa đề thi" rejects an exam whose module has enough published questions, or locks an exam whose draw then
fails with `insufficient_questions_for_blueprint`. Check the module pool first:

```sql
select count(*) from question_bank
where module_id = '<module id>' and coalesce(is_deleted, false) = false
  and coalesce(status, 'published') = 'published';
```

## Recovery

- `git revert <commit>` and redeploy. Locking then counts the legacy `questions` rows again, so the QC exam can no longer
  be locked.
- Exams locked while this code was live stay locked; `locked_at` is only data. To undo one, press "Mở khóa đề".

## Recovery checks

1. "Khóa đề thi" on an exam with 50 legacy rows locks it.
2. A started attempt on that exam draws 50 questions.
