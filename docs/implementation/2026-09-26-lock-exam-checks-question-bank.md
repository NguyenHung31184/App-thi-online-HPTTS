# "Khóa đề thi" checks the question bank the draw uses

- Status: committed locally 2026-09-26, not pushed.
- Date: 2026-09-26
- Database: none. Client code only.
- Rollback: `docs/rollback/2026-09-26-lock-exam-checks-question-bank.md`
- Ledger issue: "No exam is locked, and the QC exam cannot be locked from the UI"

## Problem

`start_exam_attempt` draws from `question_bank` by the exam's module and rejects an exam whose `locked_at` is null. The
"Khóa đề thi" button (`lockExam` → `validateBlueprint` in `src/services/examService.ts`) checks something else: the rows
of the legacy `questions` table that carry the exam's id.

- The QC exam ("Cấu tạo và nguyên lý vận hành cần trục giàn QC") has 0 legacy rows, so locking fails with "Thiếu câu"
  although its module has 150 published questions. The QC exam cannot run.
- The other six exams have 50 legacy rows each and lock, but the check says nothing about the pool the draw really uses.
- An exam without a blueprint could lock when it had legacy rows; the draw then fails with `exam_no_blueprint`.

## Change

Question-bank module (new, exported through `public.ts`):

- `domain/blueprint-coverage.ts`: pure check of a blueprint against a pool of questions. It uses the draw's rules:
  topic and difficulty match (`*` matches any), one entry per distinct content (stem + options, case and repeated
  whitespace ignored), rules taken in order.
  A rule passes only if it can always be filled, whatever questions the earlier rules happen to draw:
  distinct questions of the rule minus `min(earlier counts, questions it shares with earlier rules)` ≥ its count.
  For one rule, or rules that share no question, this equals the draw's own condition.
  It also rejects an empty blueprint and a count that is not a positive whole number, as the draw does.
  The content key is the module's existing `contentKey` (`domain/question-import.ts`), already used for import duplicates.
- `data/question-repository.ts`, `listDrawPool`: reads stem, options, topic and difficulty of the module's published,
  not deleted rows (`status` null counts as published, as in the draw), 1,000 rows per page.
- `application/check-exam-blueprint.ts`: loads the pool and runs the check.

Legacy service:

- `validateBlueprint` requires a module and a blueprint, then calls `checkExamBlueprint`. `lockExam` sets
  `total_questions` to the number of questions one attempt draws (sum of the rule counts); for the seven current exams
  this is 50, the value they already had.

Copy:

- Exam form: the hint under an empty blueprint said locking skips validation. It now says a blueprint is needed to lock.
- Exam detail, "Hướng dẫn khóa đề": steps describe the bank check instead of freezing a question list.

## Checks (2026-09-26)

- Pure check, 21 fixture cases bundled with esbuild and run in Node (script in the session scratchpad, not committed):
  one rule enough and short, four copies of the same questions counted once, case and whitespace ignored, topic and
  difficulty filters, overlapping rules (short and enough), disjoint rules, empty or string blueprint, count `"50"`
  accepted and `0`, `-1`, `2.5`, `""`, `null`, `"05"` rejected, rule without topic. All pass.
- Production data, read-only SQL: for each of the 7 active exams the number of distinct questions under the rule is the
  same with the draw's key and with `contentKey` (QC 150, Giao nhận 200, the others 150; each rule needs 50). All
  options are arrays. So every current exam, QC included, will lock.
- `npm run build`, `npm run check:boundaries` pass; eslint on the changed files: no errors (one existing
  `react-hooks/exhaustive-deps` warning in `AdminExamDetailPage.tsx`).
- Not run: the button itself. The local dev port used by the operator's session is taken, and pressing it on production
  writes `locked_at`.

## After deploy

1. As admin, open the QC exam and press "Khóa đề thi": it locks and shows 50 questions.
2. Open a trial window for it and start as a test student, or leave that to the next real exam.
3. Every exam that will be used needs "Khóa đề thi" once before its window opens.
