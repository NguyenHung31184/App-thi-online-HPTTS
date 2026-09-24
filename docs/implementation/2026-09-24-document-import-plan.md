# Document import (Word, then PDF and images): plan

- Status: planned; starts after Phase C2 (Excel/ZIP import inside the library and retiring the old entry point)
- Date: 2026-09-24
- Rollback: to be written with the first implementation entry

## Goal

Upload a Word file (later PDF or a photo), let the system split it into questions with options, the correct answer and the pictures that belong to each question, review each draft in the library editor, and add accepted drafts to the library. The same outcome teachers know from Azota.

## What exists today (P1 prototype)

- The library "Nhập tài liệu" tab uploads DOCX, PDF or images to the private `question-imports` bucket and creates a `question_import_jobs` row.
- `api/process-question-import.ts` checks the caller and forwards the job to a separate Python worker (`worker/question-import`, Docling). The worker is not deployed anywhere, so the tab shows "chưa bật worker".
- The worker splits Markdown by "Câu N." and options by "A." to "J.". It never fills the correct answer, always sets `single_choice`, and attaches every extracted picture to every draft.
- The review screen is read-only; drafts never become questions.

## Decisions (operator, 2026-09-24)

1. Order: finish C2 first, then this phase.
2. Word first. Correct answers are marked in all three ways the center uses, and the importer must read each:
   - formatting on the correct option: underline, bold or colored text;
   - a line after the question such as "Đáp án: B";
   - an answer table or list at the end of the file (1-B, 2-A, …).
3. Reviewing reuses the library question editor (`docs/implementation/2026-09-24-c2-question-editor.md`): each draft opens in the editor, and "Đưa vào ngân hàng" saves it as a question of the library.
4. PDF and photos come later and need OCR: the Docling worker on the planned VPS, or an AI vision model called from the server. Decide when the Word path is done.

## Design notes for the Word path

- Read the DOCX XML (`word/document.xml` and relationships) rather than converting to Markdown: formatting (`<w:u>`, `<w:b>`, `<w:color>`) and the position of inline pictures are only available there.
- A picture belongs to the question whose text surrounds it; pictures before the first option go to the question stem.
- When two marking methods disagree for a question, keep the draft but flag it for review rather than choosing one.
- Detect the question type from the answer shape: one mark = single choice, several = multiple choice, Đúng/Sai per statement = true/false.
- Images go to `exam-uploads` under `question-bank/<library>/` like editor uploads.
- A sample file per marking style, provided by the center, is needed before building; tests run on those files.
