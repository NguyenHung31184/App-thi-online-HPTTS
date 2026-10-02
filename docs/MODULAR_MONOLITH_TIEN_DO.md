# Tiến độ modular monolith 90% và cách rollback

Kế hoạch: [implementation/2026-10-01-modular-monolith-90-plan.md](implementation/2026-10-01-modular-monolith-90-plan.md).
Đo bằng `npm run arch:score`, in ra 3 số: tỷ lệ dòng mã nghiệp vụ trong `src/modules`, số route do module sở hữu,
số tiêu chí đạt trên 10.

Cập nhật file này trong cùng commit với mỗi bước của một giai đoạn: thêm hash, đổi trạng thái, ghi điểm đo.

## Bảng tổng

| Giai đoạn | Nội dung | Trạng thái | Ngày | Điểm sau giai đoạn | Push | Migration |
|---|---|---|---|---|---|---|
| 0 | Luật kiến trúc, allowlist, điểm đo | Xong | 2026-10-02 | 25,3% · 14/49 route · 4/10 | Đã push | Không |
| 1a | Bỏ trang thêm/sửa/nhập câu hỏi theo đề | Xong | 2026-10-02 | không đo riêng | Đã push | Không |
| 1b | Module `exam-management` | Xong | 2026-10-02 | 43,6% · 22/46 route · 5/10 | Đã push | Không |
| 2 | Module `exam-reporting` | Xong | 2026-10-02 | 54,3% · 25/46 route · 5/10 | Chưa | Không |
| 3 | Module `practical-exams` | Chưa làm | | | | |
| 4 | Module `learning` | Chưa làm | | | | |
| 5 | `identity-access` và `integrations` | Chưa làm | | | | |
| 6 | `exam-taking` và giám sát AI (làm sau cùng) | Chưa làm | | | | |
| 7 | Dọn legacy, tổng kiểm thử | Chưa làm | | | | |

## Commit theo giai đoạn

### Giai đoạn 0

- `ca8f136` luật lớp, allowlist, `arch:score`; xóa `essayGradingService`, `occupationService`.
- Tài liệu: [implementation](implementation/2026-10-02-architecture-phase-0.md) ·
  [rollback](rollback/2026-10-02-architecture-phase-0.md)

### Giai đoạn 1a

- `c8c9682` bỏ route `/admin/exams/:id/questions/new`, `/:qId`, `/import`; trang chi tiết đề đếm câu trong ngân hàng
  của mô-đun. Bảng `questions` giữ nguyên trong database.
- Tài liệu: [implementation](implementation/2026-10-02-phase-1a-retire-per-exam-questions.md) ·
  [rollback](rollback/2026-10-02-phase-1a-retire-per-exam-questions.md)

### Giai đoạn 1b

- `5578bd7` bước 1: tầng data và application của `exam-management`.
- `fd9caf5` `ConfirmationModal`, `EmptyState` chuyển sang `src/shared/ui`.
- `c4832af` đọc danh sách lớp và mô-đun TTDT chuyển vào module `integrations`.
- `b786e65` bước 2: 6 trang Đề thi, Kỳ thi, Kiểm tra ngân hàng vào module.
- `ad99cd0` bước 3: các trang khác import qua `public.ts`; xóa 4 service trung gian.
- Tài liệu: [implementation](implementation/2026-10-02-phase-1b-exam-management-module.md) ·
  [rollback](rollback/2026-10-02-phase-1b-exam-management-module.md)

### Giai đoạn 2

- `e32affd` tài liệu kế hoạch giai đoạn 2.
- `3db4e2d` bước 1: luật báo cáo thuần trong `domain/` kèm test.
- `35c8398` bước 2: tầng data và application; `reportService`, `dashboardService` thành re-export.
- `f4d5bec` bước 3: trang Kết quả một lượt thi vào module.
- `1f7f11f` bước 4: Báo cáo và Dashboard admin vào module; route lấy từ `public.ts`.
- Bước 5 _(commit cuối của giai đoạn)_: xóa `reportService`, `dashboardService`; README module.
- Tài liệu: [implementation](implementation/2026-10-02-phase-2-exam-reporting-module.md) ·
  [rollback](rollback/2026-10-02-phase-2-exam-reporting-module.md)

Commit chỉ có tài liệu: `4871f6d`, `ce48a3d`, `e32affd`. Không cần revert khi rollback.

## Cách rollback

Giai đoạn sau dựa trên giai đoạn trước. Muốn lùi một giai đoạn thì lùi mọi giai đoạn sau nó trước, hash mới nhất trước.

**Lùi nhanh khi production lỗi**: vào Vercel, chọn bản deploy trước đó và bấm Promote to Production. Git không đổi,
sau đó revert bình thường rồi push. Các mốc an toàn:

| Mốc | Commit deploy |
|---|---|
| Trước giai đoạn 0 | `2f3bf4d` (chỉ tài liệu sau `0267b37`) |
| Sau giai đoạn 0 | `ca8f136` |
| Sau giai đoạn 1b | `4871f6d` (hoặc `ce48a3d`, chỉ thêm tài liệu) |

**Lùi bằng git** (giai đoạn chỉ chuyển code, không có migration):

```bash
# Lùi giai đoạn 2 (thay <bước 5> bằng hash commit bước 5)
git revert --no-edit <bước 5> 1f7f11f f4d5bec 35c8398 3db4e2d

# Lùi giai đoạn 1b (phải lùi 2 trước)
git revert --no-edit ad99cd0 b786e65 c4832af fd9caf5 5578bd7

# Lùi giai đoạn 1a (phải lùi 1b trước)
git revert --no-edit c8c9682

# Lùi giai đoạn 0 (phải lùi 1a, 1b trước)
git revert --no-edit ca8f136
```

