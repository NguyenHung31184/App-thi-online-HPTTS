# Import questions from a Word file (.docx), read in the browser

- Status: complete 2026-09-28; `b8437de` pushed after the operator's approval.
- Date: 2026-09-28
- Database: none. Stored rows use the existing `question_bank` columns; `source = 'word_import'`.
- Rollback: `docs/rollback/2026-09-28-word-import.md`
- Plan: `docs/implementation/2026-09-24-document-import-plan.md`. Operator, 2026-09-28: Word first, parsed in the browser
  (no Python server); the marking method is chosen per file; pictures must be taken out of the file and attached to
  their question.

## What the center's files look like

Survey of the 51 `.docx` under `D:\Du lieu\Trung tam Đào tạo\` (read only, not committed):

- Questions start with a typed "Câu N." / "Câu N:" / "Câu N" (no automatic "Câu" numbering anywhere). Some files type
  a whole question in one paragraph with manual line breaks ("Câu 3. …⏎A. …⇥B. …⏎C. …⇥D. …"), and some put the next
  "Câu N+1." on the line of the last option.
- Options are Word automatic numbering (a), b)… or no letter at all) or typed "a." / "A." / "a)", sometimes several
  on one line ("a. 5 vòng  b. 4 vòng  c. 3 vòng  d. 2 vòng").
- The correct option is red text in most files (`FF0000`, `EE0000`), yellow highlight in "Đề thi nâng bậc Lái xe oto 2";
  bold is used for emphasis inside stems and options, so it cannot be assumed to mark answers. Some files carry no
  answers at all (Forklift, NH Cont).
- Pictures are floating (anchored) or inline, sometimes in a table next to the options; a few are VML (`w:pict`) or
  inside `mc:AlternateContent` (Choice and Fallback hold the same picture).
- Before the first question: a header table (company, title); between questions: "PHẦN I – …" headings; after the last
  question: "Nơi nhận", signatures.
- 24 older `.doc` files cannot be read in the browser and must be saved as `.docx` in Word first.

## Behaviour

The Word file goes through the same screen and pipeline as Excel/ZIP (`2026-09-24-c2-excel-zip-import.md`): read,
preview, duplicates against the library, pictures uploaded first, one insert, all or nothing.

- `.docx` added to the file picker of "Nhập câu hỏi"; `.doc` is refused with the "Save as .docx" instruction.
- "Đáp án đúng được đánh dấu bằng": red text, highlight, bold or underline. The screen proposes the method that gives
  most questions exactly one marked option; changing it reads the file again. A line "Đáp án: B" under a question and an
  answer list after a "ĐÁP ÁN" heading at the end of the file (`1-B`, `1. B`, `Câu 1: B`, or a table) are always read.
- A manual line break splits a paragraph into lines, and "Câu N+1" inside a line starts the next question.
- Option letters are the ones Word shows: numbering is counted per list and level (a list shared by several questions
  keeps counting, as in Word), typed letters are read from the text.
- Text before the first "Câu" is ignored; a "PHẦN …" heading becomes the topic of the questions below it; reading stops
  at "Nơi nhận" or a signature line.
- Every picture inside a question (stem, options, table beside the options) goes to that question. A question keeps
  one picture: with more than one, the first is kept and the question is flagged. EMF/WMF/TIFF pictures cannot be shown
  by a browser; such a question is reported with the fix (save the picture as PNG in Word).
- Preview labels rows "Câu N" as in the file and shows each picture as a thumbnail, so the operator checks the
  picture–question pairing before saving.

Reported, not imported (the operator fixes the file and reads it again):

- no marked option; more than 10 options, or letters starting again at "a" after two or more options (a missing or
  mistyped "Câu" line, e.g. "Cây 13.");
- the formatting mark and a "Đáp án:" line or the end list disagree;
- two questions with the same stem and options but different answers (both reported).

Imported as a draft with a note even when the batch is published ("cần xem lại"):

- more than one marked option (stored as multiple choice);
- typed option letters that do not start at "a" or skip a letter (for example an option "a" stuck to the stem);
- more than one picture;
- a paragraph after an option that is neither an option nor an answer line (joined to the option above, usually its
  wrapped end).

## Code

- `domain/docx-reader.ts` (pure): a small XML tokenizer (the test environment has no DOM), document blocks in reading
  order with run formatting, numbering, pictures (relationship targets).
- `domain/word-questions.ts` (pure): blocks to import rows, answer detection, marking proposal, flags.
- `domain/question-import.ts`: rows and results carry an optional label ("Câu 28") and a review note; duplicate text uses
  the label.
- `application/import-questions.ts`: unzip the `.docx`, read `document.xml`, `numbering.xml`, relationships and media.
- `ui/QuestionSpreadsheetImportPage.tsx`: `.docx`, the marking choice, thumbnails, review notes.
- `ui/QuestionLibraryImportsPage.tsx`: points Word files to this screen; PDF and photos stay on the worker path.

- A row with a review note is stored as a draft even when the batch is published; a Word file defaults the batch to
  draft.

## Checks (2026-09-28)

- `npm test` 67/67 (19 new in `word-questions.test.ts`, synthetic XML: header/footer skipped, numbered and typed
  options, several options on one line, one-paragraph questions, "Câu N+1" on an option line, stem over several lines,
  wrapped option joined with a note, PHẦN topic, marking proposal, bold emphasis not taken for an answer, "Đáp án:" line
  and disagreement, answer list and answer table, no answer, two marks, same question with different answers, restart
  at "a", first option "b)", letters counting across a shared list, EMF picture, two pictures, flow into `planImport`
  with labels and duplicates). `check:boundaries`, `tsc -b`, lint 0 errors, build pass.
- Local runs (read only, nothing stored) on the center's files:
  - `4. ĐẾ/3. ĐỀ KTLT NBN 25 - ĐẾ.docx`: 150 questions, red proposed, 143 ready, 7 reported (28/40/76 and 32/62 same
    question with different answers, 141 no answer, 137 letter slip), 12 with a picture (2, 7, 26, 27, 39, 64, 74, 77,
    92, 128, 133, 136); 39 and 133 flagged for the wrapped option.
  - `1. ĐỀ KT THỢ ĐIỆN TRẠM - NBN 25.docx` (one paragraph per question): 205 questions, 200 ready (57 before line
    breaks were split).
  - Lái xe, Thợ hàn: 137/149 and 278/298 ready; the rest have no red option in the file.
  - Files without any marked answer (Forklift, NH Cont, Lái xe ô tô 3–4) are reported as such.
- Edge, admin, production, operator-approved write: the ĐẾ file into NLĐK-QC (no crane library exists yet). Preview:
  red proposed and marked "(file đang dùng)", batch status defaulted to "Bản nháp", 134 ready, 3 to review, 6 reported,
  10 duplicates inside the file (the same question in two levels), thumbnails on questions 2 and 7 matching the Word
  pictures. Import: toast "Đã nhập 134 câu vào ngân hàng.", no page error, no Supabase 4xx. Stored: 134 drafts,
  `source = 'word_import'`, module set, 13 with a picture (7 distinct files under `question-bank/<library>/import-*`).
  Question 7 opened in the editor with answer B and its picture loaded.
- The 134 test rows were soft-deleted the same day; NLĐK-QC is back to 150 published. The 7 test pictures stay in the
  bucket (never cleaned by hand).

## Accuracy pass (2026-09-29)

Operator asked for more accurate reading; chosen: reference check, Word template with question-type tags, the cases
still missed, and editing in the preview. This section covers the reference check and the reader fixes it found.

- Reference check outside Git in `D:\Data\App-thi-online-HPTTS-bao-cao\word-import-doi-chung\` (operator allows
  the center's files for testing; the folder is deleted when the app is finished, see ledger Open issues): the app's
  reader on 11 files (1,732 questions) against an independent python-docx reading (stem, options, red answer,
  picture), plus a stored approved result to compare every later change against.
- Fixes found by it:
  - two-column options: a Word-numbered option with a typed one after tabs ("Nhảy khỏi xe ⇥ c) Giảm ga"), typed
    columns "A. … ⇥ C. …" (also after "tab space tab"), then options ordered by letter when every letter is known once;
  - repeated letters in columns ("B. … B. …") now split and flagged instead of merged;
  - "Giải thích:" paragraphs and what follows up to the next question are skipped (notice with the count);
  - an answer marked on only part of its letters and digits gets a review note (a black full stop does not count).
- Result: python-docx agrees on every question except 3 answers that the author coloured only in part (app reads them
  by the majority rule and flags them). 1,371 questions importable (40 flagged), 361 reported, of which 343 are in the
  three files without any marked answer.
- `npm test` word import 24 tests (5 new).

## Word template and question-type tags (2026-09-29)

Operator decisions: true/false = red statements are true; matching = a two-column table, one correct pair per row;
essay = one "Ý chấm: text | points" line per key.

- Tags right after "Câu N.": `[Nhiều đáp án]`, `[Đúng/Sai]`, `[Nối cột]`, `[Sắp xếp]`, `[Tự luận]` (also
  `[Trắc nghiệm]`), `[Dễ]`/`[Trung bình]`/`[Khó]`, `[3 điểm]`. No tag = single choice (multiple when several options
  are marked, with a note). An unknown tag is reported with the list of known ones.
- `[Trắc nghiệm]` with two marks is reported; `[Nhiều đáp án]` with one mark is kept without a note.
- `[Sắp xếp]`: options in the file order are the right order (stored as drag_drop; the exam screen shuffles).
- `[Nối cột]`: table rows under the question; a row missing a side is reported. `[Tự luận]`: keys without points count
  2, as in the Excel import. ";" inside a matching or key text becomes "," with a note (the import format splits on
  ";").
- The reader now records the table cell of each paragraph (`tableCell`).
- Template `public/templates/Mau_soan_de_Word.docx`, built by `scripts/build-word-template.py` (python-docx; example
  questions written for the template, a drawn warning-sign picture): guidance before "Câu 1" (ignored by the reader) and
  one example per type. "Tải file mẫu Word" on the import screen; a "Nhãn dạng câu trong file Word" help list.
- Checks: `npm test` 80/80 (7 tag tests go through `planImport` to the stored encodings: true/false `["T","F","T"]`,
  matching, drag_drop, essay keys; `word-template.test.ts` reads the template back: 7 questions, 6 types, no error, no
  note, picture on question 7). Reference check: no change against the approved result except the order of two notes
  on one question (accepted).

## Cases the reader missed (2026-09-29)

- Formatting through styles: `word/styles.xml` is read; a run's formatting is the paragraph style (or Normal), then its
  character style (with `basedOn` applied first), then its own formatting, each overriding the one before ("auto"
  colour on the text beats a red paragraph style).
- Equations: the text of Word equations (`m:oMath`, `m:r/m:t`) is kept in the stem or option, with its own colour.
- Not changed: a question keeps one picture (the bank has one image column; more are flagged), EMF/WMF pictures are
  reported with the fix, text inside text boxes is not read (none of the center's multiple-choice files use them).
- Checks: `npm test` word import 33 tests (2 new: red through a character style, a style based on it and a paragraph
  style with an "auto" override; equation text). Reference check: no change against the approved result.

## Preview fixes after the operator's edit feature (2026-09-30)

- Review rows come first in "Câu sẽ nhập", and "Hiện thêm N câu" shows the rest 100 at a time. Before, only the first
  100 rows were shown, so a question to review past row 100 (ĐẾ question 133) could not be opened or confirmed.
- A single-choice question without an answer now says "Chọn đáp án đúng." instead of "Đáp án đúng phải nằm trong danh
  sách đáp án đã nhập." (the latter stays for an answer pointing at an empty option). The editor shares this message.
- Checks: `npm test` 113/113, `tsc -b`, lint 0 errors, boundaries, build. Edge on a local build with the admin session,
  preview only (no import, no database write): ĐẾ lists 39, 133, 137 first, 100 rows then "Hiện thêm 34 câu" to 134;
  Forklift question confirmed without an answer shows "Chọn đáp án đúng."; no page error. Reference check on 11 files:
  350 questions moved from "no answer" errors to answerable in the preview, nothing else changed.
