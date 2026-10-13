# E-learning phases 1 and 2: lesson authoring and class assignment in the exam app

Date: 2026-10-13. Plan: `docs/PLAN_ELEARNING.md`. Rollback: `docs/rollback/2026-10-13-elearning-authoring-and-assignment.md`.

Status: commit `27e21b1`, pushed and live on production 2026-10-13 (CI and Vercel passed; admin pages and the learner
list checked in Edge on production). The migration for withdrawing an assignment was applied to production on 2026-10-13 after operator approval;
"Rút bài" was then checked in Edge on production (withdraw, then re-assign version 3 to `TEST-TH`).

## Why

The operator decided on 2026-10-13 that the management app only monitors and reports; authoring happens in the exam
app, next to the question bank and the exams. The lesson editor written in June lived in the management app and had
never been used: production held 2 lessons and no content blocks.

## What changed

Module `src/modules/elearning` gained an authoring side. The learner side (`ui/catalog`, `ui/player`,
`AssignedLessonPlayer`) is unchanged.

| Layer | File | Content |
|---|---|---|
| domain | `lesson-authoring.ts` (+ test) | Block form checks, provider guess from the link, ordering, publish checks, draft-versus-version comparison, assignment form checks, assignment state, per-class progress count, server error translation |
| data | `lesson-authoring-repository.ts` | Reads and writes of `elearning_lessons`, `elearning_lesson_blocks`; reads of versions, assignments, classes of a module, class sizes, progress marks; RPCs `elearning_publish_lesson`, `elearning_assign_lesson`, `elearning_archive_assignment` |
| application | `manage-lessons.ts` | Lesson catalogue, draft, block save and move, lesson removal guard, assignment list with progress |
| queries | `use-lesson-authoring.ts` | React Query hooks; every mutation refreshes the whole authoring cache |
| ui | `BlockContent.tsx` | A block as a learner sees it, without tracking (preview) |
| ui | `authoring/LessonsPage.tsx` | `/admin/lessons`: lessons of a module, add, reorder, delete |
| ui | `authoring/LessonEditorPage.tsx`, `BlockEditor.tsx`, `PublishPanel.tsx`, `AssignmentPanel.tsx` | `/admin/lessons/:lessonId`: details, blocks, preview and publication, assignment to classes |

Wiring: two routes in `src/App.tsx`, the menu group "Học trực tuyến" with "Bài học" in `AdminLayout` (admin menu
only; the teacher menu is untouched until phase 6), `LessonIcon` in `shared/ui/Icons.tsx`.

## Rules worth knowing

- Content is entered as an `https://` link. There is no upload: where the centre stores lesson video is not decided.
- A timed video (every source except YouTube) needs its length, and at least 15 seconds. The player credits whole
  seconds and loses the last partial one, so a shorter clip cannot reach the 90% the server asks for.
- YouTube videos, PDFs and articles are completed by the learner's own tick.
- Publishing is refused while the draft is empty, holds a quiz block or a timed video without length, or equals the
  newest version.
- Assigning always uses the newest published version. Assigning a lesson to a class that already has it replaces the
  earlier assignment: learners start again on the new version, earlier progress stays in the database.
- A lesson with a live assignment cannot be deleted; deletion is a soft delete.
- Quiz blocks cannot be authored (phase 3).

## Database

No change is needed for authoring, publishing and assigning: tables and functions exist since
`20261005015028_elearning_access_and_versions.sql`.

Withdrawing an assignment needs `20261013090000_elearning_archive_assignment.sql` (management app repository): columns
`archived_at`, `archived_by` on `elearning_class_assignments`, and `elearning_archive_assignment(uuid)`, allowed to
whoever may manage the class. Dry-run on production in a self-rolling-back transaction on 2026-10-13: columns created,
`anon` cannot execute, an unknown id is refused, nothing left behind. **Not applied.** Until it is, the "Rút bài"
button answers "Máy chủ chưa có chức năng này".

## Validation

- `npx vitest run src/modules/elearning`: 23 tests pass. `npm run check:boundaries` passes.
- Edge, local build, admin account, production data:
  - empty lesson name, PDF without link, timed video without length and a 5-second timed video are each refused with
    a message;
  - created "[THỬ] Bài học thử 13/10" in module "Cấu tạo và nguyên lý vận hành RTG" with an article, a timed video and
    a YouTube video; reordered and edited blocks; previewed; published versions 1, 2 and 3;
  - assigned to `TEST-TH`, re-assigned after each new version; the class row showed the version and the progress count.
- Edge, separate phone-sized window, test learner account:
  - the lesson appears under "Học trực tuyến"; ticking the article sets 1/3;
  - seeking to the end of the timed video and playing sends nothing to the server and credits nothing;
  - real playback is credited as watched ranges (`[0,4)` after one viewing of the 5-second clip, completion at
    `[0,5)`).
- Not tested: a full viewing of the 30-second clip to completion (the sample file streamed too slowly here), a real
  phone, withdrawing an assignment (migration not applied).

## Left for later

- Management app: replace "Quản lý E-Learning" with a link to `/admin/lessons` and remove the old editor.
- The learner page still shows the empty legacy list ("Chưa có bài học nào cho lớp của bạn") under the assigned
  lessons.
- Test data on production: lesson "[THỬ] Bài học thử 13/10" (three versions) assigned to `TEST-TH`.
