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
| 2 | Module `exam-reporting` | Xong | 2026-10-02 | 54,3% · 25/46 route · 5/10 | Đã push | Không |
| 3 | Module `practical-exams` | Xong | 2026-10-02 | 62,6% · 34/46 route · 5/10 | Đã push | Không |
| 4 | Module `learning` | Hoãn (phát triển e-learning sau) | | | | |
| 5 | `identity-access` và `integrations` | Đang làm | 2026-10-02 | | Chưa | Không |
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
- `ec14d4b` bước 5: xóa `reportService`, `dashboardService`; README module.
- Tài liệu: [implementation](implementation/2026-10-02-phase-2-exam-reporting-module.md) ·
  [rollback](rollback/2026-10-02-phase-2-exam-reporting-module.md)

### Giai đoạn 3

- `c13ab5e` tài liệu kế hoạch giai đoạn 3.
- `f7b3b72` bước 1: luật thi thực hành thuần trong `domain/` kèm test; đổi giờ `datetime-local` sang `src/shared/lib/`.
- `04c5aa5` bước 2: data, application, adapter `src/platform/storage/exam-uploads.ts`; 3 service thành re-export.
- `252774c` bước 3: 7 trang vào module, 10 route lấy từ `public.ts`.
- `e08f973` bước 4: xóa 3 service thực hành; README module.
- Tài liệu: [implementation](implementation/2026-10-02-phase-3-practical-exams-module.md) ·
  [rollback](rollback/2026-10-02-phase-3-practical-exams-module.md)

### Sửa lỗi ngoài kế hoạch

- `e062e20` tab "Tín hiệu giám sát" lọc đúng theo đề, kỳ thi và đọc quá 1.000 dòng.

Commit chỉ có tài liệu: `4871f6d`, `ce48a3d`, `e32affd`, `2259f3f`, `c13ab5e`. Không cần revert khi rollback.

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
# Lùi giai đoạn 3
git revert --no-edit e08f973 252774c 04c5aa5 f7b3b72

# Lùi giai đoạn 2 (phải lùi 3 trước; nếu cần, lùi cả e062e20)
git revert --no-edit ec14d4b 1f7f11f f4d5bec 35c8398 3db4e2d

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
- Thi thực hành: xóa mẫu, tiêu chí, kỳ thi cũng là xóa cứng (`src/modules/practical-exams/data/`). Chờ quyết định cùng
  việc trên.
- Trang chấm thực hành và trang học viên nộp ảnh chưa thử trên dữ liệu thật (production chưa có kỳ thi thực hành nào).
- Giai đoạn 6 chỉ bắt đầu sau một buổi thi thử có giám sát AI chạy ổn định, không làm trong ngày có ca thi thật.
- Kịch bản Edge của buổi thi thử 2026-09-30 chưa đưa vào repo thành smoke test.
- Đã sửa (ngoài kế hoạch, sau giai đoạn 2): tab "Tín hiệu giám sát" trước đây không lọc theo đề hay kỳ thi và dừng ở
  1.000 dòng. Xem [implementation](implementation/2026-10-02-report-signals-filter.md) ·
  [rollback](rollback/2026-10-02-report-signals-filter.md).

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
- [x] Cập nhật file này, `ROLLBACK.md`, `DIARY.md`. Đã push (`2259f3f`, CI đạt); sửa lọc tín hiệu `e062e20` đã push.

## Giai đoạn 3: module `practical-exams`

Phạm vi đo ngày 2026-10-02, tổng 1.781 dòng: 3 service thực hành, 6 trang admin (mẫu, tiêu chí, kỳ thi, chấm), trang
học viên nộp ảnh. Ngoài phạm vi nhưng gọi tới: `DashboardPage`, `AdminSyncPage`.

- [x] Chuẩn bị: [implementation](implementation/2026-10-02-phase-3-practical-exams-module.md) ·
  [rollback](rollback/2026-10-02-phase-3-practical-exams-module.md)
- [x] Bước 1, domain: tổng điểm có hệ số, tiêu chí mới, kiểm tra form kỳ thi, quyền học viên với bài làm, nhãn; đổi giờ
  `datetime-local` chuyển sang `src/shared/lib/`.
