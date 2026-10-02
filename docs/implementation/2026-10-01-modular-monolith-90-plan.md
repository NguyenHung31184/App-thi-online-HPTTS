# Kế hoạch đưa App thi online lên 90% modular monolith

- Ngày lập: 2026-10-01
- Baseline: commit production `0267b37`
- Trạng thái hiện tại: khoảng 46/100
- Mục tiêu: tối thiểu 90/100, giữ nguyên hành vi nghiệp vụ và triển khai tăng dần

## 1. Hiện trạng đo được

- 3 module nghiệp vụ: `question-bank`, `exam-taking`, `exam-monitoring`.
- 60/141 file TypeScript/TSX nằm trong `src/modules`.
- 6.734/23.199 dòng mã nghiệp vụ nằm trong module, khoảng 29%.
- Khoảng 15/55 khai báo route đã do module sở hữu, khoảng 27%.
- `src/services` còn 21 file, khoảng 3.794 dòng.
- `src/pages`, `src/components`, `src/services` còn khoảng 16.465 dòng.
- `ExamTakePage.tsx` còn 1.377 dòng và đang điều phối nhiều trách nhiệm.
- Boundary check đã chạy trong CI nhưng chưa kiểm soát đầy đủ hướng phụ thuộc giữa các layer.

## 2. Định nghĩa đạt 90%

Mục tiêu 90% không yêu cầu router, provider và hạ tầng kỹ thuật phải nằm trong module nghiệp vụ. Repo đạt mục tiêu khi đồng thời thỏa các điều kiện sau:

1. Ít nhất 85% mã nghiệp vụ nằm trong `src/modules`.
2. Ít nhất 90% route nghiệp vụ dùng page được export từ `public.ts` của module.
3. Mọi truy cập Supabase của module chỉ nằm trong `data/` hoặc adapter kỹ thuật được module gọi qua application layer.
4. Module chỉ gọi module khác qua `public.ts`.
5. `domain/` không phụ thuộc React, Supabase, browser API hoặc layer khác.
6. `ui/` không gọi trực tiếp Supabase và không import repository.
7. Không còn business logic trong `src/services`; facade chuyển tiếp phải được xóa sau khi consumer cuối cùng đã chuyển.
8. `src/pages` chỉ còn route shell hoặc wrapper không chứa nghiệp vụ.
9. Các use case quan trọng có unit test; các RPC quan trọng có database integration test.
10. Boundary rules và architecture score chạy bắt buộc trong CI.

## 3. Cấu trúc đích

```text
src/
  app/
    providers/
    routing/
  modules/
    identity-access/
      domain/ application/ data/ queries/ ui/ public.ts
    question-bank/
      domain/ application/ data/ queries/ ui/ public.ts
    exam-management/
      domain/ application/ data/ queries/ ui/ public.ts
    exam-taking/
      domain/ application/ data/ queries/ ui/ public.ts
    exam-monitoring/
      domain/ application/ data/ queries/ ui/ public.ts
    exam-reporting/
      domain/ application/ data/ queries/ ui/ public.ts
    practical-exams/
      domain/ application/ data/ queries/ ui/ public.ts
    learning/
      domain/ application/ data/ queries/ ui/ public.ts
    integrations/
      domain/ application/ data/ queries/ ui/ public.ts
  platform/
    supabase/
    storage/
    media/
  shared/
    ui/
    lib/
```

`shared/` chỉ chứa thành phần thực sự dùng chung và không mang tên nghiệp vụ. Không đưa repository, API payload hoặc luật thi vào `shared/`.

## 4. Luật phụ thuộc đích

```text
domain       -> không phụ thuộc layer khác
application  -> domain + port/type nội bộ
data         -> domain/application contract + platform
queries      -> application
ui           -> queries + application DTO + domain presentation type
public.ts    -> export API tối thiểu cho router hoặc module khác
```

Cross-module:

```text
module A -> module B/public.ts
```

Không cho phép:

```text
ui -> data
domain -> application/data/queries/ui
module -> src/services
module -> file nội bộ của module khác
page/component -> Supabase cho nghiệp vụ
```

## 5. Các giai đoạn triển khai

### Giai đoạn 0 — Gia cố kiến trúc và đo tự động

Thời gian: 0,5–1 ngày. Mục tiêu dự kiến: 46% -> 50%.

Thay đổi:

