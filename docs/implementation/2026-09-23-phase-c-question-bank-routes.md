# Phase C — question-bank UI separation

- Status: complete. Admin click-through passed on 2026-09-24; the Teacher check moves to Phase C2 acceptance (no exams scheduled, operator decision 2026-09-24)
- Baseline commit: `e8c6886`
- Scope: `src/modules/question-bank/` (ui, queries, application), `src/App.tsx` routes
- Rollback: `docs/rollback/2026-09-23-phase-c-question-bank-routes.md`

## Intent

`QuestionLibraryDashboardPage` puts library creation, the library list, the knowledge tree, document import and the job list on one screen, and has no way to see the questions that belong to a library. Split it into one route per task so each screen has a single job and can be linked directly.

## Routes

| Route | Screen | Task |
|---|---|---|
| `/admin/question-libraries` | Library list | Create a library, pick one |
| `/admin/question-libraries/:libraryId` | Library layout, structure tab | Status counts, knowledge tree, add topic or outcome |
| `/admin/question-libraries/:libraryId/questions` | Questions tab | List the library's questions, filter by status, tree node and text |
| `/admin/question-libraries/:libraryId/imports` | Import tab | Upload a document, follow import jobs |
| `/admin/question-libraries/:libraryId/imports/:jobId` | Import review | Read-only review of drafts from one job |

Kept for existing links:

- `/admin/question-libraries?library=<id>` redirects to `/admin/question-libraries/<id>`.
- `/admin/question-libraries/imports/:jobId` still opens the review screen.
- `/admin/questions/...` legacy routes are unchanged. Editing a single question still uses the legacy form at `/admin/questions/occupation/:occupationId/questions/:qId`.

## Rules kept in this phase

- No schema, RLS, RPC, storage or API change. Only reads and writes that already exist in `question-library-repository.ts` are used.
- Imported drafts are never published automatically. The review screen stays read-only; accepting drafts into `question_bank` is a later, separate entry.
- Occupation and module lookups move out of the page component into module query hooks (`useOccupationOptions`, `useModuleOptions`). Since the data-boundary change on 2026-09-24 they read through the module's own data adapter, not the legacy `services/` facades.
- Other modules keep importing only through `src/modules/question-bank/public.ts`.

## UI decisions

- Direction: the existing admin visual language (slate neutrals, indigo action colour, white cards). Phase C changes structure, not styling. Dials: ENERGY 1 / RHYTHM 1 / MOTION 1, which suits a staff tool used during exam operations.
- Tabs inside a library are plain links with `aria-current="page"`, so each tab is a real URL, works with the back button, and gets keyboard focus like the sidebar.
- Every data screen has loading, empty and error states. An unknown `libraryId` shows a not-found state with a link back to the list.
- Vietnamese copy in these screens is restored with diacritics; several strings had lost them.

## Validation

- `npx tsc -b`, `npm run check:boundaries`, `npm run build`.
- Local route check: every route above returns the app shell; the legacy `?library=` link lands on the library page.
- Keyboard: Tab reaches the tabs, filters and links in visual order with a visible focus ring.
- Narrow screen (375 px): tabs and filters wrap without horizontal scroll.
- Authenticated click-through with an admin and a teacher session before deployment.

## Completion record

- Implemented on 2026-09-23.
- `QuestionLibraryDashboardPage` removed; replaced by `QuestionLibraryListPage`, `QuestionLibraryLayout`, `QuestionLibraryStructurePage`, `QuestionLibraryQuestionsPage`, `QuestionLibraryImportsPage`. `QuestionImportReviewPage` rewritten with diacritics and works under both review URLs.
- Pure filters `taxonomySubtreeIds`, `filterLibraryQuestions`, `countQuestionsByStatus` added to `domain/question-library.ts`. Filtering by a tree node includes every node below it; the tree shows the same count.
- Occupation and module lookups moved to `useOccupationOptions` / `useModuleOptions`.
- Passed: `tsc -b`, `check:boundaries`, ESLint on the touched files, production build, `git diff --check`, a Node assertion run of the three pure filters.
- Local dev server returned HTTP 200 for all eight routes in the table, the legacy `?library=` link and `/admin/questions`; Vite compiled every new module without warnings.
- Authenticated click-through: see the section below.

## UI review pass (2026-09-24)

- Removed copy that promised behaviour the app does not have: the exam matrix draws by the question `topic` field, not by the knowledge tree, and the import review screen is read-only. Both screens now say so.
- Status counts in the library header link to the questions tab filtered by that status.
- Error states offer a working "Tải lại" button that refetches the failed query.
- Links and buttons in these screens have a 44 px minimum touch height.
- Text colour pairs checked with `contrast-check.py`: lowest is slate-500 on white at 4.76:1.

## Authenticated click-through (2026-09-24)

Run on Edge 153 through the DevTools protocol, in a separate browser profile; the operator signed in by hand. Test data is limited to libraries named `[TEST] Phase C 2026-09-24…`.

Admin (`a***@educore.vn`), all passed, no browser console errors:

- Library list opens a library; the three tabs mark the current one with `aria-current`.
- "Chờ duyệt" count opens `questions?status=review`; text, status and tree filters write to the URL; "Bỏ lọc" clears them.
- Import tab: file input and button disabled with the worker off, amber notice shown.
- `?library=<id>` redirects to `/admin/question-libraries/<id>`; `/admin/question-libraries/imports/<jobId>`, an unknown library id and `/admin/questions` render their expected screens.
- Adding an outcome under a topic nests it in the tree and shows a toast.
- Creating a library with occupation `kh01` and module `NLĐK-CO` through the form stores `occupation_id = kh01`, `module_id = mod1765903232227` (checked in the database). This is the path that failed before the scope-contract repair.
- Keyboard: every Phase C control shows a 2 px focus outline. At 375 px no screen scrolls sideways and no control is shorter than 44 px.
- Not testable: the "Sửa" link, because no library holds questions yet.

The run also found three older admin-shell defects, fixed separately in `docs/implementation/2026-09-24-admin-shell-fixes.md`.

Teacher: deferred to Phase C2 acceptance. RLS on `question_libraries` and `question_taxonomy_nodes` allows `admin` and `teacher` (`get_my_role()`), read from the reconcile migration.

## Known limits carried forward

- Editing a question still goes through the legacy form, which updates `question_bank` in place and does not write `question_versions`. Versioned editing belongs to the P1 editor work.
- Adding questions or importing Excel/ZIP still happens in the legacy occupation screens; new rows there are not assigned a `library_id`, so they do not appear in a library until that link is set.

## Architecture follow-up

- On 2026-09-24, the occupation and module catalog reads were moved into the question-bank data adapter. `ui`, `queries`, and `application` no longer import Supabase or legacy `services/` directly.
- `npm.cmd run check:boundaries` now enforces this rule for every module. See `docs/implementation/2026-09-24-question-bank-data-boundary.md`.