- [x] Bước 2, data, application, adapter tải ảnh `src/platform/storage/`; 3 service thành re-export. Đồng bộ điểm sang
  TTDT vẫn gọi `ttdtSyncService` (chuyển ở giai đoạn 5, ghi trong allowlist).
- [x] Bước 3, 7 trang vào `practical-exams/ui`, 10 route lấy từ `public.ts`; `DashboardPage`, `AdminSyncPage` import qua
  `public.ts`.
- [x] Bước 4, dọn: xóa 3 service, trang cũ; allowlist; README; đo điểm (62,6%, 34/46 route).
- [x] Edge, chỉ xem: danh sách mẫu, sửa mẫu (7 tiêu chí), thêm mẫu, danh sách kỳ thi, thêm kỳ thi, danh sách chấm giống
  production; không lỗi trang. Production có 0 kỳ thi, 0 bài làm thực hành: trang chấm và trang học viên nộp ảnh chưa
  thử được bằng dữ liệu thật (cần tạo kỳ thi thử, người vận hành duyệt).
- [x] Giữ nguyên, chờ quyết định: xóa mẫu, tiêu chí, kỳ thi là xóa cứng (ghi ở "Việc còn mở").
- [x] Cập nhật tài liệu. Đã push (`c040039`, CI đạt).

## Giai đoạn 4: module `learning` — hoãn

Người vận hành quyết định ngày 2026-10-02: e-learning phát triển sau. Stash E-LEARNING trong repo sửa đúng các file
`StudentLearnPage`, `LessonPlayerPage`, `elearningStudyService`; chuyển các file này bây giờ sẽ xung đột khi lấy stash
ra. Phạm vi khi làm lại: 882 dòng, 2 route, ghi tiến độ khi đóng tab (`fetch keepalive`).

## Giai đoạn 5: `identity-access` và `integrations`

Phạm vi khoảng 1.900 dòng: `AuthContext` (18 file dùng), đăng nhập, chọn vai trò, xác thực CCCD, camera CCCD, chặn
quyền theo vai trò; đồng bộ TTDT, nhật ký đồng bộ, OCR, trang Nhật ký đồng bộ.

- [x] Chuẩn bị: [implementation](implementation/2026-10-02-phase-5-identity-integrations.md) ·
  [rollback](rollback/2026-10-02-phase-5-identity-integrations.md)
- [x] Bước 1, domain kèm test: vai trò từ `exam_role`, email đăng nhập từ mã học viên, trang đích sau đăng nhập, hai
  lớp chặn quyền (khu quản trị, khu học viên), chuẩn hóa CCCD, giải thích lỗi đồng bộ, đọc kết quả OCR.
- [x] Bước 2, lõi `identity-access`: phiên đăng nhập, profile, gọi kiểm tra CCCD, phiên học viên; `AuthProvider`,
  `useAuth` qua `public.ts`; 16 file đổi import; xóa `profileService`, `verifyCccdService`. `contexts/AuthContext.tsx`
  còn là file chuyển tiếp cho 2 trang e-learning (stash E-LEARNING, giai đoạn 4). Hai layout dùng hàm chặn quyền có
  test. Edge: chưa đăng nhập bị đẩy về `/login` / `/start`; admin vào được mọi trang, F5 không bị đẩy ra.
- [x] Bước 3, trang đăng nhập, chọn vai trò, xác thực CCCD, camera vào module; route `/start`, `/login`, `/verify-cccd`.
  OCR chuyển sang `integrations` cùng bước (trang CCCD cần nó). Edge: 3 trang giống production; nhập tay báo đúng lỗi
  thiếu số, thiếu tên; số CCCD bỏ khoảng trắng; không gửi kiểm tra thật.
- [ ] Bước 4, `integrations`: đồng bộ TTDT, nhật ký đồng bộ, OCR, trang `/admin/sync`.
- [ ] Bước 5, dọn, README, đo điểm.
- [ ] Edge: đăng xuất, đăng nhập admin, F5 ở trang quản trị không bị đẩy về /login, các trang /start, /login,
  /verify-cccd hiện đúng, Nhật ký đồng bộ giống production. Không kiểm tra CCCD, thử lại đồng bộ, dọn log trên dữ liệu
  thật nếu chưa được phép.
- [ ] Cập nhật tài liệu; hỏi trước khi push. Giai đoạn này đụng đăng nhập của mọi người dùng: push ngoài giờ thi.