Sau khi revert: chạy `npm test`, `npx tsc -b`, `npm run lint`, `npm run check:boundaries`, `npm run build`, rồi push.
Nếu `check:boundaries` báo lỗi allowlist, chạy `node scripts/check-module-boundaries.mjs --write-allowlist` và commit kèm.

**Giai đoạn có migration**: không xóa hay sửa migration đã áp dụng. Viết một migration mới trả lại định nghĩa cũ
(forward repair), chạy thử trong khối `DO` tự hoàn tác, chờ người vận hành duyệt, làm ngoài giờ thi. Quy trình ở
mục 6 của kế hoạch.

## Việc còn mở

- Xóa kỳ thi và nút "Xóa báo cáo thi thử" vẫn xóa hẳn dữ liệu, trái quy ước xóa mềm
  (`src/modules/exam-management/data/exam-window-repository.ts`). Chờ người vận hành quyết định.
- Giai đoạn 6 chỉ bắt đầu sau một buổi thi thử có giám sát AI chạy ổn định, không làm trong ngày có ca thi thật.
- Kịch bản Edge của buổi thi thử 2026-09-30 chưa đưa vào repo thành smoke test.
- Lỗi có từ trước, tìm thấy khi kiểm tra giai đoạn 2: tab "Tín hiệu giám sát" của Báo cáo không lọc theo đề hay kỳ
  thi. Bộ lọc `attempts.exam_id` / `attempts.window_id` đặt trên bảng nhúng nên không bỏ dòng nào, và PostgREST
  cắt ở 1.000 dòng: đề nào cũng hiện 1.000 tín hiệu mới nhất của mọi đề (đề QC có 15 bài nhưng file Excel vi phạm
  có 168 lượt thi). Production và bản mới giống nhau. Sửa riêng sau khi xong giai đoạn 2 (cần `!inner` hoặc lọc
  theo danh sách lượt thi, và phân trang).

## Giai đoạn 2: module `exam-reporting`

Phần thuộc giai đoạn này, đo ngày 2026-10-02, tổng 2.263 dòng:

| File | Dòng | Ghi chú |
|---|---:|---|
| `src/pages/admin/AdminReportPage.tsx` | 592 | dùng `reportService`, `exam-management/public`, `integrations/public` |
| `src/pages/admin/AdminAttemptResultPage.tsx` | 625 | gọi Supabase trực tiếp (`attempts`, `exams`, `profiles`, `students`, `question_bank`, bảng cũ `questions`); ảnh lúc vào thi qua `attemptService.fetchStartExamPhotoSignedUrl` |
| `src/services/reportService.ts` | 515 | lượt thi, vi phạm, ký URL bằng chứng, RPC `review_ai_proctoring_incident`, xuất Excel |
| `src/services/dashboardService.ts` | 333 | `getAdminDashboardStats` dùng ở cả `AdminDashboardPage` và `DashboardPage` |
| `src/pages/admin/AdminDashboardPage.tsx` | 198 | thống kê; nhúng `LiveExamMonitor` (giữ ở `exam-monitoring`) |

Mỗi bước một commit, không đổi database, không đổi giao diện:

- [x] Chuẩn bị: file implementation và rollback của giai đoạn 2, dòng ledger.
  [implementation](implementation/2026-10-02-phase-2-exam-reporting-module.md) ·
  [rollback](rollback/2026-10-02-phase-2-exam-reporting-module.md)
- [x] Bước 1, domain: tách hàm thuần (lọc báo cáo, tổng hợp điểm AI theo lượt, dựng dòng Excel kết quả và vi phạm, số
  liệu dashboard) ra `exam-reporting/domain`, có unit test chụp hành vi hiện tại.
- [x] Bước 2, data và application: `report-repository`, `dashboard-repository`, `evidence-storage` (ký URL bằng chứng
  và ảnh lúc vào thi; module không import `src/services`). Use case ở `application/`. `reportService`,
  `dashboardService` tạm chỉ re-export.
- [x] Bước 3, trang kết quả một lượt thi: 8 truy vấn trực tiếp vào `attempt-result-repository`, đọc bảng cũ
  `questions` giữ nguyên (chỉ đọc), hook ở `queries/`, tách component con để trang ≤350 dòng.
- [x] Bước 4, UI và route: `ReportPage`, `AttemptResultPage`, `AdminDashboardPage` vào `exam-reporting/ui`, export
  qua `public.ts`; `App.tsx` trỏ route `dashboard`, `report`, `attempts/:attemptId/result` vào module;
  `DashboardPage` lấy số liệu qua `exam-reporting/public`.
- [x] Bước 5, dọn: xóa `reportService.ts`, `dashboardService.ts`, 3 trang cũ; sinh lại allowlist; README module; đo
  `arch:score` (dự kiến khoảng 54–56%, 25/46 route).
- [x] Mỗi bước: `npm test`, `npx tsc -b`, `npm run lint`, `npm run check:boundaries`, `npm run build`.
- [x] Edge, chỉ xem, bản local: dashboard admin khớp production; báo cáo lọc theo đề, kỳ, lớp khớp số dòng; xuất Excel
  kết quả và vi phạm, mở file xem cột; mở bằng chứng AI; trang kết quả một lượt thi có ảnh lúc vào thi và đáp án.
  Không bấm duyệt sự việc AI trên dữ liệu thật nếu chưa được cho phép.
- [x] Điều kiện xong: điểm AI tổng hợp theo lượt; link bằng chứng ký lại khi xem; Excel và bộ lọc giữ nguyên; giám sát
  trực tiếp vẫn ở `exam-monitoring`.
- [x] Cập nhật file này, `ROLLBACK.md`, `DIARY.md`. Chờ người vận hành cho push.
