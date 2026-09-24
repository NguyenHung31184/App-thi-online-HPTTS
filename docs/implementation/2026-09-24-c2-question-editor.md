# Phase C2 step 2, slice 1: question editor inside the library

- Status: complete 2026-09-24
- Baseline commit: `0e2e7de` (C2 step 1)
- Scope: `src/modules/question-bank/` (domain, data, application, queries, ui), `src/App.tsx` routes
- Rollback: `docs/rollback/2026-09-24-c2-question-editor.md`
- Parent: `docs/implementation/2026-09-24-phase-c2-single-question-store.md`

## Intent

Create and edit questions inside a library, in the question-bank module, so the library is the one place to work on questions. The legacy form (`src/pages/admin/AdminQuestionBankFormPage.tsx` with `src/services/questionBankService.ts`) stays in place until step 3 removes the old entry point. Excel/ZIP import is slice 2.

## Storage contract

`grade_attempt` and the student exam screen read these encodings. The editor follows the legacy form's encodings except for the three behaviours listed under "Legacy behaviours not copied":

| Type | `options` | `answer_key` | `rubric` | `media_url` |
|---|---|---|---|---|
| `single_choice` | filled options A–J | option id, e.g. `C` | unchanged | — |
| `multiple_choice` | filled options | JSON array of ids, sorted | unchanged | — |
| `drag_drop` | filled labels (2 or more) | JSON array of label ids, one per slot | `{ "zones": [4 × {x, y}] }` only for label-on-image (image and exactly 4 labels) | — |
| `true_false_multi` | statements | JSON array of `T`/`F` per statement | unchanged | — |
| `matching` | left column | JSON `{ "right": [...], "map": { "A": "1", ... } }` | unchanged | — |
| `video_paragraph`, `main_idea` | `[]` (as imported; the legacy form wrote one empty option, neither is read) | JSON array of `{text, points}` keys, or empty | free text for the grader | video URL (`video_paragraph`), validated by `utils/mediaUrlValidator` |

Images keep going to the `exam-uploads` bucket under `question-bank/`, now in a folder per library.

## Changes

- Domain: `question-draft.ts` holds the editor state and two pure functions: `draftFromQuestion` (row → form state, including the legacy reorder of matching answers) and `buildQuestionPayload` (form state → validated row fields). Validation messages follow the legacy form; the drag_drop message now names the label count instead of assuming 4.
- Data: read one question with every field, insert, update, upload an image. New questions in a library without a course (QTHH-AT) take the course that most of the library's published questions carry, because `question_bank.occupation_id` is required; the draw and grading do not use it.
- UI: `/admin/question-libraries/:libraryId/questions/new` and `/:questionId` open the editor inside the library layout. The questions tab gets "Thêm câu hỏi" and its "Sửa" links point to the editor. The status filter defaults to every status except "Ngừng sử dụng", so the 450 retired QTHH-AT copies stay out of the way.
- The editor shows the question status and can change it (draft, review, published, retired).
- Library screens follow one library per module: the create form requires a module, and a library without a course reads "Dùng chung nhiều nghề".

## Validation

- `tsc -b`, `check:boundaries`, ESLint, production build.
- Node assertions for `buildQuestionPayload` and `draftFromQuestion` on each of the 7 types, including a round trip of real encodings.
- Edge click-through with an admin session: edit and save one question of each type present in production without changing its content, and confirm the stored row is byte-for-byte the same; create one question in a test module and remove it.

## Legacy behaviours not copied

Found by reading real rows before writing the editor. Each would have changed a question on a plain open-and-save in the legacy form:

- drag_drop was forced to 4 slots. One published question has 3 labels, answer `["A","C","B"]`; the legacy form would save `["A","B","C","D"]`, a wrong key. The editor keeps one slot per filled label.
- Essay key points were re-spread over the question points on load. `main_idea` questions store 1 point per key (5 keys, 2-point question, so 2 matching keys already give full marks); re-spreading to 0.4 each would have required all 5. The editor keeps stored points and re-spreads only on "Chia đều lại" or when a key is added or removed.
- Zone positions were written for every 4-label drag_drop, image or not. `ExamTakePage` uses them only for label-on-image (image and exactly 4 labels, `isLabelOnImage`); every other drag_drop is an ordering task. The editor writes zones only in that case and otherwise leaves `rubric` untouched.

## Completion record (2026-09-24)

- `tsc -b`, `check:boundaries`, ESLint, production build passed.
- Node round trip on 7 production rows, one or more per type (drag_drop with image and 3 labels, drag_drop without image, main_idea, matching, multiple_choice, single_choice with image, true_false_multi): `draftFromQuestion` then `buildQuestionPayload` returns the stored `answer_key`, `options`, `rubric`, `media_url`, points, topic, difficulty and status. Plus 9 validation messages, 4- and 5-label drag_drop, and the status filter.
- Edge, admin session: opened and saved one published question of each of the 6 types in production through the editor without editing. Content md5 of all 6 rows is unchanged; `updated_at` moved, so each save ran.
- Edge: "Thêm câu hỏi" in the shared QTHH-AT library, empty submit shows "Nhập nội dung câu hỏi." with focus on the message; a draft `[TEST] C2 editor` question saved into the shared library with module `m07` and course RTG (the course most of its published questions carry). The test row was then soft-deleted.
- Edge at 375 px: new, drag_drop and matching editors have no horizontal scroll and no control under 44 px. Library list shows 7 libraries; the QTHH-AT header reads "Dùng chung nhiều nghề".
