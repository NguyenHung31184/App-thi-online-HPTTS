# Rollback: one live field-grading session per class and template

Forward repair only. To restore the old rule, first soft-delete or merge duplicates, then:

```sql
DROP INDEX IF EXISTS public.practical_exam_sessions_class_template_mode_unique;
ALTER TABLE public.practical_exam_sessions
  ADD CONSTRAINT practical_exam_sessions_class_template_mode_unique UNIQUE (class_id, template_id, mode);
```

This fails while a soft-deleted and a live session share class, template and mode.
