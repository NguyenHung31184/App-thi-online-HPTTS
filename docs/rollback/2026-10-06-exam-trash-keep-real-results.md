# Rollback: trash keeps real results

Database (forward repair): re-run `20261005091000_exam_trash.sql` after `DROP FUNCTION public.exam_trash_list();`
(its return type changed), then `DROP FUNCTION public.exam_trash_real_results(text, uuid);`. Hard delete of items with
real results is allowed again.

Code: the TTDT build reads `real_results` when present and shows the delete button when it is absent, so the TTDT
commit does not have to be reverted with the database.
