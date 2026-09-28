# Keep the option order when an option refers to other options

- Status: committed 2026-09-28.
- Date: 2026-09-28
- Database: none.
- Rollback: `docs/rollback/2026-09-28-keep-option-order.md`
- Operator, 2026-09-28: fix this before the Word import.

## Problem

The exam page shuffles the options of every single and multiple choice question and shows them without letters. Options
such as "Đáp án a, b đúng", "Cả hai phương án trên" or "Tất cả các ý trên" then point at the wrong options or at letters
the student cannot see. A read-only scan on 2026-09-28 with the rule below found 105 of 1,194 live choice questions with
such options (none of the 1,194 has a typed "a." prefix, so adding letters doubles nothing), and
the center's Word files (for example `4. ĐẾ/3. ĐỀ KTLT NBN 25 - ĐẾ.docx`) use them often.

## Change

- `src/modules/exam-taking/domain/option-order.ts` (pure, tested):
  - `referencesOtherOptions(texts)`: true when an option names other options by letter ("đáp án a, b đúng",
    "a, b, c đúng", "đáp án a và c") or by position ("... trên" after "cả hai/ba", "tất cả", "các/những ... trên").
    "Bật tất cả đèn", "Cả hai đều cho phép ..." or "... các đèn báo trên bảng điều khiển" do not count: "trên" must
    close the option (optionally followed by "đều đúng/sai"), or the option must list letters.
  - `optionLetter(index)`: "a", "b", …
- `src/pages/ExamTakePage.tsx`: such questions keep the stored order; every single and multiple choice option is shown
  with its letter ("a) …") by display position, so the letters in the text match what the student sees.
- Grading is unchanged: answers are stored by option id, not by position.

Detection runs on the option text at display time, so questions already in the bank and questions imported later are
covered without a database change.

## Checks

- `npm test` 48/48 (3 new: phrases from the bank and the Word file, ordinary options that must stay shuffled, letters),
  `check:boundaries`, `tsc -b`, lint, `npm run build`.
- The rule was run read-only over every live option text; the two false hits of a looser rule ("... trên boong",
  "... đèn báo trên bảng điều khiển") are now tests.
