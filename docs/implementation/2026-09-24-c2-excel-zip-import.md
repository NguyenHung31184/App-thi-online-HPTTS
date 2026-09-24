# Phase C2 step 2, slice 2: Excel/ZIP import inside the library

- Status: complete 2026-09-24
- Baseline commit: `c00b9aa`
- Scope: `src/modules/question-bank/` (domain, data, application, queries, ui), `src/App.tsx` routes
- Rollback: `docs/rollback/2026-09-24-c2-excel-zip-import.md`
- Parent: `docs/implementation/2026-09-24-phase-c2-single-question-store.md`

## Intent

Import a spreadsheet (XLSX, XLS, CSV) or a ZIP (spreadsheet plus an `images/` folder) straight into a library, in the question-bank module. It replaces the legacy question-bank import (`src/pages/admin/AdminQuestionBankImportPage.tsx`, Excel only, needs a course, so the shared QTHH-AT library could not use it) and brings the ZIP path that so far existed only for per-exam questions (`AdminQuestionImportPage`). The legacy screens stay until step 3.

## Behaviour

- Route `/admin/question-libraries/:libraryId/questions/import`, linked from the questions tab and the "Nhập tài liệu" tab.
- Choosing a file reads it at once and shows a preview: rows ready to import, rows with an error (row number as Excel shows it, and the reason), and rows skipped as duplicates.
- Every row goes through the editor's `buildQuestionPayload`, so imported rows get exactly the encodings the editor writes (`docs/implementation/2026-09-24-c2-question-editor.md`, storage contract).
- Duplicates use the exam draw's key (stem + options, case and whitespace ignored), against every non-deleted question of the library and against earlier rows of the same file. They are skipped, not imported.
- The operator picks the status for the batch: published (drawn into exams at once, as the legacy import did) or draft.
- Pictures are uploaded first, to `exam-uploads/question-bank/<library>/`. If one upload fails after a retry, nothing is inserted. The rows are then inserted in one request, so an import is all or nothing.
- Rows carry `library_id`, `module_id`, the course (library course, or the course most of its questions carry, as in the editor), `source = 'spreadsheet_import'` and `created_by`.
- Template download: one workbook with the question sheet first (header only) and a second sheet with one example per type and the rules; the ZIP template adds an empty `images/` folder.

## Kept from the legacy format

Column names (with or without the hint in parentheses), options A–J, answer as a letter or 1–10, `;` separators, essay keys as `text|points` with 2 points when the number is missing, matching as `A-1;B-2` with the right-hand texts in Keys, 2 points when the cell is empty, the first sheet only, and the fixed column order when the header is not recognized (now with a notice).

## Legacy behaviours not copied

Each one stored a question different from what the file said, without telling the operator:

- A wrong or missing answer fell back to a default: option A for single choice, the first option for multiple choice, A, B, C… for an ordering task, all "true" for true/false, and "(Trống)" options for a single choice row with fewer than 2 options. Now the row is reported and not imported.
- True/false answers written as "Đ;S" were read as all false. Đ, D, Đúng, T, True, 1 and S, Sai, F, False, 0 are accepted; anything else is an error.
- A UTF-8 CSV without a byte-order mark lost its Vietnamese characters. The file is decoded as UTF-8; a CSV in another encoding is refused with a message.
- A sheet with only essay questions (no option columns) was read with the fixed column order.
- Duplicates were only warned about and still imported.
- A missing or oversized picture imported the question without its picture. Now the row is reported.
- The type column was matched by loose substrings ("Đúng/Sai" was not recognized, unknown text silently became single choice). Known ids and the Vietnamese type names are accepted; unknown text is an error.
- An unknown difficulty became "medium"; the draw filters by difficulty, so it is now an error.
- An essay type with option cells became a single choice question; it now stays an essay (options dropped).
- Points "0" became 2 and "1.5" became 1; both are now errors.

## Validation

- `tsc -b`, `check:boundaries`, ESLint, production build.
- Node assertions on the pure import code: the legacy template rows, every error case above, header fallback, duplicates in file and against the library, CSV with and without BOM.
- Edge with an admin session: import a small XLSX and a ZIP with pictures into a test module, check the stored rows (encodings, library, module, course, status, image URL), open one in the editor, then soft-delete the test rows.

## Completion record (2026-09-24)

- `tsc -b`, `check:boundaries`, ESLint on the module and `src/App.tsx`, production build passed.
- Node, 10 groups on the bundled domain and application code (repository stubbed):
  - the 7 legacy template rows import with the same `question_type`, `stem`, `options`, `answer_key`, `points`, `topic` and `difficulty` as the legacy `importRowToQuestionPayload`;
  - 18 bad rows are reported with the expected message and none is imported;
  - Đ/S answers, Vietnamese type names, essay rows, header fallback with notice, essay-only header, spreadsheet row numbers;
  - duplicates within the file and against the library;
  - CSV in UTF-8 with and without BOM keeps Vietnamese, a Latin-1 CSV is refused;
  - ZIP: picture lookup (images/ wins, lock and macOS files ignored), missing and oversized pictures, label-on-image rows get 4 default zones, one upload per picture with one retry, a second failure stores nothing, one insert with library, module, dominant course, status, source and creator;
  - both templates: the 6 examples on the Vi_du sheet import cleanly and the first sheet is empty;
  - other file types and more than 1,000 rows are refused.
- Edge, admin session, shared QTHH-AT library (no course), status "Bản nháp":
  - XLSX with 7 rows: preview 4 ready, 1 error (row 6, answer E with 2 options), 2 duplicates (row 7 = row 2, row 8 = a published QTHH-AT question). Imported 4; the list opened on drafts with the toast "Đã nhập 4 câu vào ngân hàng."
  - ZIP with 3 rows and 2 pictures: 2 ready, 1 error (picture not in the ZIP). Imported 2; both pictures uploaded under `question-bank/<library>/import-*`.
  - Reading the XLSX again: 0 ready, 6 duplicates, so the fresh drafts count as existing.
  - Stored rows: encodings as expected for single choice, true/false, matching (sequential map), essay (`options = []`), drag_drop with image (4 default zones); `library_id` QTHH-AT, `module_id` m07, course from the dominant-course rule, `status` draft, `source` spreadsheet_import, `created_by` set.
  - Both picture questions open in the editor with the picture loaded.
  - 375 px: no horizontal scroll, no control under 44 px.
  - The 6 test rows were soft-deleted; the library is back to 150 published and 450 retired. The 2 test pictures stay in the bucket (never cleaned by hand).
