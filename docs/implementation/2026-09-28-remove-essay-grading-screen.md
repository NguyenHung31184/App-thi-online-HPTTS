# Remove the manual essay grading screen

- Status: committed locally 2026-09-28.
- Date: 2026-09-28
- Database: none.
- Rollback: `docs/rollback/2026-09-28-remove-essay-grading-screen.md`
- Operator, 2026-09-28: "Bỏ phần chấm thi tự luận (trong menu bên trái) vì ít dùng và đã thay thế bằng dạng câu hỏi
  sử dụng key".

## Why it is safe

`grade_attempt` (`20260526010000_fix_grade_disqualify.sql`) already scores `main_idea` and `video_paragraph` answers
from the keys in `answer_key` (each key found in the answer adds its points, capped at the question's points) and writes
`attempt_question_scores`. The screen only let staff override those scores by hand.

## Change

- Menu item "Chấm tự luận", its title, the routes `/admin/essay-grading` and `/admin/essay-grading/:attemptId`, the
  pages `AdminEssayGradingPage.tsx` and `AdminEssayGradingDetailPage.tsx`, and the unused `EssayGradingIcon` are removed.
- Nothing else linked to these routes. Scores already written by hand stay in `attempt_question_scores`.

## Checks

`npm test` 35/35, `lint` 0 errors, `npm run build` pass.
