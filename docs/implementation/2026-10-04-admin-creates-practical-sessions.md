# The admin creates practical exam sessions; Sổ chuyên cần only grades

- Status: done 2026-10-04, not pushed; checked in Edge on the local builds of both apps.
- Rollback: `docs/rollback/2026-10-04-admin-creates-practical-sessions.md`.
- Database: none (uses `mode = 'teacher_grading'` and the live-session unique index of 2026-10-03).
- Operator decision 2026-10-04: templates, criteria and sessions are all made by the admin in App thi; Sổ chuyên cần
  grades what the admin prepared; the TTDT app follows the results. This replaces
  `2026-10-04-hide-add-practical-session.md` (never pushed): the button comes back.

## App thi

- "Thêm kỳ thi" on the practical sessions page is back. The form (template, class, start, end) now creates a
  `teacher_grading` session, the kind Sổ chuyên cần grades. The access code is generated and no longer asked: field
  grading does not use it.
- A second live session for the same class and template is refused with a plain message (unique index, 23505).
- The exam day is shown to the examiner but grading outside it is not blocked (rehearsal, postponed exams).

## Sổ chuyên cần (its own repo and doc)

The class and template pickers are replaced by the list of sessions the admin created; the app no longer creates
sessions.

## Checks

`npm test`, `npx tsc -b`, `npm run lint`, `npm run check:boundaries`, `npm run build`; Edge: create a session for the
test class in App thi, see it in Sổ chuyên cần, open a student, then soft-delete the session.
