# Remove the score distribution and top exams charts from the dashboard

- Status: committed 2026-09-28.
- Date: 2026-09-28
- Database: none.
- Rollback: `docs/rollback/2026-09-28-remove-dashboard-charts.md`
- Operator, 2026-09-28: "Bỏ phần Phân phối điểm số, Top đề thi đi không thực sự cần thiết và hiệu quả".

## Change

- `src/pages/admin/AdminDashboardPage.tsx`: the cards "Phân phối điểm số" and "Top đề thi" and their helpers
  (`buildScoreDistribution`, `buildTopExams`, `ScoreDistributionChart`, `TopExamsChart`) are removed.
- "Kết quả thi" (Đạt / Không đạt / Bị loại) stays and now shares a row with "Log vi phạm 24h"; "Số bài làm theo ngày"
  takes the full width above them.
- `listRecentCompletedAttemptsForDashboard` is still used by "Kết quả thi".

## Checks

`npm test`, lint, `npm run build`.
