# Practical templates from an Excel or Word file

- Status: done 2026-10-03, not pushed.
- Rollback: `docs/rollback/2026-10-03-practical-template-import.md`.
- Database: none (uses the columns of `20261003100000_practical_field_config`).
- Operator request 2026-10-03: build a practical template from a file, as theory questions are imported.

## Inputs

1. **Excel from our template** (downloadable on the import page), four sheets:
   - "Chung": rows `Tên đề`, `Điểm đạt`, `Mốc khung 1/2/3` (m:ss), `Điểm khung 1/2/3`, `Tính nhiều chu kỳ`
     (trung bình / nhanh nhất / chu kỳ cuối).
   - "Bước": `Tên bước`, `Chu kỳ bấm giờ` (x), `Ảnh cần chụp`.
   - "Tiêu chí": `Bước` (name or number), `Tiêu chí`, `Điểm tối đa`, `Tiêu chí đánh giá chi tiết`, `Lỗi trừ nhanh`
     (`Tên lỗi | điểm` per line or separated by `;`), `Loại` (`Thời gian` for the time criterion).
   - "Bảo hộ & lỗi loại": column A protective equipment, column B disqualifying faults.
2. **Word**: the centre's score sheet table (STT | Nội dung kiểm tra | Tiêu chí đánh giá chi tiết | Điểm tối đa | …)
   and, in the same or another file, the test's "Các lỗi vi phạm" list. Read with the existing docx reader (moved to
   through `question-bank/public.ts`; the boundary rules keep it out of `src/shared` because a domain may only import
   types). A row whose name starts with "Thời gian" and has several scores is the
   time criterion; its lines ("Dưới 3,5 phút", "Từ 4,5 – 5 phút", "Trên 5 phút") give the bands. Steps are proposed:
   lifting, moving and lowering rows become one timed cycle step; a row about conduct ("tác phong") gets no step
   (gradable at every step); every other row is its own step. Everything is a draft to check.

## Flow

"Mẫu đánh giá" → "Nhập từ file" → pick `.xlsx` or `.docx` → draft: title, TTDT module, pass mark, steps, time bands,
criteria with deductions, protective equipment, faults, and warnings (missing total of 100, bands guessed, no faults
found) → "Tạo mẫu" creates the template and its criteria and opens the editor. Nothing is written before that button.

## Code

`practical-exams/domain/template-import.ts` (pure, tested with sheet rows and Word blocks),
`application/import-template.ts` (read file, build the Excel template, create), `ui/template-import/*`, route
`/admin/practical-templates/import`.

## Checks

Unit tests; `check:boundaries`, `tsc -b`, lint, build; Edge on the local build: download the Excel template, fill it
for a throwaway template, import, check every field in the editor, soft-delete it; import a Word score sheet built like
the RTG Khóa 43 sheet.

## Results (2026-10-03)

- Domain tests: Excel sheets, the RTG Khóa 43 sheet rebuilt as Word blocks (8 criteria, bands 3:30 / 5:00 / 6:30 from
  "Dưới 3,5 phút (18 move/giờ)…", proposed steps), faults typed, Word-numbered and under a/b/c titles. 214 tests in
  all; lint, boundaries, build pass.
- Edge, local build on the production database: the downloaded Excel template imported back with no warning (4 steps,
  100 points, bands); a Word file built like the RTG sheet plus section V gave the title, 8 criteria, 4 proposed
  steps, the bands with their warning and 4 faults. A template created from the Excel draft ("THỬ NHẬP EXCEL – xóa
  sau khi thử", 8 criteria, 4 steps) opened in the editor, then was deleted from the list (soft: `is_deleted`).
- The template list's delete confirmation now says that sessions and grades are kept (soft delete since 2026-10-02).
