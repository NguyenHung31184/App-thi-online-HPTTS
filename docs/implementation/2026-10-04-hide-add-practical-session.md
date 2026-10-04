# Hide "Thêm kỳ thi" on the practical sessions page

- Status: done 2026-10-04, not pushed; checked in Edge on the local build.
- Rollback: `docs/rollback/2026-10-04-hide-add-practical-session.md`.
- Database: none.
- Operator decision 2026-10-04: hide the button.

## Why

The form creates a `student_upload` session (students hand in evidence themselves). Field grading does not use it:
Sổ chuyên cần opens its own `teacher_grading` session when the first student of a class is graded. The button invited
the operator to prepare a session that the examiners' phones never see.

## Change

`SessionsPage`: the "Thêm kỳ thi" link is removed and a sentence says where sessions come from; the empty state no
longer points to the button. The route `practical-sessions/new` and the form stay, so existing sessions can still be
edited and the button can come back with a one-line revert.