- Thêm `scripts/architecture-score.mjs` để đo business LOC, module-owned routes, direct Supabase access và legacy services.
- Mở rộng `check-module-boundaries.mjs` để kiểm tra hướng phụ thuộc layer.
- Chặn module non-data import cả `lib/supabaseClient` và `platform/supabase/client`.
- Thêm allowlist tạm thời cho page/service cũ; CI không cho tạo thêm legacy business file.
- Giữ một Supabase client chuẩn tại `platform/supabase/client.ts`.
- Ghi baseline score vào CI output.

Điều kiện hoàn thành:

- Test, lint, build và boundary check đạt.
- Score script cho kết quả lặp lại ổn định.
- Không thay đổi hành vi giao diện hoặc database.

### Giai đoạn 1 — Hoàn thiện `exam-taking` và proctoring

Thời gian: 2–3 ngày. Mục tiêu dự kiến: 50% -> 60%.

Di chuyển:

- `pages/ExamIntroPage.tsx`
- `pages/ExamTakePage.tsx`
- `pages/ExamResultPage.tsx`
- `components/proctoring/*`
- `components/PortraitCameraGuide.tsx`
- `utils/blazeFaceProctor.ts`
- `utils/mediaPipeFaceProctor.ts`
- phần nghiệp vụ trong `services/attemptService.ts`

Tách `ExamTakePage` thành các use case/hook:

- `useAttemptSession`
- `useAttemptAutosave`
- `useAttemptSubmission`
- `useFullscreenGuard`
- `useProctoringCamera`
- `useAiProctoring`
- `useExamTimer`

Adapter upload và media browser đặt tại `platform/storage` và `platform/media`; luật điểm, cửa sổ phát hiện và trạng thái lượt thi giữ trong `exam-taking/domain`.

Điều kiện hoàn thành:

- Page chính không còn điều phối trực tiếp Supabase.
- Không còn business logic trong `attemptService.ts`; xóa facade khi không còn consumer.
- Giữ nguyên autosave, resume, hết giờ, fullscreen, AI, bằng chứng và nộp bài.
- Unit test các reducer/state machine; database test các RPC.
- Kiểm thử thật một kỳ thi thử ở cả `standard`, `strict`, `supervised`.

### Giai đoạn 2 — Tạo `exam-management`

Thời gian: 2–3 ngày. Mục tiêu dự kiến: 60% -> 68%.

Phạm vi:

- Danh sách, tạo, sửa, khóa đề thi.
- Blueprint và kiểm tra đủ câu.
- Cửa sổ thi, mã truy cập, số lần thi, chế độ giám sát.
- Các admin page `AdminExam*`, `AdminWindow*`.
- `examService.ts`, `examWindowService.ts`.

Giao tiếp với `question-bank` chỉ qua `question-bank/public.ts`. Không di chuyển logic ngân hàng câu hỏi sang module quản lý đề.

Điều kiện hoàn thành:

- Toàn bộ route đề thi và cửa sổ thi export từ `exam-management/public.ts`.
- Không còn page quản lý đề gọi service cũ.
- Giữ nguyên khóa/mở khóa đề và dữ liệu của các loại câu hỏi.

### Giai đoạn 3 — Tạo `practical-exams`

Thời gian: 2–3 ngày. Mục tiêu dự kiến: 68% -> 76%.

Phạm vi:

- Template thi thực hành.
- Phiên thi thực hành.
- Luồng học viên nộp ảnh/bằng chứng.
- Luồng giám khảo chấm thi.
- Các `practical*Service.ts` và admin/student page tương ứng.

Điều kiện hoàn thành:

- Route thực hành do module sở hữu.
- Upload bằng chứng đi qua adapter platform.
- Quyền học viên/giám khảo tiếp tục được kiểm tra tại database boundary.
- Database integration test cho start, submit và grading.

### Giai đoạn 4 — Tạo `exam-reporting`

Thời gian: 1,5–2 ngày. Mục tiêu dự kiến: 76% -> 82%.

Phạm vi:

- `AdminReportPage`.
- `AdminAttemptResultPage`.
- `reportService.ts`.
- Xuất Excel kết quả và tín hiệu giám sát.
- Duyệt bằng chứng AI và signed URL.

`exam-reporting` sở hữu read model báo cáo; không đọc repository nội bộ của `exam-taking`. Các RPC/query báo cáo riêng nằm trong `exam-reporting/data`.

Điều kiện hoàn thành:

