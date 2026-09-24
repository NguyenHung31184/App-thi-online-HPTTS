# Phase C2 step 3: retire the old question-bank screens

- Status: complete 2026-09-24 (admin); teacher click-through pending, see C2 acceptance
- Baseline commit: `750902f` (C2 step 2 slice 2)
- Scope: `src/modules/question-bank/`, `src/App.tsx`, legacy pages under `src/pages/admin/`, user guide `docs/HUONG_DAN_SOAN_DE_VA_IMPORT_CAU_HOI.md`
- Rollback: `docs/rollback/2026-09-24-c2-retire-old-question-store.md`
- Parent: `docs/implementation/2026-09-24-phase-c2-single-question-store.md`

## Intent

`/admin/questions` stops being a second entry point. Before its pages go, the library screens take over what only the old course page could do, so nothing is lost:

| Old course page (`AdminOccupationQuestionsPage`) | Library screens after this step |
|---|---|
| Filter by question type | Type filter on the questions tab |
| "Câu có lỗi" filter and warning banner (`utils/questionValidation`) | Same check: a "Câu có lỗi dữ liệu" filter entry, a banner with the count, and the first issue on each row |
| Select rows, delete selected | Select rows, then publish, move to draft, retire or delete them |
| Delete one question | "Xóa câu hỏi" in the editor |
| Export Excel | "Xuất Excel" of the rows on screen, in the import template's columns, so an exported file can be edited and imported back |
| "Câu chưa gắn mô-đun" view | Not needed: every live question has a library and a module since step 1 (checked 2026-09-24: 0 rows without either) |
| Inline edit, add, Excel import | Editor (slice 1) and Excel/ZIP import (slice 2) |

## Deleting protects past exams

`grade_attempt` skips deleted rows, and 1,698 distinct questions already appear in `attempts.question_ids`. Deleting one of them would change a student's score if the attempt is graded again, and remove it from the review screen. Deleting therefore:

- soft-deletes questions that no attempt has drawn;
- sets questions that an attempt has drawn to "Ngừng sử dụng" (`retired`) instead, which takes them out of the draw and keeps grading and review intact.

The confirmation says this before the operator confirms, and the result names both counts. The old page deleted used questions too.

Any action that takes questions out of "Đã phát hành" (draft, retired, delete) also warns that an exam of this module fails to start if its blueprint then needs more questions than remain.

## Old URLs

| Old URL | Goes to |
|---|---|
| `/admin/questions` | `/admin/question-libraries` |
| `/admin/questions/occupation/:course?moduleId=M` | questions tab of M's library; without a module, the library list |
| `/admin/questions/occupation/:course/new?moduleId=M` | new question in M's library |
| `/admin/questions/occupation/:course/import?moduleId=M` | Excel/ZIP import of M's library |
| `/admin/questions/occupation/:course/questions/:id` | the question in its library's editor |

The four legacy pages (`AdminQuestionHomePage`, `AdminOccupationQuestionsPage`, `AdminQuestionBankFormPage`, `AdminQuestionBankImportPage`) are removed. `services/questionBankService.ts` and `services/questionImportService.ts` stay: the exam detail page and the per-exam import still use them. Links from the exam question page to "Quản lý ngân hàng" point to the library list. The library list loses "Mở kho câu hỏi cũ".

## Validation

- `tsc -b`, `check:boundaries`, ESLint, production build.
- Node: filters (type, broken), export cells and a round trip export → import on real encodings of each type, the delete split between unused and used questions (repository stubbed).
- Edge, admin: every old URL above lands on the right library screen; filters, banner and row issues; bulk status change and delete on `[TEST]` rows; the used-question lookup run read-only against real attempts (no attempt is edited to fake a used test row); export downloads; 375 px check.
- Edge, teacher: open the library list, a library, the editor and the import page (C2 acceptance, carried over from Phase C).

## Completion record (2026-09-24)

- `tsc -b`, `check:boundaries`, production build passed. `npm run lint`: 0 errors; the 6 warnings are in files this step does not touch.
- Node (repository stubbed):
  - export → import round trip on the 7 production encodings (one or more per type): `question_type`, `answer_key`, `options`, points, topic and difficulty come back unchanged; an older matching row with a non-sequential map keeps its pairs;
  - the exported workbook: "Link ảnh" and "Trạng thái" are not read as import columns, true/false exports as Đ/S, re-importing the export gives 7 duplicates;
  - type and "broken" filters; none of the 7 production encodings is flagged;
  - delete: used questions retired, unused soft-deleted, nothing deleted when all are used.
- Edge, admin session:
  - old URLs: `/admin/questions` → library list; course + `moduleId=m07` → QTHH-AT questions tab; `/new` and `/import` → the library's editor and import page; `/questions/<id>` → that question in its library; course without module, unknown module and a missing question → library list. The list has no "Mở kho câu hỏi cũ".
  - 3 `[TEST] C2 step3` drafts imported into QTHH-AT, filtered, all selected, moved to "Chờ duyệt". The dialog names the count and the draw warning, focus starts on "Hủy", Escape closes it and focus returns to "Áp dụng".
  - Type filter (1 multiple choice of 3), "Xuất Excel" downloaded `Cau-hoi QTHH-AT - Quy trình xếp dỡ, hàng hóa và ATVSLĐ.xlsx`.
  - Editor "Xóa câu hỏi" soft-deleted one test row ("Đã xóa 1 câu.") and returned to the filtered list; bulk delete removed the other two. All 3 test rows are soft-deleted; QTHH-AT is back to 150 published and 450 retired.
  - `findQuestionsUsedInAttempts` called in the page with the admin session: a published QTHH-AT question that attempts have drawn is found, an unknown id is not. The used-question path of Delete was not clicked on a real question, to leave real data untouched.
  - Validator over all 7 libraries: 1,100 live questions, 0 flagged, so the warning banner stays hidden today.
  - 375 px: questions tab with the bulk bar and the open dialog have no horizontal scroll and no control under 44 px.
- Unused exports left in `services/questionBankService.ts` (`listQuestionsByOccupation`, `createQuestionBankBulk`, …) are no longer called by any page; they go when those services move into modules.