- Điểm AI được tổng hợp theo lượt thi.
- Link bằng chứng được ký lại khi xem.
- Export Excel và bộ lọc giữ nguyên.
- Monitoring trực tiếp vẫn ở `exam-monitoring`; báo cáo lịch sử ở `exam-reporting`.

### Giai đoạn 5 — Tạo `learning`

Thời gian: 1–1,5 ngày. Mục tiêu dự kiến: 82% -> 86%.

Phạm vi:

- `StudentLearnPage`.
- `LessonPlayerPage`.
- `elearningStudyService.ts`.
- Tiến độ học và nội dung bài học.

Điều kiện hoàn thành:

- Route học trực tuyến do module sở hữu.
- Player không gọi trực tiếp Supabase.
- Có test cho cập nhật tiến độ và chuyển bài.

### Giai đoạn 6 — Identity, CCCD và integrations

Thời gian: 2–3 ngày. Mục tiêu dự kiến: 86% -> 90%.

`identity-access` sở hữu:

- `AuthContext`.
- Login, chọn vai trò và route guard.
- Xác thực CCCD.
- Profile và quyền exam role.

`integrations` sở hữu:

- Đồng bộ TTĐT.
- Nhật ký và retry đồng bộ.
- OCR orchestration.
- Admin sync page.

Client Supabase, storage transport và media/browser API vẫn thuộc `platform`, không thuộc `identity-access` hay `integrations`.

Điều kiện hoàn thành:

- Route guard có test theo role.
- Không còn page gọi trực tiếp Supabase cho auth/profile/CCCD.
- Đồng bộ dùng application use case và durable outbox hiện có.

### Giai đoạn 7 — Dọn legacy và tổng kiểm thử

Thời gian: 1–2 ngày. Mục tiêu dự kiến: duy trì 90–92%.

- Xóa service facade và page wrapper không còn consumer.
- Chuyển type nghiệp vụ khỏi `src/types/index.ts` về module sở hữu.
- Giữ `shared` nhỏ và không chứa business logic.
- Lazy-load các route module lớn để giảm bundle khởi tạo.
- Chạy architecture score và loại allowlist đã hết hạn.
- Cập nhật implementation ledger và rollback note cho từng giai đoạn.

Điều kiện hoàn thành:

- Đạt toàn bộ định nghĩa 90% ở mục 2.
- Full test, lint, build, boundary và database integration test đạt.
- Không có secret hoặc dữ liệu học viên trong commit.
- Production smoke test cho admin, học viên, thi lý thuyết, thi thực hành, báo cáo và e-learning.

## 6. Chiến lược commit và triển khai

Mỗi giai đoạn là một chuỗi commit nhỏ, không trộn thay đổi hành vi với di chuyển kiến trúc:

1. Thêm contract/test bảo vệ hành vi hiện tại.
2. Di chuyển domain/application.
3. Di chuyển data adapter.
4. Di chuyển query/UI và đổi route sang `public.ts`.
5. Xóa facade sau khi consumer cuối cùng đã chuyển.
6. Chạy full validation.
7. Push và deploy riêng giai đoạn.

Nếu giai đoạn cần migration, thứ tự Production là:

1. Commit cục bộ và kiểm tra.
2. Áp dụng migration tương thích ngược.
3. Push `main` để Vercel deploy.
4. Kiểm tra Production.
5. Chỉ xóa contract/database cũ trong một migration sau khi code mới đã ổn định.

## 7. Nguyên tắc giảm rủi ro

- Không refactor nhiều miền nghiệp vụ trong cùng một commit.
- Không đổi giao diện hoặc luật thi chỉ để phục vụ di chuyển file.
- Không tạo module chung kiểu `common-business`.
- Không để một page mới vượt 350 dòng; ưu tiên hook/use case có trách nhiệm rõ ràng.
- Không chuyển code vào module nếu module vẫn gọi ngược về service cũ.
- Không xóa RPC hoặc cột cũ cùng deployment với code thay thế.
- Mỗi phase có đường rollback bằng commit; database rollback dùng forward repair.

## 8. Thời gian dự kiến

Tổng thời gian: 10–15 ngày làm việc, khoảng 60–90 giờ tập trung.

| Mốc | Thời gian tích lũy dự kiến |
|---|---:|
| 60% | 2–4 ngày |
| 70% | 5–7 ngày |
| 80% | 8–10 ngày |
| 90% | 10–15 ngày |

Tiến độ phụ thuộc nhiều nhất vào kiểm thử thật luồng thi lý thuyết, camera/AI trên thiết bị học viên và thi thực hành.
